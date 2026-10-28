import { getTranslations } from 'next-intl/server';
import { NavItem } from '@/ui/components/nav';
import { getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { SignOutButton } from '../sign-out-button';

/**
 * Mobil Menü (Figma 4:69022). Kimlik bloğu, araçlar ve alt metin. Görevlerim, Projeler, Hedefler, Notlar,
 * Bildirimler, kayıtlı görünümler, Arşiv ve Çöp kutusu ait oldukları fazda eklenir.
 */
export default async function MenuPage() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations('shell')]);
  if (!viewer) return null;
  const name = viewer.user.name;
  return (
    <PageFrame title={t('menu')}>
      <div className="flex w-full items-center gap-4">
        <div
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-support-1 text-xl text-primary"
        >
          {name.trim().charAt(0).toLocaleUpperCase()}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-base font-semibold text-text">{name}</p>
          <p className="text-sm text-text-secondary">{t('personalSpace')}</p>
        </div>
      </div>
      <div className="h-px w-full bg-border" />
      <nav aria-label={t('menu')} className="flex w-full flex-col gap-2">
        <NavItem href="/my-tasks" glyph="✓">
          {t('myTasks')}
        </NavItem>
        <div className="h-px w-full bg-border" />
        <NavItem href="/settings" glyph="⚙">
          {t('settings')}
        </NavItem>
        <SignOutButton />
      </nav>
      <p className="text-sm text-text-secondary">{t('menuFooter')}</p>
    </PageFrame>
  );
}
