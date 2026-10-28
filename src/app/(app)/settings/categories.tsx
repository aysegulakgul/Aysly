'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/ui/cn';
import { NavItem } from '@/ui/components/nav';

/**
 * Figma "Settings categories" (Figma sırasıyla). Varsayılanlar, Bildirimler ve Veri ve gizlilik ait oldukları
 * fazlarda gelir.
 */
const CATEGORIES = [
  { href: '/settings/profile', glyph: '○', key: 'profile' },
  { href: '/settings/appearance', glyph: '☾', key: 'appearance' },
  { href: '/settings/date-time', glyph: '◷', key: 'dateTime' },
  { href: '/settings/security', glyph: '▣', key: 'security' },
] as const satisfies readonly { href: Route; glyph: string; key: string }[];

export function SettingsCategories() {
  const t = useTranslations('settings');
  const pathname = usePathname();
  return (
    <nav aria-label={t('categories')} className="shrink-0 lg:w-[204px]">
      {/* Masaüstü: UI/NavItem listesi (4:67733) */}
      <div className="hidden flex-col gap-1 lg:flex">
        {CATEGORIES.map((c) => (
          <NavItem key={c.href} href={c.href} glyph={c.glyph} active={pathname === c.href}>
            {t(c.key)}
          </NavItem>
        ))}
      </div>
      {/* Mobil: "Category target" düğmeleri (4:68958) */}
      <div className="flex flex-wrap gap-2 lg:hidden">
        {CATEGORIES.map((c) => {
          const active = pathname === c.href;
          return (
            <Link
              key={c.href}
              href={c.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center rounded-sm p-3 text-sm',
                active ? 'bg-support-1 text-primary' : 'bg-surface-muted text-text-secondary',
              )}
            >
              {t(c.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
