import type { FieldIssue } from '@/shared/kernel/errors';
import { isValidTimezone, type Locale } from './defaults';

/** Kullanıcının değiştirebildiği tercihler (DATA_MODEL §3.5). Diğer alanlar ilgili fazlarda eklenir. */
export const THEMES = ['light', 'dark', 'system'] as const;
export const DENSITIES = ['comfortable', 'compact'] as const;
export const DATE_FORMATS = ['DD.MM.YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'] as const;
export const TIME_FORMATS = ['24h', '12h'] as const;
export const WEEK_STARTS = [0, 1, 6] as const;

export type Theme = (typeof THEMES)[number];
export type Density = (typeof DENSITIES)[number];
export type DateFormat = (typeof DATE_FORMATS)[number];
export type TimeFormat = (typeof TIME_FORMATS)[number];
export type WeekStart = (typeof WEEK_STARTS)[number];

export type Preferences = {
  locale: Locale;
  timezone: string;
  theme: Theme;
  density: Density;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  version: number;
};

/** Kısmi güncelleme; verilmeyen (undefined) alan değişmez. */
export type PreferenceChanges = {
  [K in keyof Omit<Preferences, 'version'>]?: Preferences[K] | undefined;
};

/** BR-PREF-001: saat dilimi geçerli bir IANA adı olmalıdır. Diğer alanların izinli değerleri şemada denetlenir. */
export function validatePreferenceChanges(changes: PreferenceChanges): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (changes.timezone !== undefined && !isValidTimezone(changes.timezone)) {
    issues.push({ field: 'timezone', reason: 'invalid' });
  }
  return issues;
}
