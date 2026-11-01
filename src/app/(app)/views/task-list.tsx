'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiPost } from '@/client/api';
import type { TaskView } from '@/modules/tasks';
import type { GroupKey } from '@/modules/views/domain/task-filter';
import { Icon } from '@/ui/components/icon';
import { addDays, weekday } from '../tasks/dates';
import { useTaskCompletion } from '../tasks/task-actions';
import type { TaskUiContext } from '../tasks/task-context';
import { TaskRow, isOverdue, useTaskMeta } from '../tasks/task-row';
import { SelectBox, type Selection } from './bulk-bar';

type Group = { key: string; label: string; tasks: TaskView[] };

/** BR-DATE-003/004 ile aynı gruplar (Görevlerim); istemcide yalnızca sunum için. */
function dateGroup(task: TaskView, context: TaskUiContext) {
  if (!task.due) return 'none';
  if (isOverdue(task, context.today)) return 'overdue';
  if (task.due.date === context.today) return 'today';
  if (task.due.date === addDays(context.today, 1)) return 'tomorrow';
  const endOfWeek = addDays(
    context.today,
    (context.weekStart + 6 - weekday(context.today) + 7) % 7,
  );
  return task.due.date <= endOfWeek ? 'thisWeek' : 'later';
}
const DATE_ORDER = ['overdue', 'today', 'tomorrow', 'thisWeek', 'later', 'none'];

/**
 * Liste görünümü (FR-VIEW-01): gruplama yok/tarih/öncelik/durum/proje. Gruplama yokken açık ve tamamlanmış görevler
 * Figma'daki gibi "Açık görevler" ve "Tamamlandı" bölümlerinde (4:67132). Seçim modunda satırlarda onay kutusu.
 */
export function TaskList({
  tasks,
  groupBy,
  context,
  selection,
  readOnly = false,
}: {
  tasks: TaskView[];
  groupBy: GroupKey;
  context: TaskUiContext;
  selection: Selection;
  readOnly?: boolean;
}) {
  const t = useTranslations('tasks');
  const tProjects = useTranslations('projects');
  const tViews = useTranslations('views');
  const meta = useTaskMeta(context);
  const completion = useTaskCompletion(context);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const visible = tasks.filter((task) => !completion.hidden.has(task.id));
  const router = useRouter();
  /** BR-TASK-004: tamamlanmış görevin işaretine basmak yeniden açar. */
  async function reopen(task: TaskView) {
    await apiPost(`/api/v1/workspaces/${context.workspaceId}/tasks/${task.id}/reopen`, {
      version: task.version,
    });
    router.refresh();
  }

  const groups: Group[] = (() => {
    const by = (
      keyOf: (task: TaskView) => string,
      labelOf: (key: string) => string,
      order?: string[],
    ) => {
      const map = new Map<string, TaskView[]>();
      for (const task of visible) map.set(keyOf(task), [...(map.get(keyOf(task)) ?? []), task]);
      const keys = order ? order.filter((k) => map.has(k)) : [...map.keys()];
      return keys.map((key) => ({ key, label: labelOf(key), tasks: map.get(key)! }));
    };
    switch (groupBy) {
      case 'date':
        return by(
          (task) => dateGroup(task, context),
          (k) => t(`groups.${k}`),
          DATE_ORDER,
        );
      case 'priority':
        return by(
          (task) => String(task.priority),
          (k) => t(`priority.${k}`),
          ['3', '2', '1', '0'],
        );
      case 'status':
        return by(
          (task) => task.status,
          (k) => t(`detail.statuses.${k}`),
          ['todo', 'in_progress', 'on_hold', 'done'],
        );
      case 'project':
        return by(
          (task) => task.project.id,
          (k) => visible.find((task) => task.project.id === k)?.project.name ?? '',
        );
      default: {
        const open = visible.filter((task) => task.status !== 'done');
        const done = visible.filter((task) => task.status === 'done');
        return [
          { key: 'open', label: tProjects('openGroup'), tasks: open },
          ...(done.length ? [{ key: 'done', label: tProjects('doneGroup'), tasks: done }] : []),
        ].filter((g) => g.tasks.length > 0 || g.key === 'open');
      }
    }
  })();

  const toggle = (key: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (visible.length === 0) {
    return (
      <>
        {completion.ui}
        <p className="text-sm text-text-secondary">{tViews('empty')}</p>
      </>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {completion.ui}
      {groups.map((group) => {
        const open = !collapsed.has(group.key);
        const id = `list-group-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={id} className="flex flex-col gap-1">
            <h2 id={id} className="flex min-h-9 items-center">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={open}
                className="flex min-h-11 flex-1 items-center gap-2 text-left text-base font-medium text-text"
              >
                <span className={open ? '' : '-rotate-90'}>
                  <Icon name="chevron-down" />
                </span>
                <span className="flex-1">{group.label}</span>
                <span className="text-sm font-normal text-text-secondary">
                  {group.tasks.length}
                </span>
              </button>
            </h2>
            {open ? (
              <ul className="flex flex-col">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    meta={meta(task)}
                    overdue={isOverdue(task, context.today)}
                    leading={<SelectBox selection={selection} id={task.id} title={task.title} />}
                    onComplete={() => {
                      if (readOnly) return;
                      if (task.status === 'done') void reopen(task);
                      else completion.complete(task);
                    }}
                  />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
