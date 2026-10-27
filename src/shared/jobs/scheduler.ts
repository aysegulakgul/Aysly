/**
 * Zamanlanmış bakım işleri (D-053): ayrı worker yok; işler uygulama çalışırken, açılışta ve belirli aralıkla
 * uygulama sürecinin içinde çalışır. Uygulama kapalıyken iş çalışmaz. Her iş idempotent olmalıdır.
 */
export type JobDefinition = {
  /** Benzersiz iş adı; veritabanı kilidi bu addan türetilir. */
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
};

export interface Scheduler {
  register(job: JobDefinition): void;
  start(): void;
  stop(): void;
}

/** Aynı işin iki süreçte aynı anda çalışmasını engelleyen kilit (ör. geliştirmede yeniden yükleme). */
export interface JobLock {
  withLock(name: string, fn: () => Promise<void>): Promise<'ran' | 'skipped'>;
}

export type JobLogger = {
  info(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
};

export function createInProcessScheduler(lock: JobLock, log: JobLogger): Scheduler {
  const jobs: JobDefinition[] = [];
  const timers: ReturnType<typeof setInterval>[] = [];

  const execute = async (job: JobDefinition) => {
    try {
      const outcome = await lock.withLock(job.name, job.run);
      log.info({ job: job.name, outcome }, 'zamanlanmış iş tamamlandı');
    } catch (error) {
      // Bir işin hatası diğer işleri ve uygulamayı durdurmaz; bir sonraki aralıkta yeniden denenir.
      log.error(
        { job: job.name, err: error instanceof Error ? error.message : 'bilinmeyen' },
        'zamanlanmış iş başarısız',
      );
    }
  };

  return {
    register(job) {
      jobs.push(job);
    },
    start() {
      for (const job of jobs) {
        void execute(job); // açılışta bir kez
        const timer = setInterval(() => void execute(job), job.intervalMs);
        timer.unref?.();
        timers.push(timer);
      }
    },
    stop() {
      for (const timer of timers) clearInterval(timer);
      timers.length = 0;
    },
  };
}
