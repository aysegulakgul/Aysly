import type { ReactNode } from 'react';

/** Figma UI/Banner (4:70876): sol 3 px bilgi kenarı, ikon + metin. */
export function Banner({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex w-full items-center gap-3 border-l-[3px] border-info bg-surface-muted p-3 text-sm text-info"
    >
      {icon}
      <p className="flex-1">{children}</p>
    </div>
  );
}

/** Figma UI/Toast/Undo (4:70886). Görünüm bileşenidir; süre ve yığınlama davranışı ilk kullanıldığı fazda eklenir. */
export function Toast({
  icon,
  message,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex min-h-14 w-full items-center gap-4 rounded-md border border-border bg-surface-muted p-4"
    >
      {icon}
      <p className="flex-1 text-sm text-text">{message}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="text-sm font-medium text-primary">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Figma UI/Skeleton (4:70905): 44 px satır, 24 px durum yer tutucusu, 12 px başlık çubuğu. */
export function SkeletonRows({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex w-full flex-col gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-4">
          <div className="size-6 shrink-0 rounded-sm bg-border" />
          <div className="h-3 flex-1 rounded-sm bg-border" />
        </div>
      ))}
    </div>
  );
}

/** Figma UI/EmptyState (4:69699): 32 px ikon, başlık, açıklama, tek eylem. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-4 px-5 py-10 text-center">
      {icon}
      <p className="text-lg font-semibold text-text">{title}</p>
      <p className="text-base text-text-secondary">{description}</p>
      {action}
    </div>
  );
}
