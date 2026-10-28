/** BR-INBOX-003: 99'dan fazlası "99+"; sıfırsa rozet gösterilmez. */
export const badge = (count: number) =>
  count === 0 ? undefined : count > 99 ? '99+' : String(count);
