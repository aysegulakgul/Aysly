import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInProcessScheduler, type JobLock } from './scheduler';

const passthroughLock: JobLock = {
  async withLock(_name, fn) {
    await fn();
    return 'ran';
  },
};
const silentLog = { info: vi.fn(), error: vi.fn() };

describe('uygulama içi zamanlayıcı (D-053)', () => {
  afterEach(() => vi.useRealTimers());

  it('işi açılışta bir kez, sonra her aralıkta çalıştırır', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const scheduler = createInProcessScheduler(passthroughLock, silentLog);
    scheduler.register({ name: 'test', intervalMs: 1000, run });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(3);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('bir işin hatası diğer işleri durdurmaz ve loglanır', async () => {
    vi.useFakeTimers();
    const log = { info: vi.fn(), error: vi.fn() };
    const healthy = vi.fn(async () => {});
    const scheduler = createInProcessScheduler(passthroughLock, log);
    scheduler.register({
      name: 'bozuk',
      intervalMs: 1000,
      run: async () => Promise.reject(new Error('x')),
    });
    scheduler.register({ name: 'saglam', intervalMs: 1000, run: healthy });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'bozuk' }),
      expect.any(String),
    );
    scheduler.stop();
  });
});
