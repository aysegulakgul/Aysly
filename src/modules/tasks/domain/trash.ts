/** BR-DEL-003 (D-035): çöpteki kayıtlar silme grubunun `deleted_at` anından itibaren 30 gün saklanır. */
export const TRASH_DAYS = 30;
const DAY = 86_400_000;

export const purgeAt = (deletedAt: Date) => new Date(deletedAt.getTime() + TRASH_DAYS * DAY);

/** Süresi dolan grup geri yüklenemez; bakım işi bir sonraki çalışmada kalıcı siler. */
export const isExpired = (deletedAt: Date, now: Date) => purgeAt(deletedAt) <= now;

/** Kalan gün (yukarı yuvarlanmış); süresi dolduysa 0. */
export const daysLeft = (deletedAt: Date, now: Date) =>
  Math.max(0, Math.ceil((purgeAt(deletedAt).getTime() - now.getTime()) / DAY));
