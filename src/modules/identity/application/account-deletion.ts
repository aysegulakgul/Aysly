import type { Clock } from '@/shared/kernel/clock';
import { validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';

/** BR-ACC-005 / D-036: talepten sonra iptal edilebilir bekleme süresi. */
export const DELETION_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export const deletionDueAt = (requestedAt: Date) =>
  new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * DAY_MS);

/** Hesap silme deposu portu. */
export type DeletionStore = {
  /** Talep yoksa işaretler; varsa mevcut talep zamanını korur. Talep zamanını döner. */
  markDeletionRequested(userId: string, now: Date): Promise<Date>;
  clearDeletionRequest(userId: string, now: Date): Promise<void>;
  deleteAllSessions(userId: string): Promise<void>;
  /** Süresi dolmuş talepleri olan kullanıcıların kimlikleri. */
  listDueDeletions(requestedBefore: Date): Promise<string[]>;
  /**
   * Kullanıcıyı ve tüm verisini tek işlemde kalıcı siler; denetimde yalnızca anonim "hesap silindi" kalır.
   * Kullanıcı zaten silinmişse veya talep iptal edilmişse hiçbir şey yapmaz (idempotent).
   */
  purgeUser(userId: string, requestedBefore: Date, now: Date): Promise<boolean>;
};

export type DeletionDeps = {
  store: DeletionStore;
  clock: Clock;
  verifyPassword: (password: string) => Promise<boolean>;
};

/** BR-ACC-005 / D-055: şifreyle yeniden doğrulama → işaretlenir, tüm oturumlar kapanır. */
export async function requestAccountDeletion(
  deps: DeletionDeps,
  actor: { userId: string },
  command: { currentPassword: string },
): Promise<Result<{ scheduledFor: Date }, DomainError>> {
  if (!(await deps.verifyPassword(command.currentPassword))) {
    return err(validationError([{ field: 'currentPassword', reason: 'incorrect' }]));
  }
  const requestedAt = await deps.store.markDeletionRequested(actor.userId, deps.clock.now());
  await deps.store.deleteAllSessions(actor.userId);
  return ok({ scheduledFor: deletionDueAt(requestedAt) });
}

/** BR-ACC-005 / D-092: 14 gün içinde giriş yapan kullanıcı talebi iptal eder. */
export async function cancelAccountDeletion(
  deps: Pick<DeletionDeps, 'store' | 'clock'>,
  actor: { userId: string },
): Promise<void> {
  await deps.store.clearDeletionRequest(actor.userId, deps.clock.now());
}

/** BR-ACC-005 / D-053: uygulama çalışırken süresi dolan hesapları siler; yarıda kalan iş sonraki çalışmada sürer. */
export async function purgeDueAccounts(deps: Pick<DeletionDeps, 'store' | 'clock'>) {
  const now = deps.clock.now();
  const requestedBefore = new Date(now.getTime() - DELETION_GRACE_DAYS * DAY_MS);
  let purged = 0;
  for (const userId of await deps.store.listDueDeletions(requestedBefore)) {
    if (await deps.store.purgeUser(userId, requestedBefore, now)) purged += 1;
  }
  return purged;
}
