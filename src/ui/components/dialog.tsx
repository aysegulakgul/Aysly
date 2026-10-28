'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

/**
 * Onay penceresi (Figma "Görevi tamamla" 4:69469, "Projeyi çöpe taşı" 4:69484): UI/Panel görünümü, başlık,
 * açıklama ve eylemler. Radix ile odak hapsi, Esc ile kapanma ve odak geri dönüşü.
 */
export function Dialog({
  open,
  onOpenChange,
  context,
  title,
  description,
  footnote,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: string | undefined;
  title: string;
  description?: string | undefined;
  footnote?: string | undefined;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <RadixDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-md border border-border bg-surface p-5 text-text">
          {context ? <p className="text-xs text-text-secondary">{context}</p> : null}
          <RadixDialog.Title className="text-lg font-semibold text-text">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="text-sm text-text-secondary">
              {description}
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          <div className="flex flex-col items-start gap-2">{children}</div>
          {footnote ? (
            <p className="border-t border-border pt-3 text-xs text-text-secondary">{footnote}</p>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
