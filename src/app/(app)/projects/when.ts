import { shortDate, shortTime, todayIn } from '../tasks/dates';

/**
 * "Son güncelleme" metni (Figma 4:67037: "Bugün, 08:45", "Dün, 18:20"): kullanıcının saat diliminde; daha eskiyse
 * kısa tarih. Yalnızca sunum (BR-PREF-003).
 */
export function updatedWhen(
  iso: string,
  options: {
    locale: string;
    timezone: string;
    timeFormat: '24h' | '12h';
    today: (time: string) => string;
    yesterday: (time: string) => string;
  },
): string {
  const instant = new Date(iso);
  const date = todayIn(options.timezone, instant);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: options.timezone,
  }).format(instant);
  const shown = shortTime(time, options.locale, options.timeFormat);
  const now = new Date();
  const today = todayIn(options.timezone, now);
  const yesterday = todayIn(options.timezone, new Date(now.getTime() - 86_400_000));
  if (date === today) return options.today(shown);
  if (date === yesterday) return options.yesterday(shown);
  return shortDate(date, options.locale);
}
