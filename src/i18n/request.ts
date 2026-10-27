import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, isLocale, negotiateLocale } from './config';

/**
 * Dil seçimi: önce kullanıcının seçtiği dil (çerez; Faz 3'te kullanıcı tercihinden), yoksa tarayıcı dili.
 * URL'de dil öneki kullanılmaz.
 */
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : negotiateLocale((await headers()).get('accept-language'));
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
