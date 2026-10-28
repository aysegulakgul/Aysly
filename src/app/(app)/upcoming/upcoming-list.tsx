'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { TaskView } from '@/modules/tasks';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { useTaskCompletion } from '../tasks/task-actions';
import type { TaskUiContext } from '../tasks/task-context';
import { TaskRow, useTaskMeta } from '../tasks/task-row';

/** Gün grupları (Figma 4:67785): katlanabilir başlık "16 Ekim Cuma", sağda sayı. */
export function UpcomingList({
  days,
  context,
}: {
  days: { date: string; label: string; tasks: TaskView[] }[];
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks');
  const tUp = useTranslations('upcoming');
  const meta = useTaskMeta(context);
  const completion = useTaskCompletion(context);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const visible = days
    .map((d) => ({ ...d, tasks: d.tasks.filter((x) => !completion.hidden.has(x.id)) }))
    .filter((d) => d.tasks.length > 0);

  if (visible.length === 0) {
    return (
      <>
        {completion.ui}
        <EmptyState icon={<Icon name="inbox" />} title={tUp('title')} description={tUp('empty')} />
      </>
    );
  }
  return (
    <div className="flex w-full flex-col gap-4">
      {completion.ui}
      {visible.map(({ date, label, tasks }) => {
        const open = !collapsed.has(date);
        return (
          <section key={date} aria-labelledby={`day-${date}`} className="flex flex-col gap-1">
            <h2 id={`day-${date}`} className="flex min-h-9 items-center">
              <button
                type="button"
                aria-expanded={open}
                aria-label={
                  open
                    ? t('myTasks.collapse', { group: label })
                    : t('myTasks.expand', { group: label })
                }
                onClick={() =>
                  setCollapsed((set) => {
                    const next = new Set(set);
                    if (next.has(date)) next.delete(date);
                    else next.add(date);
                    return next;
                  })
                }
                className="flex min-h-11 flex-1 items-center gap-2 text-left text-base font-medium text-text"
              >
                <span className={open ? '' : '-rotate-90'}>
                  <Icon name="chevron-down" />
                </span>
                <span className="flex-1">{label}</span>
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
