import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { getCurrentUser } from '@/modules/identity';
import { findUserLocale } from '@/modules/preferences';
import { db } from '@/shared/db/client';
import { LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from './config';

/**
 * Dil seçimi: oturum açıksa kullanıcının dil tercihi (BR-PREF-002), değilse dil çerezi, o da yoksa tarayıcı dili.
 * URL'de dil öneki kullanılmaz.
 */
async function resolveLocale(): Promise<Locale> {
  const user = await getCurrentUser();
  if (user) return findUserLocale(db(), user.id);
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(cookieLocale)
    ? cookieLocale
    : negotiateLocale((await headers()).get('accept-language'));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
