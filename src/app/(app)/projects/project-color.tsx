import { cn } from '@/ui/cn';

/**
 * D-082 / UI_UX §2.4: 12 renklik proje paleti. Figma'da proje rengi yok; tonlar açık ve koyu zeminde ≥ 3:1
 * kontrastlı orta tonlar olarak seçildi ve ürün sahibinin onayına sunuldu. Renk yalnızca süs olarak kullanılır;
 * anlamı her zaman proje adı taşır (UI_UX §2: renk tek başına anlam taşımaz).
 */
export const PROJECT_COLOR_VALUES = {
  slate: '#7c8799',
  red: '#e5534b',
  orange: '#e8833a',
  amber: '#d9a520',
  green: '#3fae6a',
  teal: '#2aa39a',
  cyan: '#2fa8c9',
  blue: '#4a8ae8',
  indigo: '#7a7ff0',
  violet: '#9a6ee6',
  pink: '#e05f9e',
  brown: '#a77b52',
} as const;

export type ProjectColorName = keyof typeof PROJECT_COLOR_VALUES;
export const PROJECT_COLOR_NAMES = Object.keys(PROJECT_COLOR_VALUES) as ProjectColorName[];

const valueOf = (color: string) =>
  PROJECT_COLOR_VALUES[color as ProjectColorName] ?? PROJECT_COLOR_VALUES.slate;

/** Kenar çubuğu ve başlıktaki renk noktası (Figma'daki "○" işaretinin yerinde). */
export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: valueOf(color) }}
    />
  );
}
