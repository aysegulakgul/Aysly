'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiPatch } from '@/client/api';
import type { DashboardView, TaskView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { addDays } from '../tasks/dates';
import { useTaskCompletion } from '../tasks/task-actions';
import type { TaskUiContext } from '../tasks/task-context';
import { TaskRow, isOverdue, useTaskMeta } from '../tasks/task-row';
import { AVAILABLE_WIDGETS, type WidgetId } from './widget-ids';

const UPCOMING_PREVIEW = 3;

/**
 * Bugün ekranı bölümleri (Figma 4:66545 "Dashboard widgets"): masaüstünde iki sütun (sıradaki bölümler sırayla
 * sol/sağ), mobilde tek sütun. Sıra ve görünürlük kullanıcı tercihinden (BR-DASH-001).
 */
export function DashboardWidgets({
  data,
  order,
  context,
}: {
  data: DashboardView;
  order: WidgetId[];
  context: TaskUiContext;
}) {
  const t = useTranslations('dashboard');
  const meta = useTaskMeta(context);
  const completion = useTaskCompletion(context);
  const router = useRouter();
  const visible = (items: TaskView[]) => items.filter((i) => !completion.hidden.has(i.id));

  async function reschedule(task: TaskView, date: string) {
    await apiPatch(`/api/v1/workspaces/${context.workspaceId}/tasks/${task.id}`, {
      version: task.version,
      due: { date, time: task.due?.time ?? null, timezone: task.due?.timezone ?? null },
    });
    router.refresh();
  }

  const rows = (items: TaskView[], actions?: (task: TaskView) => React.ReactNode) => (
    <ul className="flex flex-col">
      {items.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          meta={meta(task)}
          overdue={isOverdue(task, context.today)}
          onComplete={() => completion.complete(task)}
          stacked
          {...(actions ? { actions: actions(task) } : {})}
        />
      ))}
    </ul>
  );

  const widget = (id: WidgetId) => {
    const items = visible(data[id]);
    const shown = id === 'upcoming' ? items.slice(0, UPCOMING_PREVIEW) : items;
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SectionHeading>{t(`widgets.${id}`)}</SectionHeading>
          </div>
          <p className="text-sm text-text-secondary">
            {t(`counts.${id}`, { count: items.length })}
          </p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-text-secondary">{t(`empty.${id}`)}</p>
        ) : id === 'overdue' ? (
          // FR-DASH-02: tek tıkla bugüne taşı / yarına ertele (Figma 4:66612)
          rows(shown, (task) => (
            <>
              <Button onClick={() => void reschedule(task, context.today)}>{t('toToday')}</Button>
              <Button
                variant="ghost"
                onClick={() => void reschedule(task, addDays(context.today, 1))}
              >
                {t('toTomorrow')}
              </Button>
            </>
          ))
        ) : (
          rows(shown)
        )}
        {id === 'upcoming' && items.length > UPCOMING_PREVIEW ? (
          <Link href="/upcoming" className="text-sm text-primary underline">
            {t('allUpcoming', { count: items.length })}
          </Link>
        ) : null}
      </Panel>
    );
  };

  const total = AVAILABLE_WIDGETS.reduce((n, id) => n + data[id].length, 0);
  if (total === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<Icon name="inbox" />}
          title={t('noTasksTitle')}
          description={t('noTasksDescription')}
        />
      </Panel>
    );
  }
  if (order.length === 0) return <p className="text-sm text-text-secondary">{t('allHidden')}</p>;

  return (
    <>
      {completion.ui}
      {/* Masaüstü iki sütun (sıradaki bölümler sırayla sol/sağ); mobilde sütunlar düzleşir ve sıra korunur. */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {[0, 1].map((col) => (
          <div key={col} className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-5">
            {order.map((id, index) =>
              index % 2 === col ? (
                <div key={id} style={{ order: index }}>
                  {widget(id)}
                </div>
              ) : null,
            )}
          </div>
        ))}
      </div>
    </>
  );
}
