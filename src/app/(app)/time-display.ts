/**
 * Kullanıcının saat diliminde ekran metinleri (BR-PREF-003: yalnızca sunum). "Bugün" hesabı ve tarih modeli
 * görevlerle birlikte Faz 4'te domain katmanına gelir.
 */
export type DayPart = 'morning' | 'day' | 'evening' | 'night';

/** Selamlama için günün bölümü: 05–12 sabah, 12–18 gün, 18–22 akşam, 22–05 gece. */
export function dayPart(now: Date, timeZone: string): DayPart {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now),
  );
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** Figma "15 Ekim 2026" / "15 Ekim 2026 Perşembe" biçimi. */
export function longDate(now: Date, locale: string, timeZone: string, withWeekday = false): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withWeekday ? { weekday: 'long' } : {}),
    timeZone,
  }).format(now);
}

/** IANA adındaki şehir: "Europe/Istanbul" → "Istanbul", "America/New_York" → "New York". */
export function timeZoneCity(timeZone: string): string {
  return (timeZone.split('/').pop() ?? timeZone).replaceAll('_', ' ');
}

/** Selamlamada adın ilk sözcüğü kullanılır (Figma "Günaydın, Elif"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
