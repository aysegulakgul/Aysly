/**
 * Next.js sunucusu açılırken bir kez çalışır. Zamanlanmış bakım işlerini uygulama sürecinin içinde başlatır (D-053):
 * ayrı worker yok, uygulama kapalıyken iş çalışmaz.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { env } = await import('@/shared/config/env');
  if (!env().SCHEDULER_ENABLED) return;
  const { getScheduler } = await import('@/shared/composition');
  getScheduler().start();
}
