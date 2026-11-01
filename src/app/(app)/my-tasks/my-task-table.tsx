'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/client/api';
import type { TaskDetailView, TaskView } from '@/modules/tasks';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { cn } from '@/ui/cn';
import { PROJECT_COLOR_VALUES, type ProjectColorName } from '../projects/project-color';
import {
  AssigneeCell,
  DueCell,
  NotesCell,
  PointsCell,
  PriorityCell,
  ProjectCell,
  StatusCell,
  TitleCell,
  useTaskEditor,
} from '../tasks/inline-edit';
import { useTaskCompletion } from '../tasks/task-actions';
import type { TaskUiContext } from '../tasks/task-context';
import { isOverdue } from '../tasks/task-row';
import { BulkBar, SelectBox, SelectionToggle, useSelection } from '../views/bulk-bar';

export type TaskSection = {
  key: string;
  title: string;
  /** Bölüm başlığının renk vurgusu (proje rengi ya da tarih grubunun rengi). */
  color: string;
  /** Bölüme eklenen görevin projesi ve tarihi (D-098: bölümdeki "Görev ekle"). */
  add: {
    projectId?: string | undefined;
    dueDate?: string | undefined;
    /** D-107: statü bölümüne eklenen görev o statüyle başlar. */
    status?: 'in_progress' | 'on_hold' | 'done' | undefined;
  };
  tasks: TaskView[];
};

type Filters = { assignee: string; project: string; priority: string; status: string; due: string };
const NO_FILTER: Filters = { assignee: '', project: '', priority: '', status: '', due: '' };

const GRID =
  'lg:grid lg:grid-cols-[minmax(0,1fr)_160px_100px_140px_92px_120px_56px_minmax(120px,180px)] lg:items-center';
const CELL = 'hidden min-w-0 px-2 lg:flex lg:h-full lg:items-center';
const hex = (color: string) =>
  PROJECT_COLOR_VALUES[color as ProjectColorName] ?? PROJECT_COLOR_VALUES.slate;

/**
 * Görevlerim listesi (D-098, D-100, D-106): katlanabilir renkli bölümler, sütun filtreleri, her alan satır içinde
 * düzenlenir ve anında kaydedilir, tamamlananlar üstü çizili kalır, alt görevler satır içinde açılıp eklenir
 * (D-103), bölüm başına sınırsız "Görev ekle" ve story point toplamı (BR-TASK-011).
 */
export function MyTaskTable({
  sections,
  context,
}: {
  sections: TaskSection[];
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks');
  const completion = useTaskCompletion(context);
  const selection = useSelection();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(NO_FILTER);
  const toggle = (key: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const matches = (task: TaskView) => {
    if (filters.assignee === 'none' && task.assignee) return false;
    if (filters.assignee && filters.assignee !== 'none' && task.assignee?.id !== filters.assignee)
      return false;
    if (filters.project && task.projectId !== filters.project) return false;
    if (filters.priority && String(task.priority) !== filters.priority) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.due === 'none' && task.due) return false;
    if (filters.due === 'overdue' && !isOverdue(task, context.today)) return false;
    if (filters.due === 'today' && task.due?.date !== context.today) return false;
    return true;
  };
  const visible = sections.map((s) => ({ ...s, tasks: s.tasks.filter(matches) }));
  const total = visible.reduce((n, s) => n + s.tasks.length, 0);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="flex w-full flex-col gap-3">
      {completion.ui}
      <FilterBar filters={filters} onChange={setFilters} context={context} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          {filtered ? t('filters.showing', { count: total }) : null}
        </p>
        {total > 0 ? (
          <SelectionToggle
            selection={selection}
            all={visible.flatMap((s) => s.tasks.map((task) => task.id))}
          />
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div
          className={cn(
            GRID,
            'hidden h-10 border-b border-border bg-surface-muted text-xs font-medium tracking-wide text-text-secondary uppercase lg:grid',
          )}
        >
          <span className="px-4">{t('table.name')}</span>
          <span className={CELL}>{t('table.assignee')}</span>
          <span className={CELL}>{t('table.due')}</span>
          <span className={CELL}>{t('table.project')}</span>
          <span className={CELL}>{t('table.priority')}</span>
          <span className={CELL}>{t('table.status')}</span>
          <span className={cn(CELL, 'justify-end')}>{t('table.points')}</span>
          <span className={CELL}>{t('table.notes')}</span>
        </div>
        {sections.every((s) => s.tasks.length === 0) ? (
          <div className="p-6">
            <EmptyState
              icon={<Icon name="inbox" />}
              title={t('myTasks.emptyTitle')}
              description={t('myTasks.emptyDescription')}
            />
          </div>
        ) : null}
        {visible.map((section) => {
          if (filtered && section.tasks.length === 0) return null;
          const open = !collapsed.has(section.key);
          const points = section.tasks.reduce((n, task) => n + (task.storyPoints ?? 0), 0);
          const done = section.tasks.filter((task) => task.status === 'done').length;
          return (
            <section
              key={section.key}
              aria-labelledby={`section-${section.key}`}
              className="flex flex-col border-b border-border last:border-b-0"
            >
              <h2
                id={`section-${section.key}`}
                className="flex min-h-12 items-center"
                style={{
                  background: `linear-gradient(90deg, ${hex(section.color)}26, transparent 60%)`,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  aria-expanded={open}
                  aria-label={
                    open
                      ? t('myTasks.collapse', { group: section.title })
                      : t('myTasks.expand', { group: section.title })
                  }
                  className="flex min-h-12 flex-1 items-center gap-2 px-4 text-left text-base font-semibold text-text"
                >
                  <span className={cn('transition-transform', open ? '' : '-rotate-90')}>
                    <Icon name="chevron-down" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: hex(section.color) }}
                  />
                  <span>{section.title}</span>
                  <span className="rounded-full bg-surface-muted px-2 text-xs font-medium text-text-secondary">
                    {section.tasks.length}
                  </span>
                  {done > 0 ? (
                    <span className="text-xs font-normal text-text-secondary">
                      {t('table.doneCount', { count: done })}
                    </span>
                  ) : null}
                </button>
              </h2>
              {open ? (
                <>
                  <ul className="flex flex-col">
                    {section.tasks.map((task) => (
                      <TaskLine
                        key={`${task.id}-${task.version}`}
                        task={task}
                        context={context}
                        selection={selection}
                        onComplete={() => completion.complete(task)}
                      />
                    ))}
                  </ul>
                  <div className={cn(GRID, 'flex min-h-10 items-center border-t border-border')}>
                    <SectionAdd section={section} context={context} />
                    <span className="hidden lg:col-span-5 lg:block" />
                    <span className="hidden items-center justify-end gap-2 px-2 text-xs text-text-secondary lg:flex">
                      {t('table.sum')}
                      <strong className="text-sm text-text tabular-nums">{points}</strong>
                    </span>
                  </div>
                </>
              ) : null}
            </section>
          );
        })}
      </div>
      <BulkBar selection={selection} context={context} />
    </div>
  );
}

/** Tek görev satırı: renkli proje çizgisi, satır içi alanlar, açılır alt görevler. */
function TaskLine({
  task,
  context,
  selection,
  onComplete,
}: {
  task: TaskView;
  context: TaskUiContext;
  selection: ReturnType<typeof useSelection>;
  onComplete: () => void;
}) {
  const t = useTranslations('tasks');
  const pathname = usePathname();
  const params = useSearchParams();
  const editor = useTaskEditor(task, context);
  const [expanded, setExpanded] = useState(false);
  const done = task.status === 'done';
  const overdue = isOverdue(task, context.today);
  const href = useMemo(() => {
    const next = new URLSearchParams(params);
    next.set('task', task.id);
    return `${pathname}?${next}` as Route;
  }, [params, pathname, task.id]);

  return (
    <li
      data-task-row
      data-task-id={task.id}
      className={cn(
        'group flex flex-col border-t border-border first:border-t-0',
        done && 'bg-surface-muted/40',
      )}
    >
      <div
        className={cn(
          GRID,
          'flex min-h-11 flex-col gap-1 py-2 hover:bg-surface-muted lg:gap-0 lg:py-0',
        )}
        style={{ boxShadow: `inset 3px 0 0 ${hex(task.project.color)}` }}
      >
        <div className="flex min-w-0 items-center gap-1.5 pr-2 pl-4">
          <SelectBox selection={selection} id={task.id} title={task.title} />
          <button
            type="button"
            data-complete
            onClick={() => (done ? void editor.setStatus('todo') : onComplete())}
            aria-label={
              done
                ? t('inline.reopen', { title: task.title })
                : t('row.complete', { title: task.title })
            }
            aria-pressed={done}
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors',
              done
                ? 'border-success bg-success text-white'
                : 'border-text-secondary text-transparent hover:border-success hover:text-success',
            )}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={t('inline.subtasks', { title: task.title })}
            className="flex min-h-8 shrink-0 items-center gap-0.5 rounded-sm px-1 text-xs text-text-secondary hover:bg-surface-muted"
          >
            <span className={cn('transition-transform', expanded ? 'rotate-90' : '')}>▸</span>
            {task.subtaskCount.total > 0
              ? `${task.subtaskCount.done}/${task.subtaskCount.total} ⑂`
              : null}
          </button>
          <TitleCell task={task} editor={editor} done={done} />
          <Link
            href={href}
            scroll={false}
            data-task-link
            aria-label={t('row.open', { title: task.title })}
            className="flex size-7 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-muted hover:text-text lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
          >
            ↗
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1 pr-2 pl-16 lg:contents">
          <span className={cn(CELL, 'max-lg:flex')}>
            <AssigneeCell task={task} editor={editor} context={context} />
          </span>
          <span className={cn(CELL, 'max-lg:flex')}>
            <DueCell task={task} editor={editor} context={context} overdue={overdue} />
          </span>
          <span className={cn(CELL, 'max-lg:flex')}>
            <ProjectCell task={task} editor={editor} context={context} />
          </span>
          <span className={cn(CELL, 'max-lg:flex')}>
            <PriorityCell task={task} editor={editor} />
          </span>
          <span className={cn(CELL, 'max-lg:flex')}>
            <StatusCell task={task} editor={editor} />
          </span>
          <span className={cn(CELL, 'justify-end max-lg:flex')}>
            <PointsCell task={task} editor={editor} />
          </span>
          <span className={cn(CELL, 'max-lg:flex max-lg:w-full')}>
            <NotesCell task={task} editor={editor} />
          </span>
        </div>
      </div>
      {editor.failed ? (
        <p role="alert" className="px-4 pb-2 text-xs text-danger">
          {t('inline.failed')}
        </p>
      ) : null}
      {expanded ? <Subtasks parent={task} context={context} /> : null}
    </li>
  );
}

/** D-103: alt görevler satır içinde; her ekleme ve değişiklik anında kaydedilir. */
function Subtasks({ parent, context }: { parent: TaskView; context: TaskUiContext }) {
  const t = useTranslations('tasks.inline');
  const router = useRouter();
  const base = `/api/v1/workspaces/${context.workspaceId}/tasks` as const;
  const [items, setItems] = useState<TaskView[] | null>(null);
  const [title, setTitle] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void apiGet<TaskDetailView>(`${base}/${parent.id}`).then((r) => {
      if (active) setItems(r.ok ? r.data.subtasks : []);
    });
    return () => {
      active = false;
    };
  }, [base, parent.id]);

  const replace = (next: TaskView) =>
    setItems((list) => (list ?? []).map((s) => (s.id === next.id ? { ...s, ...next } : s)));

  async function add() {
    const name = title.trim();
    if (!name) return;
    setTitle('');
    const result = await apiPost<TaskView>(
      base,
      { title: name, parentTaskId: parent.id },
      { 'Idempotency-Key': crypto.randomUUID() },
    );
    if (!result.ok) {
      setTitle(name);
      return setFailed(true);
    }
    setFailed(false);
    setItems((list) => [...(list ?? []), result.data]);
    router.refresh();
  }

  async function toggle(sub: TaskView) {
    const path = sub.status === 'done' ? 'reopen' : 'complete';
    const result = await apiPost<TaskView>(`${base}/${sub.id}/${path}`, { version: sub.version });
    if (!result.ok) return setFailed(true);
    replace(result.data);
    router.refresh();
  }

  async function rename(sub: TaskView, next: string) {
    if (!next.trim() || next.trim() === sub.title) return;
    const result = await apiPatch<TaskView>(`${base}/${sub.id}`, {
      version: sub.version,
      title: next,
    });
    if (result.ok) replace(result.data);
    else setFailed(true);
  }

  async function remove(sub: TaskView) {
    const result = await apiDelete(`${base}/${sub.id}`);
    if (!result.ok) return setFailed(true);
    setItems((list) => (list ?? []).filter((s) => s.id !== sub.id));
    router.refresh();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void add();
    }
  }

  return (
    <div className="flex flex-col gap-0.5 border-t border-dashed border-border bg-page/40 py-2 pr-4 pl-20">
      {items === null ? (
        <p className="text-xs text-text-secondary">{t('loading')}</p>
      ) : (
        <ul aria-label={t('subtasksOf', { title: parent.title })} className="flex flex-col gap-0.5">
          {items.map((sub) => (
            <li
              key={`${sub.id}-${sub.version}`}
              data-subtask-row
              className="group/sub flex min-h-8 items-center gap-2"
            >
              <button
                type="button"
                onClick={() => void toggle(sub)}
                aria-pressed={sub.status === 'done'}
                aria-label={t('toggleSubtask', { title: sub.title })}
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                  sub.status === 'done'
                    ? 'border-success bg-success text-white'
                    : 'border-text-secondary text-transparent hover:border-success',
                )}
              >
                ✓
              </button>
              <input
                defaultValue={sub.title}
                maxLength={500}
                aria-label={t('subtaskTitle', { title: sub.title })}
                onBlur={(e) => void rename(sub, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className={cn(
                  'min-h-8 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-sm hover:bg-surface-muted',
                  sub.status === 'done' ? 'text-text-secondary line-through' : 'text-text',
                )}
              />
              <button
                type="button"
                onClick={() => void remove(sub)}
                aria-label={t('deleteSubtask', { title: sub.title })}
                className="flex size-7 items-center justify-center rounded-sm text-text-secondary opacity-0 group-hover/sub:opacity-100 hover:text-danger focus:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void add()}
        maxLength={500}
        aria-label={t('addSubtask', { title: parent.title })}
        placeholder={t('addSubtaskPlaceholder')}
        className="min-h-8 rounded-sm bg-transparent px-1 text-sm text-text placeholder:text-text-secondary hover:bg-surface-muted"
      />
      {failed ? <p className="text-xs text-danger">{t('failed')}</p> : null}
    </div>
  );
}

/** Sütun filtreleri (D-106): atanan, proje, öncelik, statü, tarih. */
function FilterBar({
  filters,
  onChange,
  context,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks');
  const select =
    'min-h-9 rounded-full border border-border bg-surface px-3 text-sm text-text hover:border-primary';
  const set = (key: keyof Filters) => (e: { target: { value: string } }) =>
    onChange({ ...filters, [key]: e.target.value });
  return (
    <div role="group" aria-label={t('filters.label')} className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t('filters.byAssignee')}
        value={filters.assignee}
        onChange={set('assignee')}
        className={select}
      >
        <option value="">{t('filters.allAssignees')}</option>
        <option value="none">{t('inline.unassigned')}</option>
        {context.contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t('filters.byProject')}
        value={filters.project}
        onChange={set('project')}
        className={select}
      >
        <option value="">{t('filters.allProjects')}</option>
        {context.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.kind === 'inbox' ? t('table.noProject') : p.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t('filters.byPriority')}
        value={filters.priority}
        onChange={set('priority')}
        className={select}
      >
        <option value="">{t('filters.allPriorities')}</option>
        {[3, 2, 1, 0].map((p) => (
          <option key={p} value={p}>
            {t(`priority.${p}`)}
          </option>
        ))}
      </select>
      <select
        aria-label={t('filters.byStatus')}
        value={filters.status}
        onChange={set('status')}
        className={select}
      >
        <option value="">{t('filters.allStatuses')}</option>
        {(['todo', 'in_progress', 'on_hold', 'done'] as const).map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
      <select
        aria-label={t('filters.byDue')}
        value={filters.due}
        onChange={set('due')}
        className={select}
      >
        <option value="">{t('filters.allDates')}</option>
        <option value="overdue">{t('groups.overdue')}</option>
        <option value="today">{t('groups.today')}</option>
        <option value="none">{t('groups.none')}</option>
      </select>
      {Object.values(filters).some(Boolean) ? (
        <button
          type="button"
          onClick={() => onChange(NO_FILTER)}
          className="min-h-9 rounded-full px-3 text-sm text-primary hover:underline"
        >
          {t('filters.clear')}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Bölümdeki "Görev ekle" (D-098, D-106): sınırsız görev alt alta eklenir. Enter ile ekler ve alan açık kalır;
 * odaktan çıkınca yazılan metin de otomatik kaydedilir. Esc vazgeçer.
 */
function SectionAdd({ section, context }: { section: TaskSection; context: TaskUiContext }) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(keepOpen: boolean) {
    const name = title.trim();
    if (!name || pending) {
      if (!keepOpen) setEditing(false);
      return;
    }
    setPending(true);
    const base = `/api/v1/workspaces/${context.workspaceId}/tasks` as const;
    const result = await apiPost<{ id: string; version: number }>(
      base,
      {
        title: name,
        ...(section.add.projectId ? { projectId: section.add.projectId } : {}),
        ...(section.add.dueDate ? { due: { date: section.add.dueDate } } : {}),
      },
      { 'Idempotency-Key': crypto.randomUUID() },
    );
    const status = section.add.status;
    if (result.ok && status) {
      const { id, version } = result.data;
      // BR-TASK-003: tamamlama tek yoldan (/complete); diğer statüler PATCH ile.
      if (status === 'done') await apiPost(`${base}/${id}/complete`, { version });
      else await apiPatch(`${base}/${id}`, { version, status });
    }
    setPending(false);
    if (!result.ok) return setFailed(true);
    setFailed(false);
    setTitle('');
    if (!keepOpen) setEditing(false);
    router.refresh();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit(true);
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
        className="flex min-h-10 items-center gap-2 px-4 pl-11 text-left text-sm text-text-secondary hover:text-primary"
      >
        {t('table.addTask')}
      </button>
    );
  }
  return (
    <div className="flex min-w-0 flex-col px-4 pl-11">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void submit(false)}
        maxLength={500}
        aria-label={t('table.addTaskTo', { section: section.title })}
        placeholder={t('table.addPlaceholder')}
        className="min-h-10 bg-transparent text-sm text-text placeholder:text-text-secondary focus-visible:outline-none"
      />
      {failed ? <p className="pb-2 text-xs text-danger">{t('table.addFailed')}</p> : null}
    </div>
  );
}
