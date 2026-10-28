'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { TaskView } from '@/modules/tasks';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { GiveDate, MoveToProject } from '../tasks/row-actions';
import { useTaskCompletion } from '../tasks/task-actions';
import type { TaskUiContext } from '../tasks/task-context';
import { TaskRow, isOverdue, useTaskMeta } from '../tasks/task-row';

/**
 * Inbox listesi (Figma "Capture list" 4:66707): "İşlenecekler" grubu, satırda "Projeye taşı" (masaüstü ve mobil)
 * ve mobilde "Tarih ver" (4:68036). Tamamlama ve "Geri al" ortak akıştan (BR-TASK-004, BR-SUB-003).
 */
export function InboxList({ tasks, context }: { tasks: TaskView[]; context: TaskUiContext }) {
  const t = useTranslations('tasks');
  const meta = useTaskMeta(context);
  const completion = useTaskCompletion(context);
  const [moved, setMoved] = useState<string>();
  const visible = tasks.filter((task) => !completion.hidden.has(task.id));

  return (
    <>
      {completion.ui}
      <p role="status" aria-live="polite" className={moved ? 'text-sm text-success' : 'sr-only'}>
        {moved ? `✓ ${moved}` : ''}
      </p>
      {visible.length === 0 ? (
        <EmptyState
          icon={<Icon name="inbox" />}
          title={t('inbox.emptyTitle')}
          description={t('inbox.emptyDescription')}
        />
      ) : (
        <section aria-labelledby="inbox-group" className="flex w-full flex-col gap-1">
          <div className="flex min-h-9 items-center gap-2">
            <h2 id="inbox-group" className="flex-1 text-base font-medium text-text">
              {t('inbox.group')}
            </h2>
            <p className="text-sm text-text-secondary">{visible.length}</p>
          </div>
          <ul className="flex flex-col">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                meta={meta(task)}
                overdue={isOverdue(task, context.today)}
                onComplete={() => completion.complete(task)}
                actions={
                  <>
                    <MoveToProject
                      task={task}
                      context={context}
                      onMoved={(project) =>
                        setMoved(t('move.moved', { title: task.title, project }))
                      }
                    />
                    <span className="lg:hidden">
                      <GiveDate task={task} context={context} />
                    </span>
                  </>
                }
              />
            ))}
          </ul>
        </section>
      )}
      <p className="text-sm text-text-secondary">{t('inboxFooter')}</p>
    </>
  );
}
