'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { DueGroup, TaskView } from '@/modules/tasks';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { useTaskCompletion } from '../tasks/task-actions';
import type { TaskUiContext } from '../tasks/task-context';
import { TaskRow, isOverdue, useTaskMeta } from '../tasks/task-row';

/**
 * Figma Görevlerim grupları (4:66732): katlanabilir başlık (chevron), sağda sayı; Geciken grubunda bilgi
 * tehlike rengindedir.
 */
export function MyTaskGroups({
  groups,
  context,
}: {
  groups: { group: DueGroup; tasks: TaskView[] }[];
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks');
  const meta = useTaskMeta(context);
  const completion = useTaskCompletion(context);
  const [collapsed, setCollapsed] = useState<Set<DueGroup>>(new Set());
  const visible = groups
    .map((g) => ({ ...g, tasks: g.tasks.filter((task) => !completion.hidden.has(task.id)) }))
    .filter((g) => g.tasks.length > 0);

  const toggle = (group: DueGroup) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  if (visible.length === 0) {
    return (
      <>
        {completion.ui}
        <EmptyState
          icon={<Icon name="inbox" />}
          title={t('myTasks.emptyTitle')}
          description={t('myTasks.emptyDescription')}
        />
      </>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {completion.ui}
      {visible.map(({ group, tasks }) => {
        const name = t(`groups.${group}`);
        const open = !collapsed.has(group);
        return (
          <section key={group} aria-labelledby={`group-${group}`} className="flex flex-col gap-1">
            <h2 id={`group-${group}`} className="flex min-h-9 items-center">
              <button
                type="button"
                onClick={() => toggle(group)}
                aria-expanded={open}
                aria-label={
                  open
                    ? t('myTasks.collapse', { group: name })
                    : t('myTasks.expand', { group: name })
                }
                className="flex min-h-11 flex-1 items-center gap-2 text-left text-base font-medium text-text"
              >
                <span className={open ? '' : '-rotate-90'}>
                  <Icon name="chevron-down" />
                </span>
                <span className="flex-1">{name}</span>
                <span className="text-sm font-normal text-text-secondary">{tasks.length}</span>
              </button>
            </h2>
            {open ? (
              <ul className="flex flex-col">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    meta={meta(task)}
                    overdue={isOverdue(task, context.today)}
                    onComplete={() => completion.complete(task)}
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
