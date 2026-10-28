import Link from 'next/link';
import type { Route } from 'next';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

/**
 * Figma UI/NavItem (4:71871, etkin hali 4:67716): satır yüksekliği (rahat 44 px, sıkı masaüstünde 32 px),
 * 12 px yatay boşluk, 6 px köşe, 13 px orta kalınlık. Etkin: support-1 zemin, birincil renk metin.
 * Figma'daki işaret karakteri (ör. "☼") metnin parçasıdır ve ekran okuyucudan gizlenir.
 */
const navItemClass = (active: boolean) =>
  cn(
    'flex h-row w-full items-center gap-2 rounded-sm px-3 text-sm font-medium',
    active ? 'bg-support-1 text-primary' : 'text-text-secondary',
  );

function NavLabel({ glyph, children }: { glyph?: string | undefined; children: ReactNode }) {
  return (
    <span className="flex-1 whitespace-pre-wrap">
      {glyph ? <span aria-hidden="true">{`${glyph}  `}</span> : null}
      {children}
    </span>
  );
}

/** `count`: Figma'daki sağa yaslı 12 px sayı (ör. Inbox rozeti, BR-INBOX-003); `countLabel` ekran okuyucu metnidir. */
export function NavItem({
  href,
  glyph,
  active = false,
  count,
  countLabel,
  children,
}: {
  href: Route;
  glyph?: string;
  active?: boolean;
  count?: string | undefined;
  countLabel?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={navItemClass(active)}>
      <NavLabel glyph={glyph}>{children}</NavLabel>
      {count ? (
        <span className="text-xs font-normal text-text-secondary">
          <span aria-hidden="true">{count}</span>
          {countLabel ? <span className="sr-only">{countLabel}</span> : null}
        </span>
      ) : null}
    </Link>
  );
}

/** Aynı görünümde eylem düğmesi (ör. çıkış). */
export function NavButton({
  glyph,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { glyph?: string }) {
  return (
    <button type="button" className={cn(navItemClass(false), 'text-left')} {...rest}>
      <NavLabel glyph={glyph}>{children}</NavLabel>
    </button>
  );
}

/** Figma UI/BottomNav (4:71103): 84 px yükseklik, yüzey zemini, üst kenarlık; öğe başına 22 px işaret + 12 px etiket. */
export function BottomNav({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="flex h-[84px] w-full items-start border-t border-border bg-surface px-2 pt-2 pb-5"
    >
      {children}
    </nav>
  );
}

export function BottomNavItem({
  href,
  glyph,
  active = false,
  accent = false,
  children,
}: {
  href: Route;
  glyph: string;
  active?: boolean;
  /** Figma'da "Ekle" öğesi her zaman birincil renktedir (4:69079). */
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 flex-1 flex-col items-center text-center',
        active || accent ? 'text-primary' : 'text-text-secondary',
      )}
    >
      <span aria-hidden="true" className="text-[22px] leading-6">
        {glyph}
      </span>
      <span className="text-xs leading-6">{children}</span>
    </Link>
  );
}
