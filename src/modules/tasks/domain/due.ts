import type { FieldIssue } from '@/shared/kernel/errors';

/**
 * BR-DATE-001: tüm gün tarihleri saat dilimsiz `YYYY-MM-DD`; saatli son tarih yerel tarih + saat + IANA saat
 * dilimiyle saklanır ve mutlak an (`due_at`) bunlardan hesaplanır, elle yazılmaz.
 */
export type Due = { date: string; time: string | null; timezone: string | null; at: Date | null };
export type DueInput = {
  date: string;
  time?: string | null | undefined;
  timezone?: string | null | undefined;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Takvimde gerçekten var olan gün mü? (ör. 2026-02-30 değil) */
export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Verilen anın o saat dilimindeki yerel duvar saati (dakika hassasiyetinde, UTC gibi kodlanmış ms). */
function wallClock(instantMs: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instantMs)
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
}

const MINUTE = 60_000;
const DAY = 86_400_000;
const offsetAt = (instantMs: number, tz: string) => wallClock(instantMs, tz) - instantMs;

/**
 * Yerel tarih + saati verilen saat diliminde mutlak ana çevirir. BR-DATE-006:
 * - İki kez yaşanan yerel saat (geri alma) → ilk gerçekleşme.
 * - Var olmayan yerel saat (ileri alma) → bir sonraki geçerli dakika, yani geçişin kendisi.
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const before = offsetAt(wall - DAY, timeZone);
  const after = offsetAt(wall + DAY, timeZone);
  const matches = [...new Set([wall - before, wall - after])]
    .filter((instant) => wallClock(instant, timeZone) === wall)
    .sort((a, b) => a - b);
  if (matches[0] !== undefined) return new Date(matches[0]);

  // İleri alma boşluğu: ofsetin değiştiği ilk dakikayı ikili aramayla bul.
  let low = wall - before - DAY; // geçişten önce
  let high = wall - after + DAY; // geçişten sonra
  while (high - low > MINUTE) {
    const mid = Math.floor((low + high) / 2 / MINUTE) * MINUTE;
    if (offsetAt(mid, timeZone) === before) low = mid;
    else high = mid;
  }
  return new Date(high);
}

/** Saatli son tarihin doğrulanması ve normalleştirilmesi. Alan adları API gövdesindeki yollardır. */
export function prepareDue(input: DueInput | null | undefined): {
  due: Due | null;
  issues: FieldIssue[];
} {
  if (!input) return { due: null, issues: [] };
  const issues: FieldIssue[] = [];
  if (!isValidDate(input.date)) issues.push({ field: 'due.date', reason: 'invalid' });
  const time = input.time ?? null;
  if (time === null) {
    // Tüm gün görevin saat dilimi yoktur (yüzen tarih).
    return {
      due: issues.length ? null : { date: input.date, time: null, timezone: null, at: null },
      issues,
    };
  }
  if (!TIME_RE.test(time)) issues.push({ field: 'due.time', reason: 'invalid' });
  const timezone = input.timezone ?? null;
  if (timezone === null) issues.push({ field: 'due.timezone', reason: 'required' });
  else if (!isValidTimezone(timezone)) issues.push({ field: 'due.timezone', reason: 'invalid' });
  if (issues.length || timezone === null) return { due: null, issues };
  return {
    due: { date: input.date, time, timezone, at: zonedTimeToUtc(input.date, time, timezone) },
    issues: [],
  };
}

/** BR-DATE-002: ikisi de doluysa başlangıç tarihi son tarihten sonra olamaz. */
export function checkStartBeforeDue(startDate: string | null, due: Due | null): FieldIssue[] {
  if (startDate !== null && !isValidDate(startDate)) {
    return [{ field: 'startDate', reason: 'invalid' }];
  }
  if (startDate !== null && due !== null && startDate > due.date) {
    return [{ field: 'startDate', reason: 'after_due_date' }];
  }
  return [];
}
