'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { apiDelete, apiPatch } from '@/client/api';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';

/** Geri alma isteği: açık "Geri al" bildirimi olan bileşen dinler (BR-TASK-004). */
export const UNDO_EVENT = 'aysly:undo';

const GO: Record<string, Route> = { d: '/', i: '/inbox', m: '/my-tasks', u: '/upcoming' };
const FIELD: Record<string, string> = { t: 'due', m: 'project', l: 'tags' };

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const rows = () => [...document.querySelectorAll<HTMLAnchorElement>('main [data-task-link]')];
const focusedRow = () =>
  document.activeElement instanceof HTMLElement
    ? document.activeElement.closest<HTMLElement>('[data-task-row]')
    : null;

const LIST: [string, string][] = [
  ['Q', 'q'],
  ['G D', 'gd'],
  ['G I', 'gi'],
  ['G M', 'gm'],
  ['G U', 'gu'],
  ['J / K · ↓ / ↑', 'jk'],
  ['Enter', 'enter'],
  ['Ctrl/⌘ + Enter', 'complete'],
  ['T', 't'],
  ['M', 'm'],
  ['L', 'l'],
  ['Del', 'del'],
  ['Ctrl/⌘ + Z', 'undo'],
  ['?', 'help'],
];

/**
 * Temel klavye kısayolları (UI_UX §11). Metin alanı odaktayken tek harfli kısayollar çalışmaz. Arama
 * (Ctrl/⌘ + K, Faz 7), Takvim ve Projeler (G C / G P, Faz 5–6) ilgili fazlarda eklenir. Rehber Figma'da yok
 * (D-065): Figma UI/Dialog ile.
 */
export function KeyboardShortcuts({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('shortcuts');
  const router = useRouter();
  const pathname = usePathname();
  const [help, setHelp] = useState(false);
  const pendingG = useRef<number>(0);

  useEffect(() => {
    async function onKey(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z' && !isTyping(event.target)) {
        window.dispatchEvent(new Event(UNDO_EVENT));
        return;
      }
      if (mod && event.key === 'Enter') {
        const row = focusedRow();
        if (row) {
          event.preventDefault();
          row.querySelector<HTMLButtonElement>('[data-complete]')?.click();
        }
        return;
      }
      if (mod || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();

      if (Date.now() - pendingG.current < 1200 && GO[key]) {
        pendingG.current = 0;
        router.push(GO[key]);
        return;
      }
      if (key === 'g') {
        pendingG.current = Date.now();
        return;
      }
      if (event.key === '?') {
        setHelp(true);
        void apiPatch('/api/v1/me/onboarding/checklist', { shortcutsSeen: true });
        return;
      }
      if (key === 'q') {
        event.preventDefault();
        router.push('/inbox?add=1');
        return;
      }
      if (['j', 'k', 'arrowdown', 'arrowup'].includes(key)) {
        const list = rows();
        if (list.length === 0) return;
        event.preventDefault();
        const current = list.indexOf(document.activeElement as HTMLAnchorElement);
        const step = key === 'j' || key === 'arrowdown' ? 1 : -1;
        const next = current < 0 ? 0 : Math.min(list.length - 1, Math.max(0, current + step));
        list[next]?.focus();
        return;
      }
      const row = focusedRow();
      const id = row?.dataset.taskId;
      if (!id) return;
      if (FIELD[key]) {
        event.preventDefault();
        router.push(`${pathname}?task=${id}&focus=${FIELD[key]}` as Route, { scroll: false });
      } else if (event.key === 'Delete') {
        event.preventDefault();
        await apiDelete(`/api/v1/workspaces/${workspaceId}/tasks/${id}`);
        router.refresh();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, pathname, workspaceId]);

  return (
    <Dialog open={help} onOpenChange={setHelp} title={t('title')} description={t('description')}>
      <dl className="grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {LIST.map(([keys, label]) => (
          <div key={label} className="contents">
            <dt>
              <kbd className="rounded-sm border border-border bg-surface-muted px-2 py-0.5 text-xs text-text">
                {keys}
              </kbd>
            </dt>
            <dd className="text-text">{t(`items.${label}`)}</dd>
          </div>
        ))}
      </dl>
      <Button onClick={() => setHelp(false)}>{t('close')}</Button>
    </Dialog>
  );
}
