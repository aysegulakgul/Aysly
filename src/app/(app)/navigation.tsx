'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/ui/components/icon';
import { BottomNav, BottomNavItem, NavItem } from '@/ui/components/nav';
import { SignOutButton } from './sign-out-button';

function useSection() {
  const pathname = usePathname();
  return {
    today: pathname === '/',
    settings: pathname.startsWith('/settings'),
    menu: pathname === '/menu',
  };
}

const Divider = () => <div className="h-px w-full shrink-0 bg-border" />;

/** Figma UI/Sidebar (4:66491): 232 px, surface-muted zemin, 16 px iç boşluk, 12 px aralık. */
export function Sidebar({ userName }: { userName: string }) {
  const t = useTranslations('shell');
  const section = useSection();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-3 overflow-y-auto bg-surface-muted p-4 lg:flex">
      <div className="flex h-11 w-full items-center gap-2.5">
        <Icon name="moon" tone="primary" />
        <p className="flex-1 text-xl font-semibold text-text">aysly</p>
      </div>
      <nav aria-label={t('mainNav')} className="flex w-full flex-col gap-3">
        <NavItem href="/" glyph="☼" active={section.today}>
          {t('today')}
        </NavItem>
        <Divider />
        <NavItem href="/settings" glyph="⚙" active={section.settings}>
          {t('settings')}
        </NavItem>
      </nav>
      <Divider />
      <p className="w-full text-sm whitespace-pre-wrap text-text-secondary">
        <span aria-hidden="true">{'◉  '}</span>
        {`${userName} · ${t('personal')}`}
      </p>
      <SignOutButton />
    </aside>
  );
}

/** Figma UI/BottomNav (4:69074). Ekle, Inbox ve Takvim öğeleri ait oldukları fazda eklenir. */
export function MobileNavigation() {
  const t = useTranslations('shell');
  const section = useSection();
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 lg:hidden">
      <BottomNav label={t('bottomNav')}>
        <BottomNavItem href="/" glyph="☼" active={section.today}>
          {t('today')}
        </BottomNavItem>
        <BottomNavItem href="/menu" glyph="☰" active={section.menu}>
          {t('menu')}
        </BottomNavItem>
      </BottomNav>
    </div>
  );
}
