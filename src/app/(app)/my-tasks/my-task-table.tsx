'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type KeyboardEvent } from 'react';
import { apiPost } from '@/client/api';
import type { TaskView } from '@/modules/tasks';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { cn } from '@/ui/cn';
import { shortDate } from '../tasks/dates';
import { Avatar, EmptyAvatar, Pill, PRIORITY_COLOR, STATUS_COLOR } from '../tasks/pills';
import { useTaskCompletion } from '../tasks/task-actions';
import type { TaskUiContext } from '../tasks/task-context';
import { isOverdue } from '../tasks/task-row';
import { MoveToProject } from '../tasks/row-actions';
import { BulkBar, SelectBox, SelectionToggle, useSelection } from '../views/bulk-bar';

export type TaskSection = {
  key: string;
  title: string;
  /** Bölüme eklenen görevin projesi ve tarihi (D-098: bölümdeki "Görev ekle"). */
  add: { projectId?: string | undefined; dueDate?: string | undefined };
  tasks: TaskView[];
};

const GRID =
  'lg:grid lg:grid-cols-[minmax(0,1fr)_150px_110px_130px_96px_120px_64px] lg:items-center';
const CELL = 'hidden min-w-0 border-l border-border px-3 lg:flex lg:h-full lg:items-center';

/**
 * Görevlerim listesi (D-098, D-100; ürün sahibinin ekran görüntüsü): katlanabilir bölümler, sütunlar (Ad, Atanan,
 * Son tarih, Proje, Öncelik, Statü, Puan), bölüm başına "Görev ekle" ve story point toplamı (BR-TASK-011).
 * Mobilde satırlar başlık + rozet şeridi olarak akar.
 */
export function MyTaskTable({
  sections,
  context,
}: {
  sections: TaskSection[];
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks');
  const locale = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const completion = useTaskCompletion(context);
  // BR-TASK-008 / AC-02: çoklu seçim ve toplu işlemler (eski Inbox listesindeki gibi).
  const selection = useSelection();
  const [moved, setMoved] = useState<string>();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const href = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('task', id);
    return `${pathname}?${next}` as Route;
  };
  const visible = sections.map((s) => ({
    ...s,
    tasks: s.tasks.filter((task) => !completion.hidden.has(task.id)),
  }));
  const total = visible.reduce((n, s) => n + s.tasks.length, 0);

  return (
    <div className="flex w-full flex-col">
      {completion.ui}
      <p role="status" aria-live="polite" className={moved ? 'text-sm text-success' : 'sr-only'}>
        {moved ? `✓ ${moved}` : ''}
      </p>
      {total > 0 ? (
        <div className="flex justify-end pb-2">
          <SelectionToggle
            selection={selection}
            all={visible.flatMap((s) => s.tasks.map((task) => task.id))}
          />
        </div>
      ) : null}
      <div
        className={cn(
          GRID,
          'hidden h-10 border-y border-border text-xs text-text-secondary lg:grid',
        )}
      >
        <span className="px-3">{t('table.name')}</span>
        <span className={CELL}>{t('table.assignee')}</span>
        <span className={CELL}>{t('table.due')}</span>
        <span className={CELL}>{t('table.project')}</span>
        <span className={CELL}>{t('table.priority')}</span>
        <span className={CELL}>{t('table.status')}</span>
        <span className={cn(CELL, 'justify-end')}>{t('table.points')}</span>
      </div>
      {total === 0 && sections.every((s) => s.tasks.length === 0) ? (
        <div className="py-6">
          <EmptyState
            icon={<Icon name="inbox" />}
            title={t('myTasks.emptyTitle')}
            description={t('myTasks.emptyDescription')}
          />
        </div>
      ) : null}
      {visible.map((section) => {
        const open = !collapsed.has(section.key);
        const points = section.tasks.reduce((n, task) => n + (task.storyPoints ?? 0), 0);
        return (
          <section
            key={section.key}
            aria-labelledby={`section-${section.key}`}
            className="flex flex-col"
          >
            <h2 id={`section-${section.key}`} className="mt-4 flex min-h-11 items-center">
              <button
                type="button"
                onClick={() => toggle(section.key)}
                aria-expanded={open}
                aria-label={
                  open
                    ? t('myTasks.collapse', { group: section.title })
                    : t('myTasks.expand', { group: section.title })
                }
                className="flex min-h-11 flex-1 items-center gap-2 text-left text-base font-semibold text-text"
              >
                <span className={open ? '' : '-rotate-90'}>
                  <Icon name="chevron-down" />
                </span>
                <span>{section.title}</span>
                <span className="text-sm font-normal text-text-secondary">
                  {section.tasks.length}
                </span>
              </button>
            </h2>
            {open ? (
              <>
                <ul className="flex flex-col border-t border-border">
                  {section.tasks.map((task) => {
                    const overdue = isOverdue(task, context.today);
                    return (
                      <li
                        key={task.id}
                        data-task-row
                        data-task-id={task.id}
                        className={cn(
                          GRID,
                          'group flex min-h-11 flex-col gap-1 border-b border-border py-2 hover:bg-surface-muted lg:min-h-10 lg:gap-0 lg:py-0',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2 px-3">
                          <SelectBox selection={selection} id={task.id} title={task.title} />
                          <button
                            type="button"
                            data-complete
                            onClick={() => completion.complete(task)}
                            aria-label={t('row.complete', { title: task.title })}
                            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-text-secondary text-xs text-transparent hover:border-success hover:text-success"
                          >
                            ✓
                          </button>
                          <Link
                            href={href(task.id)}
                            scroll={false}
                            data-task-link
                            className="min-w-0 flex-1 truncate text-sm text-text"
                          >
                            {task.title}
                            {task.recurrence ? <span aria-hidden="true"> ↻</span> : null}
                          </Link>
                          {task.subtaskCount.total > 0 ? (
                            <span className="text-xs text-text-secondary">
                              {`${task.subtaskCount.done}/${task.subtaskCount.total} ⑂`}
                            </span>
                          ) : null}
                          <span className="lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                            <MoveToProject
                              task={task}
                              context={context}
                              onMoved={(project) =>
                                setMoved(t('move.moved', { title: task.title, project }))
                              }
                            />
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 px-3 pl-11 lg:contents">
                          <span className={cn(CELL, 'gap-2')}>
                            {task.assignee ? (
                              <>
                                <Avatar name={task.assignee.name} color={task.assignee.color} />
                                <span className="truncate text-sm text-text">
                                  {task.assignee.name}
                                </span>
                              </>
                            ) : (
                              <EmptyAvatar />
                            )}
                          </span>
                          <span
                            className={cn(CELL, 'text-sm', overdue ? 'text-danger' : 'text-text')}
                          >
                            {task.due
                              ? task.due.date === context.today
                                ? t('row.today')
                                : shortDate(task.due.date, locale)
                              : '—'}
                          </span>
                          <span className={CELL}>
                            <Pill color={task.project.color}>
                              {task.project.kind === 'inbox'
                                ? t('table.noProject')
                                : task.project.name}
                            </Pill>
                          </span>
                          <span className={CELL}>
                            {task.priority > 0 ? (
                              <Pill color={PRIORITY_COLOR[task.priority]!}>
                                {t(`priority.${task.priority}`)}
                              </Pill>
                            ) : (
                              <span className="text-sm text-text-secondary">—</span>
                            )}
                          </span>
                          <span className={CELL}>
                            <Pill color={STATUS_COLOR[task.status]!}>
                              {t(`status.${task.status}`)}
                            </Pill>
                          </span>
                          <span className={cn(CELL, 'justify-end text-sm text-text')}>
                            {task.storyPoints ?? ''}
                          </span>
                          {/* Mobil rozet şeridi */}
                          <span className="flex flex-wrap items-center gap-1.5 lg:hidden">
                            {task.assignee ? (
                              <Avatar
                                name={task.assignee.name}
                                color={task.assignee.color}
                                size="sm"
                              />
                            ) : null}
                            {task.due ? (
                              <span
                                className={cn(
                                  'text-xs',
                                  overdue ? 'text-danger' : 'text-text-secondary',
                                )}
                              >
                                {shortDate(task.due.date, locale)}
                              </span>
                            ) : null}
                            <Pill color={STATUS_COLOR[task.status]!}>
                              {t(`status.${task.status}`)}
                            </Pill>
                            {task.priority > 0 ? (
                              <Pill color={PRIORITY_COLOR[task.priority]!}>
                                {t(`priority.${task.priority}`)}
                              </Pill>
                            ) : null}
                            {task.storyPoints !== null ? (
                              <span className="text-xs text-text-secondary">
                                {t('table.pointsShort', { points: task.storyPoints })}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className={cn(GRID, 'flex min-h-10 items-center border-b border-border')}>
                  <SectionAdd section={section} context={context} />
                  <span className="hidden lg:col-span-5 lg:block" />
                  <span className="hidden items-center justify-end gap-2 px-3 text-xs text-text-secondary lg:flex">
                    {t('table.sum')}
                    <strong className="text-sm text-text">{points}</strong>
                  </span>
                </div>
              </>
            ) : null}
          </section>
        );
      })}
      <BulkBar selection={selection} context={context} />
    </div>
  );
}

/** Bölümdeki "Görev ekle" (D-098): Enter ile bölümün projesine/tarihine ekler; Esc vazgeçer. */
function SectionAdd({ section, context }: { section: TaskSection; context: TaskUiContext }) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    if (!title.trim() || pending) return;
    setPending(true);
    const result = await apiPost(
      `/api/v1/workspaces/${context.workspaceId}/tasks`,
      {
        title,
        ...(section.add.projectId ? { projectId: section.add.projectId } : {}),
        ...(section.add.dueDate ? { due: { date: section.add.dueDate } } : {}),
      },
      { 'Idempotency-Key': crypto.randomUUID() },
    );
    setPending(false);
    if (!result.ok) return setFailed(true);
    setFailed(false);
    setTitle('');
    router.refresh();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape') {
      setEditing(false);
      setTitle('');
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-h-10 items-center gap-2 px-3 pl-11 text-left text-sm text-text-secondary hover:text-text"
      >
        {t('table.addTask')}
      </button>
    );
  }
  return (
    <div className="flex min-w-0 flex-col px-3 pl-11">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => !title && setEditing(false)}
        maxLength={500}
        aria-label={t('table.addTaskTo', { section: section.title })}
        placeholder={t('table.addPlaceholder')}
        className="min-h-10 bg-transparent text-sm text-text placeholder:text-text-secondary focus-visible:outline-none"
      />
      {failed ? <p className="pb-2 text-xs text-danger">{t('table.addFailed')}</p> : null}
    </div>
  );
}
