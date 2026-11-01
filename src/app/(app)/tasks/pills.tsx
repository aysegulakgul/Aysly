import { cn } from '@/ui/cn';
import { PROJECT_COLOR_VALUES, type ProjectColorName } from '../projects/project-color';

/**
 * D-100: renkli rozetler (ürün sahibinin ekran görüntüleri). Dolgu 12 renklik paletten, yazı koyu: açık ve koyu temada
 * ≥ 4.5:1 kontrast. Renk anlamı tek başına taşımaz; rozet her zaman metin içerir (UI_UX §2).
 */
const hex = (color: string) =>
  PROJECT_COLOR_VALUES[color as ProjectColorName] ?? PROJECT_COLOR_VALUES.slate;

export function Pill({
  color,
  children,
  className,
}: {
  color: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-sm px-1.5 py-0.5 text-xs font-medium text-[#111]',
        className,
      )}
      style={{ backgroundColor: hex(color) }}
    >
      {children}
    </span>
  );
}

/** BR-TASK-005: 3 yüksek, 2 orta, 1 düşük. */
export const PRIORITY_COLOR: Record<number, string> = { 3: 'red', 2: 'amber', 1: 'teal' };
/** BR-TASK-003 */
export const STATUS_COLOR: Record<string, string> = {
  todo: 'slate',
  in_progress: 'blue',
  on_hold: 'amber',
  done: 'green',
};

/** Avatardaki baş harfler: ilk iki kelimenin ilk harfleri (Türkçe büyük harf kuralıyla). */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase('tr'))
    .join('');

/** D-097: kişi avatarı (baş harfler, kişinin rengi). */
export function Avatar({
  name,
  color,
  size = 'md',
}: {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-[#111]',
        size === 'sm' ? 'size-5 text-[10px]' : 'size-7 text-xs',
      )}
      style={{ backgroundColor: hex(color) }}
    >
      {initials(name)}
    </span>
  );
}

/** Atanmamış görev için boş avatar. */
export function EmptyAvatar() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-text-secondary text-xs text-text-secondary"
    >
      ◌
    </span>
  );
}
