'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type DragEvent } from 'react';
import { apiPatch, apiPost } from '@/client/api';
import type { ProjectView, TaskView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Banner, EmptyState, Toast } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { cn } from '@/ui/cn';
import { shortDate } from '../tasks/dates';
import { Avatar, Pill, STATUS_COLOR } from '../tasks/pills';
import { PROJECT_COLOR_VALUES, type ProjectColorName } from './project-color';
import { ProjectFormDialog } from './project-form';

const COLUMNS = ['active', 'on_hold', 'completed'] as const;
type Column = (typeof COLUMNS)[number];
const COLUMN_COLOR: Record<Column, string> = {
  active: 'blue',
  on_hold: 'amber',
  completed: 'green',
};
const TASKS_PER_CARD = 5;

export const percentOf = (p: { done: number; total: number }) =>
  p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);

/**
 * Projeler panosu (D-100; ürün sahibinin ekran görüntüsü): durum sütunları (Aktif, Beklemede, Tamamlandı), renkli
 * proje kartları, ilerleme, görevler statüleri ve alt görev sayılarıyla. Masaüstünde kart sürüklenerek durum
 * değişir; her cihazda kart menüsündeki durum seçimiyle de (D-083 ile aynı ilke).
 */
export function ProjectsBoard({
  projects,
  tasks,
  workspaceId,
  deletedBatch,
}: {
  projects: ProjectView[];
  tasks: Record<string, TaskView[]>;
  workspaceId: string;
  deletedBatch?: string | undefined;
}) {
  const t = useTranslations('projects');
  const tTasks = useTranslations('tasks');
  const tUi = useTranslations('ui');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [over, setOver] = useState<Column | null>(null);
  const [undoBatch, setUndoBatch] = useState(deletedBatch);

  async function setStatus(project: ProjectView, status: Column) {
    if (project.status === status) return;
    setFailed(false);
    const result = await apiPatch(`/api/v1/workspaces/${workspaceId}/projects/${project.id}`, {
      version: project.version,
      status,
    });
    if (!result.ok) setFailed(true);
    router.refresh();
  }

  async function undoDelete() {
    if (!undoBatch) return;
    setUndoBatch(undefined);
    const result = await apiPost(`/api/v1/workspaces/${workspaceId}/trash/restore`, {
      batchId: undoBatch,
    });
    if (!result.ok) setFailed(true);
    router.replace(pathname as Route);
    router.refresh();
  }

  function onDrop(event: DragEvent, column: Column) {
    event.preventDefault();
    setOver(null);
    const project = projects.find((p) => p.id === event.dataTransfer.getData('text/plain'));
    if (project) void setStatus(project, column);
  }

  const totals = projects.reduce(
    (acc, p) => ({
      done: acc.done + (p.progress?.done ?? 0),
      total: acc.total + (p.progress?.total ?? 0),
    }),
    { done: 0, total: 0 },
  );
  const stats = [
    { label: t('overview.stats.projects'), value: projects.length },
    {
      label: t('overview.stats.active'),
      value: projects.filter((p) => p.status === 'active').length,
    },
    { label: t('overview.stats.open'), value: totals.total - totals.done },
    { label: t('overview.stats.done'), value: `%${percentOf(totals)}` },
  ];

  return (
    <>
      <div className="flex w-full flex-wrap items-start gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('overview.subtitle')}</p>
        </div>
        <Button variant="primary" icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
          {t('create')}
        </Button>
      </div>
      {/* Özet şeridi (D-100: önerilen iyileştirme) */}
      <dl className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4"
          >
            <dt className="text-xs text-text-secondary">{s.label}</dt>
            <dd className="text-2xl font-semibold text-text">{s.value}</dd>
          </div>
        ))}
      </dl>
      {failed ? <Banner>{t('actionFailed')}</Banner> : null}
      {projects.length === 0 ? (
        <EmptyState
          icon={<Icon name="inbox" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="flex w-full gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((column) => {
            const cards = projects.filter((p) => p.status === column);
            return (
              <section
                key={column}
                aria-labelledby={`column-${column}`}
                data-board-column={column}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(column);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => onDrop(e, column)}
                className={cn(
                  'flex min-w-[300px] flex-1 flex-col gap-3 rounded-md bg-surface-muted p-3',
                  over === column && 'ring-2 ring-primary',
                )}
              >
                <h2
                  id={`column-${column}`}
                  className="flex items-center gap-2 px-1 text-base font-semibold text-text"
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        PROJECT_COLOR_VALUES[COLUMN_COLOR[column] as ProjectColorName],
                    }}
                  />
                  {t(`status.${column}`)}
                  <span className="text-sm font-normal text-text-secondary">{cards.length}</span>
                </h2>
                {cards.length === 0 ? (
                  <p className="px-1 py-4 text-sm text-text-secondary">
                    {t('overview.emptyColumn')}
                  </p>
                ) : null}
                {cards.map((project) => {
                  const progress = project.progress ?? { done: 0, total: 0 };
                  const list = tasks[project.id] ?? [];
                  const color =
                    PROJECT_COLOR_VALUES[project.color as ProjectColorName] ??
                    PROJECT_COLOR_VALUES.slate;
                  const people = [
                    ...new Map(
                      list.flatMap((task) =>
                        task.assignee ? [[task.assignee.id, task.assignee]] : [],
                      ),
                    ).values(),
                  ];
                  return (
                    <article
                      key={project.id}
                      data-project-card
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', project.id)}
                      className="flex flex-col gap-3 overflow-hidden rounded-md border border-border bg-surface"
                    >
                      <div
                        aria-hidden="true"
                        className="h-1.5 w-full"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex flex-col gap-3 px-4 pb-4">
                        <div className="flex items-start gap-2">
                          <Link
                            href={`/projects/${project.id}` as Route}
                            className="min-w-0 flex-1 text-base font-semibold text-text hover:underline"
                          >
                            {project.name}
                          </Link>
                          <select
                            value={project.status}
                            aria-label={t('overview.statusOf', { name: project.name })}
                            onChange={(e) => void setStatus(project, e.target.value as Column)}
                            className="min-h-8 rounded-sm border border-border bg-surface px-1 text-xs text-text"
                          >
                            {COLUMNS.map((c) => (
                              <option key={c} value={c}>
                                {t(`status.${c}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {project.description ? (
                          <p className="line-clamp-2 text-sm text-text-secondary">
                            {project.description}
                          </p>
                        ) : null}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs text-text-secondary">
                            <span>
                              {t('overview.progress', {
                                done: progress.done,
                                total: progress.total,
                              })}
                            </span>
                            <span className="font-medium text-text">%{percentOf(progress)}</span>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={t('overview.progressOf', { name: project.name })}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percentOf(progress)}
                            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
                          >
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${percentOf(progress)}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                        {list.length ? (
                          <ul className="flex flex-col gap-1.5">
                            {list.slice(0, TASKS_PER_CARD).map((task) => (
                              <li key={task.id} className="flex items-center gap-2 text-sm">
                                <Pill color={STATUS_COLOR[task.status]!} className="shrink-0">
                                  {tTasks(`status.${task.status}`)}
                                </Pill>
                                <Link
                                  href={`/projects/${project.id}?task=${task.id}` as Route}
                                  className={cn(
                                    'min-w-0 flex-1 truncate',
                                    task.status === 'done'
                                      ? 'text-text-secondary line-through'
                                      : 'text-text',
                                  )}
                                >
                                  {task.title}
                                </Link>
                                {task.subtaskCount.total > 0 ? (
                                  <span className="shrink-0 text-xs text-text-secondary">
                                    {`${task.subtaskCount.done}/${task.subtaskCount.total} ⑂`}
                                  </span>
                                ) : null}
                                {task.assignee ? (
                                  <Avatar
                                    name={task.assignee.name}
                                    color={task.assignee.color}
                                    size="sm"
                                  />
                                ) : null}
                              </li>
                            ))}
                            {list.length > TASKS_PER_CARD ? (
                              <li>
                                <Link
                                  href={`/projects/${project.id}` as Route}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {t('overview.more', { count: list.length - TASKS_PER_CARD })}
                                </Link>
                              </li>
                            ) : null}
                          </ul>
                        ) : (
                          <p className="text-sm text-text-secondary">{t('noTasks')}</p>
                        )}
                        <div className="flex items-center gap-2 border-t border-border pt-3">
                          <div className="flex -space-x-1.5">
                            {people.slice(0, 4).map((p) => (
                              <Avatar key={p.id} name={p.name} color={p.color} size="sm" />
                            ))}
                          </div>
                          <span className="flex-1" />
                          {(() => {
                            const next = list
                              .filter((task) => task.status !== 'done' && task.due)
                              .sort((a, b) => a.due!.date.localeCompare(b.due!.date))[0];
                            return next ? (
                              <span className="text-xs text-text-secondary">
                                {t('overview.next', { date: shortDate(next.due!.date, locale) })}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
      {undoBatch ? (
        <div className="fixed inset-x-4 bottom-[100px] z-20 mx-auto max-w-[420px] lg:right-auto lg:bottom-6 lg:left-[264px] lg:mx-0 lg:w-[420px]">
          <Toast
            icon={<Icon name="check" />}
            message={t('deletedGeneric')}
            actionLabel={tUi('undo')}
            onAction={() => void undoDelete()}
          />
        </div>
      ) : null}
      {creating ? (
        <ProjectFormDialog
          open={creating}
          onOpenChange={setCreating}
          workspaceId={workspaceId}
          existingNames={projects.filter((p) => p.status === 'active').map((p) => p.name)}
        />
      ) : null}
    </>
  );
}
