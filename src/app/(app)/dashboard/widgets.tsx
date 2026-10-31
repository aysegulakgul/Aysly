'use client';

import Link from 'next/link';
import type { Route } from 'next';
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
import type { GoalView } from '@/modules/goals';
import type { ProjectView } from '@/modules/tasks';
import { Progress } from '@/ui/components/progress';
import { TASK_WIDGETS, type WidgetId } from './widget-ids';

/**
 * Bugün ekranı bölümleri (Figma 4:66545 "Dashboard widgets"): masaüstünde iki sütun (sıradaki bölümler sırayla
 * sol/sağ), mobilde tek sütun. Sıra ve görünürlük kullanıcı tercihinden (BR-DASH-001).
 */
export function DashboardWidgets({
  data,
  order,
  context,
  projects,
  goals,
}: {
  data: DashboardView;
  order: WidgetId[];
  context: TaskUiContext;
  /** FR-DASH-06: aktif projeler ve ilerleme. */
  projects: ProjectView[];
  /** FR-DASH-07: aktif hedefler ve ilerleme. */
  goals: GoalView[];
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
      // BR-REC-006: "Bugüne/Yarına taşı" tekrarlayan görevde yalnızca bu örneği taşır.
      ...(task.recurrence ? { recurrenceScope: 'this' } : {}),
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
    if (id === 'projects') {
      const shown = projects.filter((p) => p.status === 'active');
      return (
        <Panel>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SectionHeading>{t('widgets.projects')}</SectionHeading>
            </div>
            <Link href="/projects" className="text-sm text-primary">
              {t('allProjects')}
            </Link>
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('empty.projects')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.slice(0, 5).map((p) => {
                const progress = p.progress ?? { done: 0, total: 0 };
                const percent = progress.total
                  ? Math.round((progress.done / progress.total) * 100)
                  : null;
                return (
                  <li key={p.id} className="flex flex-col gap-1">
                    <Link
                      href={`/projects/${p.id}` as Route}
                      className="text-sm font-medium text-text"
                    >
                      {p.name}
                    </Link>
                    {percent === null ? (
                      <p className="text-xs text-text-secondary">—</p>
                    ) : (
                      <Progress
                        done={progress.done}
                        total={progress.total}
                        label={t('projectProgress', { ...progress, percent })}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      );
    }
    if (id === 'goals') {
      return (
        <Panel>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SectionHeading>{t('widgets.goals')}</SectionHeading>
            </div>
            <Link href="/goals" className="text-sm text-primary">
              {t('allGoals')}
            </Link>
          </div>
          {goals.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('empty.goals')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {goals.slice(0, 5).map((g) => (
                <li key={g.id} className="flex flex-col gap-1">
                  <Link
                    href={`/goals?goal=${g.id}` as Route}
                    className="text-sm font-medium text-text"
                  >
                    {g.title}
                  </Link>
                  {g.progress.percent === null ? (
                    <p className="text-xs text-text-secondary">—</p>
                  ) : (
                    <Progress
                      done={g.progress.percent}
                      total={100}
                      label={`%${g.progress.percent}`}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      );
    }
    const items = visible(data[id]);
    const shown = items;
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
      </Panel>
    );
  };

  const total =
    TASK_WIDGETS.reduce((n, id) => n + data[id].length, 0) + projects.length + goals.length;
  // Son görev tamamlansa da "Geri al" bildirimi kaybolmaz (BR-TASK-004).
  if (total === 0) {
    return (
      <>
        {completion.ui}
        <Panel>
          <EmptyState
            icon={<Icon name="inbox" />}
            title={t('noTasksTitle')}
            description={t('noTasksDescription')}
          />
        </Panel>
      </>
    );
  }
  if (order.length === 0) {
    return (
      <>
        {completion.ui}
        <p className="text-sm text-text-secondary">{t('allHidden')}</p>
      </>
    );
  }

  // D-100: Yaklaşan görevler (Yaklaşanlar sayfasının yerine) her zaman en altta, tam genişlikte.
  const grid = order.filter((id) => id !== 'upcoming');
  return (
    <>
      {completion.ui}
      {/* Masaüstü iki sütun (sıradaki bölümler sırayla sol/sağ); mobilde sütunlar düzleşir ve sıra korunur. */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {[0, 1].map((col) => (
          <div key={col} className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-5">
            {grid.map((id, index) =>
              index % 2 === col ? (
                <div key={id} style={{ order: index }}>
                  {widget(id)}
                </div>
              ) : null,
            )}
          </div>
        ))}
      </div>
      {order.includes('upcoming') ? <div id="upcoming">{widget('upcoming')}</div> : null}
    </>
  );
}
