'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiPost } from '@/client/api';
import { Button } from '@/ui/components/button';
import { Banner, Toast } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Popover, PopoverClose } from '@/ui/components/popover';
import type { TaskUiContext } from '../tasks/task-context';

const BULK_LIMIT = 200; // BR-TASK-008

/** Çoklu seçim durumu: seçim modu açıkken satırlarda onay kutusu görünür. */
export function useSelection() {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set());
  return {
    active,
    ids,
    start: () => setActive(true),
    stop: () => {
      setActive(false);
      setIds(new Set());
    },
    toggle: (id: string) =>
      setIds((set) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setAll: (all: string[]) => setIds(new Set(all)),
    clear: () => setIds(new Set()),
  };
}
export type Selection = ReturnType<typeof useSelection>;

/** Satırdaki seçim kutusu (44 px dokunma alanı). */
export function SelectBox({
  selection,
  id,
  title,
}: {
  selection: Selection;
  id: string;
  title: string;
}) {
  const t = useTranslations('bulk');
  if (!selection.active) return null;
  return (
    <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
      <input
        type="checkbox"
        data-select-task
        checked={selection.ids.has(id)}
        onChange={() => selection.toggle(id)}
        aria-label={t('selectTask', { title })}
        className="size-4 accent-[var(--color-primary)]"
      />
    </label>
  );
}

/** "Seç" / "Seçimi bitir" ve "Tümünü seç" düğmeleri. */
export function SelectionToggle({ selection, all }: { selection: Selection; all: string[] }) {
  const t = useTranslations('bulk');
  return selection.active ? (
    <div className="flex gap-2">
      <Button variant="ghost" onClick={() => selection.setAll(all.slice(0, BULK_LIMIT))}>
        {t('selectAll')}
      </Button>
      <Button variant="ghost" onClick={selection.stop}>
        {t('cancel')}
      </Button>
    </div>
  ) : (
    <Button variant="ghost" data-start-selection onClick={selection.start}>
      {t('select')}
    </Button>
  );
}

type Action =
  | { action: 'complete' | 'reopen' | 'archive' | 'delete' }
  | { action: 'move'; params: { projectId: string } }
  | { action: 'setStatus'; params: { status: 'todo' | 'in_progress' | 'on_hold' } }
  | { action: 'setPriority'; params: { priority: 0 | 1 | 2 | 3 } }
  | { action: 'setDue'; params: { due: { date: string } | null } }
  | { action: 'addTags' | 'removeTags'; params: { tagNames: string[] } };

/**
 * Toplu işlem çubuğu (BR-TASK-008, D-084). İşlem atomiktir: bir görev reddedilirse hiçbiri uygulanmaz ve
 * reddedilen sayı gösterilir. Toplu silme tek "Geri al" ile geri alınır (BR-DEL-006).
 */
export function BulkBar({ selection, context }: { selection: Selection; context: TaskUiContext }) {
  const t = useTranslations('bulk');
  const tTasks = useTranslations('tasks');
  const tUi = useTranslations('ui');
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [undoBatch, setUndoBatch] = useState<string>();
  const [pending, setPending] = useState(false);
  const count = selection.ids.size;
  const base = `/api/v1/workspaces/${context.workspaceId}` as const;

  async function run(action: Action) {
    if (count > BULK_LIMIT) return setError(t('tooMany'));
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    const result = await apiPost<{ affected: number; batchId?: string }>(`${base}/tasks/bulk`, {
      ...action,
      taskIds: [...selection.ids],
    });
    setPending(false);
    if (!result.ok) {
      const failures = result.error.failures;
      setError(failures ? t('rejected', { count: failures.length }) : t('failed'));
      return;
    }
    if (result.data.batchId) {
      setUndoBatch(result.data.batchId);
      setMessage(t('deleted', { count: result.data.affected }));
    } else setMessage(t('applied', { count: result.data.affected }));
    selection.clear();
    router.refresh();
  }

  async function undo() {
    if (!undoBatch) return;
    const result = await apiPost(`${base}/trash/restore`, { batchId: undoBatch });
    setUndoBatch(undefined);
    setMessage(undefined);
    if (!result.ok) setError(t('failed'));
    router.refresh();
  }

  function submitTags(event: FormEvent<HTMLFormElement>, action: 'addTags' | 'removeTags') {
    event.preventDefault();
    const raw = new FormData(event.currentTarget).get('tags');
    const tagNames = String(raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (tagNames.length) void run({ action, params: { tagNames } });
  }

  const menuItem = 'min-h-11 w-full justify-start px-2 text-sm';
  return (
    <>
      <p role="status" aria-live="polite" className={message ? 'text-sm text-success' : 'sr-only'}>
        {message ?? ''}
      </p>
      {error ? <Banner>{error}</Banner> : null}
      {undoBatch ? (
        <div className="fixed inset-x-4 bottom-[100px] z-20 mx-auto max-w-[420px] lg:right-auto lg:bottom-6 lg:left-[264px] lg:mx-0 lg:w-[420px]">
          <Toast
            icon={<Icon name="check" />}
            message={message ?? ''}
            actionLabel={tUi('undo')}
            onAction={() => void undo()}
          />
        </div>
      ) : null}
      {selection.active && count > 0 ? (
        <div
          role="toolbar"
          aria-label={t('actions')}
          data-bulk-bar
          className="sticky bottom-[92px] z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 lg:bottom-4"
        >
          <p className="mr-2 text-sm font-medium text-text">{t('selected', { count })}</p>
          <Button
            variant="secondary"
            loading={pending}
            onClick={() => void run({ action: 'complete' })}
          >
            {t('complete')}
          </Button>
          <Popover
            label={t('move')}
            trigger={<Button variant="secondary">{t('move')}</Button>}
            className="w-[min(280px,calc(100vw-32px))]"
          >
            {context.projects.map((p) => (
              <PopoverClose asChild key={p.id}>
                <Button
                  variant="ghost"
                  className={menuItem}
                  onClick={() => void run({ action: 'move', params: { projectId: p.id } })}
                >
                  {p.name}
                </Button>
              </PopoverClose>
            ))}
          </Popover>
          <Popover label={t('status')} trigger={<Button variant="secondary">{t('status')}</Button>}>
            <PopoverClose asChild>
              <Button
                variant="ghost"
                className={menuItem}
                onClick={() => void run({ action: 'setStatus', params: { status: 'todo' } })}
              >
                {tTasks('detail.statuses.todo')}
              </Button>
            </PopoverClose>
            <PopoverClose asChild>
              <Button
                variant="ghost"
                className={menuItem}
                onClick={() => void run({ action: 'setStatus', params: { status: 'in_progress' } })}
              >
                {tTasks('detail.statuses.in_progress')}
              </Button>
            </PopoverClose>
            <PopoverClose asChild>
              <Button
                variant="ghost"
                className={menuItem}
                onClick={() => void run({ action: 'setStatus', params: { status: 'on_hold' } })}
              >
                {tTasks('detail.statuses.on_hold')}
              </Button>
            </PopoverClose>
            <PopoverClose asChild>
              <Button
                variant="ghost"
                className={menuItem}
                onClick={() => void run({ action: 'reopen' })}
              >
                {t('reopen')}
              </Button>
            </PopoverClose>
          </Popover>
          <Popover
            label={t('priority')}
            trigger={<Button variant="secondary">{t('priority')}</Button>}
          >
            {([3, 2, 1, 0] as const).map((p) => (
              <PopoverClose asChild key={p}>
                <Button
                  variant="ghost"
                  className={menuItem}
                  onClick={() => void run({ action: 'setPriority', params: { priority: p } })}
                >
                  {tTasks(`priority.${p}`)}
                </Button>
              </PopoverClose>
            ))}
          </Popover>
          <Popover label={t('due')} trigger={<Button variant="secondary">{t('due')}</Button>}>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const date = String(new FormData(e.currentTarget).get('date') ?? '');
                if (date) void run({ action: 'setDue', params: { due: { date } } });
              }}
            >
              <label className="flex flex-col gap-2 text-sm text-text-secondary">
                {t('due')}
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={context.today}
                  className="min-h-11 rounded-sm border border-border bg-page p-3 text-base text-text"
                />
              </label>
              <Button type="submit" variant="primary">
                {t('due')}
              </Button>
              <Button onClick={() => void run({ action: 'setDue', params: { due: null } })}>
                {t('clearDue')}
              </Button>
            </form>
          </Popover>
          {(['addTags', 'removeTags'] as const).map((action) => (
            <Popover
              key={action}
              label={t(action)}
              trigger={<Button variant="secondary">{t(action)}</Button>}
            >
              <form className="flex flex-col gap-2" onSubmit={(e) => submitTags(e, action)}>
                <label className="flex flex-col gap-2 text-sm text-text-secondary">
                  {t('tagNames')}
                  <input
                    name="tags"
                    required
                    className="min-h-11 rounded-sm border border-border bg-page p-3 text-base text-text"
                  />
                </label>
                <Button type="submit" variant="primary">
                  {t(action)}
                </Button>
              </form>
            </Popover>
          ))}
          <Button variant="secondary" onClick={() => void run({ action: 'archive' })}>
            {t('archive')}
          </Button>
          <Button variant="danger" onClick={() => void run({ action: 'delete' })}>
            {t('delete')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
