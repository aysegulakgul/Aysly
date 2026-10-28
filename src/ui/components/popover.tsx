'use client';

import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '../cn';

/**
 * Açılır panel (UI_UX §6 Popover/Menu): Radix ile klavye ve odak yönetimi; görünüm Figma UI/Panel token'larıyla
 * (yüzey zemini, 1 px kenarlık, 10 px köşe). İçerik Esc ile kapanır, odak tetikleyiciye döner.
 */
export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  label,
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <RadixPopover.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          aria-label={label}
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className={cn(
            'z-50 flex max-h-[min(80dvh,560px)] flex-col gap-3 overflow-y-auto rounded-md border border-border bg-surface p-4 text-text',
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export const PopoverClose = RadixPopover.Close;
