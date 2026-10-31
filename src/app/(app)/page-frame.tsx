import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { findContacts } from '@/modules/contacts';
import { getPersonalScope, getViewer } from '../viewer';
import { NotificationBell } from './notifications/notification-center';
import { MobileSearchButton } from './search/mobile-search-button';
import { ShareButton } from './share-button';
import { longDate, timeZoneCity } from './time-display';

/**
 * Sayfa çerçevesi. Masaüstü: Figma "Workspace header" (4:66519) — 72 px, "Kişisel / Sayfa", sağda tarih ve
 * saat dilimi şehri; içerik 32 px boşluklu, en fazla 960 px. Mobil: Figma "Page header" (4:69029) — 64 px başlık,
 * içerik 20 px boşluklu.
 */
export async function PageFrame({
  title,
  wide = false,
  children,
}: {
  title: string;
  /** UI_UX §4: takvim ve pano tam genişlik; liste sayfaları en fazla 960 px. */
  wide?: boolean;
  children: ReactNode;
}) {
  const [viewer, scope, locale, t] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getLocale(),
    getTranslations('shell'),
  ]);
  const people = scope ? await findContacts(scope) : [];
  const timeZone = viewer?.preferences.timezone ?? 'UTC';
  return (
    <>
      <header className="hidden h-[72px] w-full shrink-0 items-center gap-3 border-b border-border px-8 lg:flex">
        <p className="text-sm text-text-secondary">{`${t('personal')} /`}</p>
        <p className="flex-1 text-sm font-medium text-text">{title}</p>
        <p className="text-xs text-text-secondary">
          {`${longDate(new Date(), locale, timeZone)} · ${timeZoneCity(timeZone)}`}
        </p>
        {/* D-100: bildirimler ve paylaş sağ üst başlıkta. */}
        <NotificationBell timezone={timeZone} />
        <ShareButton people={people} title={title} />
      </header>
      <header className="flex h-16 w-full shrink-0 items-center gap-3 border-b border-border px-5 lg:hidden">
        <p className="flex-1 text-xl font-semibold text-text">{title}</p>
        {/* Bildirim merkezi mobilde başlıkta (FR-NOTIF-01; Figma mobil başlıkta zil yok, D-065). */}
        <MobileSearchButton />
        <NotificationBell timezone={timeZone} />
        <ShareButton people={people} title={title} />
      </header>
      <main className="flex w-full flex-col items-center p-5 lg:p-8">
        <div
          className={
            wide ? 'flex w-full flex-col gap-6' : 'flex w-full max-w-[960px] flex-col gap-6'
          }
        >
          {children}
        </div>
      </main>
    </>
  );
}
