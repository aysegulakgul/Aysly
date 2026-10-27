/**
 * BR-PREF-001: Kayıtta tarayıcıdan gelen dil ve saat diliminden varsayılan tercihler üretilir.
 * Dil `tr` ise hafta pazartesi başlar, tarih GG.AA.YYYY, saat 24 saattir. Tema: sistem.
 */
export type Locale = 'tr' | 'en';

export type PreferenceDefaults = {
  locale: Locale;
  timezone: string;
  theme: 'system';
  density: 'comfortable';
  dateFormat: 'DD.MM.YYYY' | 'MM/DD/YYYY';
  timeFormat: '24h' | '12h';
  weekStart: 0 | 1;
  defaultTaskView: 'list';
  startPage: 'dashboard';
  allDayReminderTime: '09:00';
  dashboardLayout: { v: 1; widgets: { id: string; visible: boolean }[] };
  notificationSettings: { v: 1; reminder: { inApp: true } };
  onboarding: { v: 1 };
};

export const FALLBACK_TIMEZONE = 'Europe/Istanbul';

/** IANA saat dilimi adı geçerli mi? (BR-PREF-001: geçersizse Europe/Istanbul) */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** ONBOARDING §3 "Atlandı" satırındaki varsayılan widget sırası; onboarding cevabına göre Faz 3'te yeniden düzenlenir. */
export const DEFAULT_WIDGETS = ['today', 'overdue', 'upcoming', 'priority', 'projects', 'goals'];

export function defaultPreferences(input: {
  locale: Locale;
  timezone: string | undefined;
}): PreferenceDefaults {
  const timezone =
    input.timezone && isValidTimezone(input.timezone) ? input.timezone : FALLBACK_TIMEZONE;
  const tr = input.locale === 'tr';
  return {
    locale: input.locale,
    timezone,
    theme: 'system',
    density: 'comfortable',
    dateFormat: tr ? 'DD.MM.YYYY' : 'MM/DD/YYYY',
    timeFormat: tr ? '24h' : '12h',
    weekStart: tr ? 1 : 0,
    defaultTaskView: 'list',
    startPage: 'dashboard',
    allDayReminderTime: '09:00',
    dashboardLayout: { v: 1, widgets: DEFAULT_WIDGETS.map((id) => ({ id, visible: true })) },
    notificationSettings: { v: 1, reminder: { inApp: true } },
    onboarding: { v: 1 },
  };
}
