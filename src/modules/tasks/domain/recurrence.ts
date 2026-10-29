import type { FieldIssue } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { isValidDate } from './due';

/**
 * Tekrar kuralı (BR-REC-003, D-087): RFC 5545 RRULE alt kümesi.
 * - FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL=1..365
 * - WEEKLY: BYDAY=MO,WE,… (yoksa planlanan günün haftanın günü)
 * - MONTHLY: BYMONTHDAY=1..31 veya BYDAY=<n><GÜN> (n = 1..4 ya da -1 "son"); yoksa planlanan günün ayın günü
 * - YEARLY: planlanan günün ayı ve günü
 * - Bitiş: UNTIL=YYYYMMDD veya COUNT=1..999 (ikisi birden olamaz)
 * Desteklenmeyen bileşen doğrulamada reddedilir.
 */
export const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const RECURRENCE_MODES = ['fixed_schedule', 'after_completion'] as const;
export type RecurrenceMode = (typeof RECURRENCE_MODES)[number];

export type RecurrenceRule = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  byDay?: Weekday[] | undefined;
  monthDay?: number | undefined;
  /** MONTHLY: ayın n. haftasının günü (n = -1 son). */
  nthWeekday?: { n: number; day: Weekday } | undefined;
  until?: string | undefined;
  count?: number | undefined;
};

/** Görevdeki tekrar bilgisi (DATA_MODEL §3.7). */
export type Recurrence = {
  rule: string;
  mode: RecurrenceMode;
  seriesId: string;
  /** BR-REC-002 "planlanan tarih": fixed_schedule hesabının dayanağı (yalnızca bu örnek kaydırılırsa değişmez). */
  anchor: string;
  /** Serideki sıra (1'den başlar); COUNT bitişi için. */
  index: number;
  generatedFrom: string | null;
};

const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
const invalid = (reason = 'invalid'): Result<never, FieldIssue> =>
  err({ field: 'recurrence.rule', reason });

export function parseRule(text: string): Result<RecurrenceRule, FieldIssue> {
  const parts = new Map<string, string>();
  for (const piece of text.replace(/^RRULE:/i, '').split(';')) {
    if (!piece) continue;
    const [key, value, extra] = piece.split('=');
    if (!key || value === undefined || extra !== undefined || parts.has(key.toUpperCase())) {
      return invalid();
    }
    parts.set(key.toUpperCase(), value.toUpperCase());
  }
  const allowed = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'UNTIL', 'COUNT']);
  if ([...parts.keys()].some((k) => !allowed.has(k))) return invalid('unsupported');
  const freq = FREQS.find((f) => f === parts.get('FREQ'));
  if (!freq) return invalid();
  const interval = Number(parts.get('INTERVAL') ?? '1');
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) return invalid();
  const rule: RecurrenceRule = { freq, interval };

  const byDay = parts.get('BYDAY');
  const monthDay = parts.get('BYMONTHDAY');
  if (byDay !== undefined) {
    if (freq === 'WEEKLY') {
      const days = byDay.split(',');
      if (!days.every((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d))) {
        return invalid();
      }
      rule.byDay = WEEKDAYS.filter((d) => days.includes(d));
    } else if (freq === 'MONTHLY' && monthDay === undefined) {
      const m = /^(-1|[1-4])(SU|MO|TU|WE|TH|FR|SA)$/.exec(byDay);
      if (!m) return invalid();
      rule.nthWeekday = { n: Number(m[1]), day: m[2] as Weekday };
    } else return invalid('unsupported');
  }
  if (monthDay !== undefined) {
    const day = Number(monthDay);
    if (freq !== 'MONTHLY' || !Number.isInteger(day) || day < 1 || day > 31) return invalid();
    rule.monthDay = day;
  }
  const until = parts.get('UNTIL');
  const count = parts.get('COUNT');
  if (until !== undefined && count !== undefined) return invalid();
  if (until !== undefined) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(until);
    const date = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
    if (!isValidDate(date)) return invalid();
    rule.until = date;
  }
  if (count !== undefined) {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 999) return invalid();
    rule.count = n;
  }
  return ok(rule);
}

/** Kuralın kanonik metni (kayıtta tutarlılık için). */
export function formatRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay?.length) parts.push(`BYDAY=${rule.byDay.join(',')}`);
  if (rule.nthWeekday) parts.push(`BYDAY=${rule.nthWeekday.n}${rule.nthWeekday.day}`);
  if (rule.monthDay) parts.push(`BYMONTHDAY=${rule.monthDay}`);
  if (rule.until) parts.push(`UNTIL=${rule.until.replaceAll('-', '')}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  return parts.join(';');
}

// --- Takvim aritmetiği (yüzen tarihler, UTC gün sayısıyla) ---
const DAY_MS = 86_400_000;
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => fromMs(toMs(date) + days * DAY_MS);
const weekdayOf = (date: string) => WEEKDAYS[new Date(toMs(date)).getUTCDay()]!;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const ymd = (y: number, m: number, d: number) => fromMs(Date.UTC(y, m, d));

/** BR-REC-005: ayda o gün yoksa ayın son günü (31 → 30/28; 29 Şubat → 28 Şubat). */
const clampedDay = (y: number, m: number, d: number) => ymd(y, m, Math.min(d, daysInMonth(y, m)));

function nthWeekdayOf(y: number, m: number, n: number, day: Weekday): string {
  const target = WEEKDAYS.indexOf(day);
  if (n === -1) {
    const last = daysInMonth(y, m);
    const lastDow = new Date(Date.UTC(y, m, last)).getUTCDay();
    return ymd(y, m, last - ((lastDow - target + 7) % 7));
  }
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  return ymd(y, m, 1 + ((target - firstDow + 7) % 7) + (n - 1) * 7);
}

/** Pazartesi başlangıçlı hafta numarası (RFC 5545 varsayılan WKST=MO). */
const weekIndex = (date: string) => Math.floor((toMs(date) / DAY_MS + 3) / 7);

/** `base` tarihine göre hizalı, `after` tarihinden sonraki ilk örnek. */
function nextAligned(rule: RecurrenceRule, base: string, after: string): string {
  const [by, bm, bd] = base.split('-').map(Number) as [number, number, number];
  const bMonth = bm - 1;
  switch (rule.freq) {
    case 'DAILY': {
      const step = rule.interval;
      const gap = Math.floor((toMs(after) - toMs(base)) / DAY_MS);
      const k = gap < 0 ? 1 : Math.floor(gap / step) + 1;
      return addDays(base, Math.max(1, k) * step);
    }
    case 'WEEKLY': {
      const days = rule.byDay?.length ? rule.byDay : [weekdayOf(base)];
      const baseWeek = weekIndex(base);
      for (let d = addDays(after, 1), i = 0; i < 7 * 400; i++, d = addDays(d, 1)) {
        if ((weekIndex(d) - baseWeek) % rule.interval === 0 && days.includes(weekdayOf(d))) {
          return d;
        }
      }
      throw new Error('tekrar hesaplanamadı');
    }
    case 'MONTHLY':
    case 'YEARLY': {
      const stepMonths = rule.freq === 'MONTHLY' ? rule.interval : rule.interval * 12;
      for (let k = 0; k < 1200; k++) {
        const total = bMonth + k * stepMonths;
        const y = by + Math.floor(total / 12);
        const m = ((total % 12) + 12) % 12;
        const candidate =
          rule.freq === 'YEARLY'
            ? clampedDay(y, bMonth, bd)
            : rule.nthWeekday
              ? nthWeekdayOf(y, m, rule.nthWeekday.n, rule.nthWeekday.day)
              : clampedDay(y, m, rule.monthDay ?? bd);
        if (candidate > after) return candidate;
      }
      throw new Error('tekrar hesaplanamadı');
    }
  }
}

/**
 * BR-REC-002: tamamlanınca üretilecek sonraki örneğin tarihi; seri bittiyse null.
 * - fixed_schedule: planlanan tarihten (anchor) sonraki ilk örnek; geçmişte kalanlar atlanır, bugün veya sonrası
 *   seçilir.
 * - after_completion: tamamlanma gününden (kullanıcının saat dilimindeki bugün) sonraki ilk örnek.
 * Bitiş: UNTIL'den sonraki tarih veya COUNT'a ulaşılmışsa null.
 */
export function nextOccurrence(
  rule: RecurrenceRule,
  mode: RecurrenceMode,
  context: { anchor: string; index: number; today: string },
): string | null {
  if (rule.count !== undefined && context.index >= rule.count) return null;
  let next: string;
  if (mode === 'after_completion') {
    next = nextAligned(rule, context.today, context.today);
  } else {
    next = nextAligned(rule, context.anchor, context.anchor);
    if (next < context.today) next = nextAligned(rule, context.anchor, addDays(context.today, -1));
  }
  if (rule.until !== undefined && next > rule.until) return null;
  return next;
}
