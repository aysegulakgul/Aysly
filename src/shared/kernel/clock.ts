/** Domain ve application zamanı yalnızca bu porttan alır; testlerde sahte saat verilir (CODING_STANDARDS §3). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(
  start: Date,
): Clock & { advance(ms: number): void; set(date: Date): void } {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
    set: (date) => {
      current = new Date(date);
    },
  };
}
