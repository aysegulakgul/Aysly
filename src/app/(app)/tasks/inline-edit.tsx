'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { apiPatch, apiPost, type ApiResult } from '@/client/api';
import type { TaskView } from '@/modules/tasks';
import { Popover, PopoverClose } from '@/ui/components/popover';
import { cn } from '@/ui/cn';
import { DatePickerPanel, type DueValue } from './date-picker';
import { shortDate } from './dates';
import { Avatar, EmptyAvatar, Pill, PRIORITY_COLOR, STATUS_COLOR } from './pills';
import type { TaskUiContext } from './task-context';

type Editable = Pick<
  TaskView,
  | 'id'
  | 'version'
  | 'title'
  | 'status'
  | 'priority'
  | 'storyPoints'
  | 'assignee'
  | 'due'
  | 'projectId'
  | 'recurrence'
  | 'project'
  | 'description'
>;

/**
 * D-106: satır içi düzenleme. Her değişiklik anında kaydedilir; sürüm her başarılı yanıtta güncellenir
 * (BR-TASK-010). Tamamlama ve yeniden açma tek yoldan gider (BR-TASK-003: /complete, /reopen).
 */
export function useTaskEditor(task: Editable, context: TaskUiContext) {
  const router = useRouter();
  const [version, setVersion] = useState(task.version);
  const [failed, setFailed] = useState(false);
  const base = `/api/v1/workspaces/${context.workspaceId}/tasks/${task.id}` as const;

  async function run(call: (v: number) => Promise<ApiResult<{ version: number }>>) {
    setFailed(false);
    let result = await call(version);
    // Sürüm çakışmasında (başka bir alan aynı anda kaydedildiyse) güncel sürümle bir kez yeniden dener.
    if (!result.ok && result.status === 409 && result.error.current) {
      const current = result.error.current as { version: number };
      result = await call(current.version);
    }
    if (!result.ok) {
      setFailed(true);
      return false;
    }
    setVersion(result.data.version);
    router.refresh();
    return true;
  }

  return {
    failed,
    patch: (changes: Record<string, unknown>) =>
      run((v) => apiPatch<{ version: number }>(base, { version: v, ...changes })),
    move: (projectId: string) =>
      run((v) => apiPost<{ version: number }>(`${base}/move`, { version: v, projectId })),
    async setStatus(next: TaskView['status']) {
      if (next === task.status) return true;
      if (next === 'done') {
        return run((v) => apiPost<{ version: number }>(`${base}/complete`, { version: v }));
      }
      if (task.status === 'done') {
        const reopened = await run((v) =>
          apiPost<{ version: number }>(`${base}/reopen`, { version: v }),
        );
        if (!reopened || next === 'todo') return reopened;
      }
      return run((v) => apiPatch<{ version: number }>(base, { version: v, status: next }));
    },
  };
}

type Editor = ReturnType<typeof useTaskEditor>;

const cellButton =
  'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-sm px-1 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary';
const option =
  'flex min-h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-sm text-text hover:bg-surface-muted';

function Menu({
  label,
  trigger,
  children,
}: {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover label={label} className="w-56 gap-1 p-2" trigger={trigger}>
      {children}
    </Popover>
  );
}

/** Görev adı: tıklayınca düzenlenir; Enter veya odaktan çıkınca kaydedilir, Esc vazgeçer. */
export function TitleCell({
  task,
  editor,
  done,
}: {
  task: Editable;
  editor: Editor;
  done: boolean;
}) {
  const t = useTranslations('tasks.inline');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);

  async function commit() {
    setEditing(false);
    const next = value.trim();
    if (!next || next === task.title) return setValue(task.title);
    if (!(await editor.patch({ title: next }))) setValue(task.title);
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') void commit();
    if (event.key === 'Escape') {
      setValue(task.title);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={500}
        aria-label={t('title')}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKeyDown}
        className="min-h-8 min-w-0 flex-1 rounded-sm border border-primary bg-surface px-1 text-sm text-text"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={t('editTitle', { title: task.title })}
      className={cn(
        'min-h-8 min-w-0 flex-1 truncate rounded-sm px-1 text-left text-sm hover:bg-surface-muted',
        done ? 'text-text-secondary line-through' : 'text-text',
      )}
    >
      {task.title}
      {task.recurrence ? <span aria-hidden="true"> ↻</span> : null}
    </button>
  );
}

export function AssigneeCell({
  task,
  editor,
  context,
}: {
  task: Editable;
  editor: Editor;
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks.inline');
  return (
    <Menu
      label={t('assignee', { title: task.title })}
      trigger={
        <button
          type="button"
          aria-label={t('assignee', { title: task.title })}
          className={cellButton}
        >
          {task.assignee ? (
            <>
              <Avatar name={task.assignee.name} color={task.assignee.color} />
              <span className="truncate text-text">{task.assignee.name}</span>
            </>
          ) : (
            <EmptyAvatar />
          )}
        </button>
      }
    >
      <PopoverClose asChild>
        <button
          type="button"
          className={option}
          onClick={() => void editor.patch({ assigneeId: null })}
        >
          <EmptyAvatar />
          {t('unassigned')}
        </button>
      </PopoverClose>
      {context.contacts.map((c) => (
        <PopoverClose asChild key={c.id}>
          <button
            type="button"
            className={option}
            onClick={() => void editor.patch({ assigneeId: c.id })}
          >
            <Avatar name={c.name} color={c.color} />
            {c.name}
          </button>
        </PopoverClose>
      ))}
      {context.contacts.length === 0 ? (
        <p className="px-2 py-1 text-xs text-text-secondary">{t('noContacts')}</p>
      ) : null}
    </Menu>
  );
}

export function DueCell({
  task,
  editor,
  context,
  overdue,
}: {
  task: Editable;
  editor: Editor;
  context: TaskUiContext;
  overdue: boolean;
}) {
  const t = useTranslations('tasks');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const label = task.due
    ? task.due.date === context.today
      ? t('row.today')
      : shortDate(task.due.date, locale)
    : '—';
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t('inline.due', { title: task.title })}
      trigger={
        <button
          type="button"
          aria-label={t('inline.due', { title: task.title })}
          className={cn(cellButton, overdue ? 'text-danger' : 'text-text')}
        >
          {label}
        </button>
      }
    >
      <DatePickerPanel
        value={
          task.due
            ? { date: task.due.date, time: task.due.time, timezone: task.due.timezone }
            : null
        }
        timezone={context.timezone}
        weekStart={context.weekStart}
        onApply={(due: DueValue | null) => {
          setOpen(false);
          // BR-REC-006: tekrarlayan görevde satır içi değişiklik yalnızca bu örneğe uygulanır.
          void editor.patch(task.recurrence ? { due, recurrenceScope: 'this' } : { due });
        }}
      />
    </Popover>
  );
}

export function ProjectCell({
  task,
  editor,
  context,
}: {
  task: Editable;
  editor: Editor;
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks');
  const name = (p: { kind: string; name: string }) =>
    p.kind === 'inbox' ? t('table.noProject') : p.name;
  return (
    <Menu
      label={t('inline.project', { title: task.title })}
      trigger={
        <button
          type="button"
          aria-label={t('inline.project', { title: task.title })}
          className={cellButton}
        >
          <Pill color={task.project.color}>{name(task.project)}</Pill>
        </button>
      }
    >
      {context.projects.map((p) => (
        <PopoverClose asChild key={p.id}>
          <button
            type="button"
            className={cn(option, p.id === task.projectId && 'font-semibold')}
            onClick={() => void editor.move(p.id)}
          >
            {name(p)}
          </button>
        </PopoverClose>
      ))}
    </Menu>
  );
}

export function PriorityCell({ task, editor }: { task: Editable; editor: Editor }) {
  const t = useTranslations('tasks');
  return (
    <Menu
      label={t('inline.priority', { title: task.title })}
      trigger={
        <button
          type="button"
          aria-label={t('inline.priority', { title: task.title })}
          className={cellButton}
        >
          {task.priority > 0 ? (
            <Pill color={PRIORITY_COLOR[task.priority]!}>{t(`priority.${task.priority}`)}</Pill>
          ) : (
            <span className="text-text-secondary">—</span>
          )}
        </button>
      }
    >
      {[3, 2, 1, 0].map((p) => (
        <PopoverClose asChild key={p}>
          <button
            type="button"
            className={option}
            onClick={() => void editor.patch({ priority: p })}
          >
            {p > 0 ? <Pill color={PRIORITY_COLOR[p]!}>{t(`priority.${p}`)}</Pill> : t('priority.0')}
          </button>
        </PopoverClose>
      ))}
    </Menu>
  );
}

export function StatusCell({ task, editor }: { task: Editable; editor: Editor }) {
  const t = useTranslations('tasks');
  return (
    <Menu
      label={t('inline.status', { title: task.title })}
      trigger={
        <button
          type="button"
          aria-label={t('inline.status', { title: task.title })}
          className={cellButton}
        >
          <Pill color={STATUS_COLOR[task.status]!}>{t(`status.${task.status}`)}</Pill>
        </button>
      }
    >
      {(['todo', 'in_progress', 'on_hold', 'done'] as const).map((s) => (
        <PopoverClose asChild key={s}>
          <button type="button" className={option} onClick={() => void editor.setStatus(s)}>
            <Pill color={STATUS_COLOR[s]!}>{t(`status.${s}`)}</Pill>
          </button>
        </PopoverClose>
      ))}
    </Menu>
  );
}

const POINTS = [1, 2, 3, 5, 8, 13, 21, 34];

export function PointsCell({ task, editor }: { task: Editable; editor: Editor }) {
  const t = useTranslations('tasks.inline');
  return (
    <Menu
      label={t('points', { title: task.title })}
      trigger={
        <button
          type="button"
          aria-label={t('points', { title: task.title })}
          className={cn(cellButton, 'justify-end tabular-nums text-text')}
        >
          {task.storyPoints ?? <span className="text-text-secondary">—</span>}
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-1">
        {POINTS.map((p) => (
          <PopoverClose asChild key={p}>
            <button
              type="button"
              className={cn(
                'min-h-9 rounded-sm border border-border text-sm hover:bg-surface-muted',
                task.storyPoints === p ? 'bg-support-1 font-semibold text-primary' : 'text-text',
              )}
              onClick={() => void editor.patch({ storyPoints: p })}
            >
              {p}
            </button>
          </PopoverClose>
        ))}
      </div>
      <PopoverClose asChild>
        <button
          type="button"
          className={option}
          onClick={() => void editor.patch({ storyPoints: null })}
        >
          {t('clearPoints')}
        </button>
      </PopoverClose>
    </Menu>
  );
}

/** D-106: Bugün satırlarında detay açmadan düzenlenen alanlar (statü, öncelik, tarih, atanan, puan). */
export function TaskQuickFields({
  task,
  context,
  overdue,
}: {
  task: Editable;
  context: TaskUiContext;
  overdue: boolean;
}) {
  const editor = useTaskEditor(task, context);
  return (
    <div data-quick-fields className="flex flex-wrap items-center gap-0.5">
      <StatusCell task={task} editor={editor} />
      <PriorityCell task={task} editor={editor} />
      <DueCell task={task} editor={editor} context={context} overdue={overdue} />
      <AssigneeCell task={task} editor={editor} context={context} />
      <PointsCell task={task} editor={editor} />
    </div>
  );
}

/** Görev notu (açıklama alanı): satırda ilk satırı görünür; tıklayınca düzenlenir, kapanınca kaydedilir. */
export function NotesCell({ task, editor }: { task: Editable; editor: Editor }) {
  const t = useTranslations('tasks.inline');
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(task.description ?? '');

  async function save() {
    const next = value.trim() ? value : null;
    if (next === (task.description ?? null)) return;
    if (!(await editor.patch({ description: next }))) setValue(task.description ?? '');
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) void save();
        setOpen(next);
      }}
      label={t('notes', { title: task.title })}
      className="w-80 p-3"
      trigger={
        <button
          type="button"
          aria-label={t('notes', { title: task.title })}
          className={cn(cellButton, 'w-full text-text-secondary')}
        >
          <span className="truncate">
            {task.description ? task.description.split('\n')[0] : '—'}
          </span>
        </button>
      }
    >
      <textarea
        autoFocus
        value={value}
        maxLength={20_000}
        rows={5}
        aria-label={t('notesField')}
        placeholder={t('notesPlaceholder')}
        onChange={(e) => setValue(e.target.value)}
        className="w-full resize-y rounded-sm border border-border bg-page p-2 text-sm text-text placeholder:text-text-secondary"
      />
      <PopoverClose asChild>
        <button
          type="button"
          className="self-end rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
        >
          {t('notesSave')}
        </button>
      </PopoverClose>
    </Popover>
  );
}
