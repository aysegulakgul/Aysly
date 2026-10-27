/** Desteklenen diller (D-038). Varsayılan Türkçe (BR-PREF-001). */
export const LOCALES = ['tr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';
export const LOCALE_COOKIE = 'aysly_locale';

export const isLocale = (value: string | undefined): value is Locale =>
  value !== undefined && (LOCALES as readonly string[]).includes(value);

/** Accept-Language başlığından desteklenen ilk dili seçer; yoksa Türkçe. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const tags = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0] ?? '', q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return (tags.find((t) => isLocale(t.lang))?.lang as Locale | undefined) ?? DEFAULT_LOCALE;
}
