'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiPatch, apiPost } from '@/client/api';
import type { TaskView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Popover } from '@/ui/components/popover';
import { cn } from '@/ui/cn';
import { DatePickerPanel } from './date-picker';
import type { TaskUiContext } from './task-context';

/**
 * Figma "Projeye taşı" (4:69344): proje arama ve liste; mevcut proje vurgulu. BR-INBOX-002: yalnızca proje
 * değişir, diğer alanlar korunur.
 */
export function MoveToProject({
  task,
  context,
  onMoved,
  trigger,
}: {
  task: Pick<TaskView, 'id' | 'title' | 'version' | 'projectId'>;
  context: TaskUiContext;
  onMoved?: (projectName: string) => void;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations('tasks.move');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string>();
  const matches = context.projects.filter((p) =>
    p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  async function move(project: TaskUiContext['projects'][number]) {
    if (project.id === task.projectId) return setOpen(false);
    const result = await apiPost(
      `/api/v1/workspaces/${context.workspaceId}/tasks/${task.id}/move`,
      {
        version: task.version,
        projectId: project.id,
      },
    );
    if (!result.ok) return setError(result.error.message);
    setOpen(false);
    onMoved?.(project.name);
    router.refresh();
  }

  return (
    <Popover
      label={t('title')}
      open={open}
      onOpenChange={setOpen}
      trigger={
        trigger ?? (
          <Button variant="ghost" className="text-sm text-primary">
            {t('button')} <span aria-hidden="true">↗</span>
          </Button>
        )
      }
    >
      <div className="flex w-[min(300px,calc(100vw-64px))] flex-col gap-3">
        <p className="text-sm font-medium text-text">{t('title')}</p>
        <p className="truncate text-xs text-text-secondary">{task.title}</p>
        <label className="flex flex-col gap-2 text-sm text-text-secondary">
          {t('search')}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeholder')}
            className="min-h-11 rounded-sm border border-border bg-page p-3 text-base text-text"
          />
        </label>
        <ul className="flex flex-col">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => void move(p)}
                aria-current={p.id === task.projectId ? 'true' : undefined}
                className={cn(
                  'flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm',
                  p.id === task.projectId ? 'bg-support-1 text-primary' : 'text-text',
                )}
              >
                <span aria-hidden="true">{'▱  '}</span>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        {matches.length === 0 ? <p className="text-sm text-text-secondary">{t('empty')}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <p className="text-xs text-text-secondary">{t('hint')}</p>
      </div>
    </Popover>
  );
}

/** Mobil Inbox satırındaki "Tarih ver" (Figma 4:68036): tarih seçiciyle son tarih atar. */
export function GiveDate({
  task,
  context,
}: {
  task: Pick<TaskView, 'id' | 'version' | 'due'>;
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      label={t('date.title')}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" className="text-sm">
          <span aria-hidden="true">▦</span> {t('giveDate')}
        </Button>
      }
    >
      <DatePickerPanel
        value={task.due}
        timezone={context.timezone}
        weekStart={context.weekStart}
        onApply={async (due) => {
          setOpen(false);
          await apiPatch(`/api/v1/workspaces/${context.workspaceId}/tasks/${task.id}`, {
            version: task.version,
            due,
          });
          router.refresh();
        }}
      />
    </Popover>
  );
}
