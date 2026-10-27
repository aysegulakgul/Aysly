import type { ReactNode } from 'react';
import { cn } from '../cn';

/** Figma UI/Chip (4:70681 etiket, 4:70690 devam ediyor, 4:70695 yüksek, 4:70700 bugün, 4:70705 tamamlandı). */
export type ChipTone = 'neutral' | 'progress' | 'danger' | 'warning' | 'success';

const TONE: Record<ChipTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary',
  progress: 'bg-support-1 text-primary',
  danger: 'bg-surface-muted text-danger',
  warning: 'bg-surface-muted text-warning',
  success: 'bg-surface-muted text-success',
};

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-start gap-1 rounded-sm border border-border px-2 py-1 text-xs whitespace-nowrap',
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}
