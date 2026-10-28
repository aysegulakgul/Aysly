/**
 * Görev arayüzü için tarih yardımcıları (yalnızca sunum, BR-PREF-003). Tarihler `YYYY-MM-DD` biçiminde,
 * saat diliminden bağımsız (yüzen) değerlerdir (BR-DATE-001); takvim aritmetiği UTC gün sayısıyla yapılır.
 */
const DAY = 86_400_000;

const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** BR-DATE-003: "bugün" kullanıcının saat dilimindeki takvim günüdür. */
export function todayIn(timeZone: string, now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const addDays = (date: string, days: number) => fromUtc(toUtc(date) + days * DAY);

/** 0 = Pazar … 6 = Cumartesi */
export const weekday = (date: string) => new Date(toUtc(date)).getUTCDay();

/** "Gelecek hafta": bir sonraki haftanın ilk günü (kullanıcının hafta başlangıcına göre). */
export function nextWeekStart(today: string, weekStart: number): string {
  const daysUntil = (weekStart - weekday(today) + 7) % 7 || 7;
  return addDays(today, daysUntil);
}

/** Ay görünümü: hafta başlangıcına göre hizalanmış, önceki/sonraki ay günleri boş bırakılan 7 sütunlu ızgara. */
export function monthGrid(year: number, month: number, weekStart: number): (string | null)[] {
  const first = fromUtc(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (weekday(first) - weekStart + 7) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 0; d < daysInMonth; d++) cells.push(addDays(first, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Figma "19 Eki" / "19 Eki 14:00" biçimi; saat kullanıcının saat biçimi tercihine göre. */
export function shortDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(toUtc(date));
}

export function shortTime(time: string, locale: string, timeFormat: '24h' | '12h'): string {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: timeFormat === '12h' ? 'h12' : 'h23',
    timeZone: 'UTC',
  }).format(Date.UTC(2000, 0, 1, h, m));
}

/** Haftanın gün adları (kısa), hafta başlangıcından itibaren. */
export function weekdayNames(locale: string, weekStart: number): string[] {
  const sunday = Date.UTC(2026, 0, 4); // Pazar
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
      sunday + ((weekStart + i) % 7) * DAY,
    ),
  );
}

export function monthTitle(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month, 1));
}

/** Figma "Europe/Istanbul · UTC+3". */
export function offsetLabel(timeZone: string, now: Date): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value;
  return part ? part.replace('GMT', 'UTC') : timeZone;
}

/** Ekran okuyucu için tam gün adı: "15 Ekim 2026 Perşembe". */
export function longDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(toUtc(date));
}
