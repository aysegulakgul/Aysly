'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiPost } from '@/client/api';
import type { ProjectView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Chip } from '@/ui/components/chip';
import { Banner, EmptyState, Toast } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Progress } from '@/ui/components/progress';
import { cn } from '@/ui/cn';
import { ProjectDot } from './project-color';
import { ProjectFormDialog } from './project-form';
import { updatedWhen } from './when';

export type ProjectStatusFilter = 'active' | 'on_hold' | 'completed' | 'all';
export type ProjectSort = 'updated' | 'name' | 'manual';

export const percentOf = (p: { done: number; total: number }) =>
  p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);

/** Figma Projeler (4:67037): başlık, özet, "Proje oluştur", Durum ve sıralama düğmeleri, proje kartları. */
export function ProjectsList({
  projects,
  status,
  sort,
  workspaceId,
  timezone,
  timeFormat,
  deletedBatch,
}: {
  projects: ProjectView[];
  status: ProjectStatusFilter;
  sort: ProjectSort;
  workspaceId: string;
  timezone: string;
  timeFormat: '24h' | '12h';
  /** Proje sayfasından silme sonrası: tek "Geri al" ile proje ve görevleri geri yüklenir (BR-DEL-006). */
  deletedBatch?: string | undefined;
}) {
  const t = useTranslations('projects');
  const tUi = useTranslations('ui');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [undoBatch, setUndoBatch] = useState(deletedBatch);

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

  const visible = projects.filter((p) => status === 'all' || p.status === status);
  const sorted =
    sort === 'manual'
      ? visible
      : [...visible].sort((a, b) =>
          sort === 'name'
            ? a.name.localeCompare(b.name, locale)
            : b.updatedAt.localeCompare(a.updatedAt),
        );
  const openTasks = visible.reduce(
    (n, p) => n + ((p.progress?.total ?? 0) - (p.progress?.done ?? 0)),
    0,
  );
  const href = (next: { status?: ProjectStatusFilter; sort?: ProjectSort }) => {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const o = next.sort ?? sort;
    if (s !== 'active') params.set('status', s);
    if (o !== 'updated') params.set('sort', o);
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ''}` as Route;
  };

  /** FR-PROJ-04 manuel sıra: klavyeyle de kullanılabilen yukarı/aşağı düğmeleri (tüm projeler sırasında). */
  async function move(project: ProjectView, direction: -1 | 1) {
    const index = projects.findIndex((p) => p.id === project.id);
    const neighbour = projects[index + direction];
    if (!neighbour) return;
    setFailed(false);
    const result = await apiPost(`/api/v1/workspaces/${workspaceId}/projects/reorder`, {
      id: project.id,
      ...(direction === -1 ? { beforeId: neighbour.id } : { afterId: neighbour.id }),
    });
    if (!result.ok) setFailed(true);
    router.refresh();
  }

  const when = (iso: string) =>
    updatedWhen(iso, {
      locale,
      timezone,
      timeFormat,
      today: (time) => t('when.today', { time }),
      yesterday: (time) => t('when.yesterday', { time }),
    });

  return (
    <>
      <div className="flex w-full items-start gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
          <p className="text-sm text-text-secondary">
            {t('subtitle', { projects: visible.length, open: openTasks })}
          </p>
        </div>
        <Button variant="primary" icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
          {t('create')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('statusFilter')}>
        {(['active', 'on_hold', 'completed', 'all'] as const).map((s) => (
          <Link
            key={s}
            href={href({ status: s })}
            aria-current={status === s ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-md px-3 text-base font-medium',
              status === s
                ? 'border border-border bg-surface-muted text-text'
                : 'text-text-secondary',
            )}
          >
            {s === 'all' ? t('statusAll') : t('statusLabel', { status: t(`status.${s}`) })}
          </Link>
        ))}
        <span aria-hidden="true" className="mx-1 w-px self-stretch bg-border" />
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('sort')}>
          {(['updated', 'name', 'manual'] as const).map((o) => (
            <Link
              key={o}
              href={href({ sort: o })}
              aria-current={sort === o ? 'true' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-md px-3 text-base font-medium',
                sort === o
                  ? 'border border-border bg-surface-muted text-text'
                  : 'text-text-secondary',
              )}
            >
              {o === 'updated' ? t('sortUpdated') : o === 'name' ? t('sortName') : t('sortManual')}
            </Link>
          ))}
        </div>
      </div>
      {failed ? <Banner>{t('actionFailed')}</Banner> : null}
      {projects.length === 0 ? (
        <EmptyState
          icon={<Icon name="inbox" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : sorted.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('filteredEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((project) => {
            const progress = project.progress ?? { done: 0, total: 0 };
            const index = projects.findIndex((p) => p.id === project.id);
            return (
              <li
                key={project.id}
                data-project-card
                className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link
                      href={`/projects/${project.id}` as Route}
                      className="flex items-center gap-2 text-base font-semibold text-text"
                    >
                      <ProjectDot color={project.color} />
                      <span className="truncate">{project.name}</span>
                    </Link>
                    {project.description ? (
                      <p className="truncate text-sm text-text-secondary">{project.description}</p>
                    ) : null}
                  </div>
                  <Chip>{t(`status.${project.status}`)}</Chip>
                  {sort === 'manual' ? (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        className="px-2"
                        disabled={index === 0}
                        aria-label={t('moveUp', { name: project.name })}
                        onClick={() => void move(project, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2"
                        disabled={index === projects.length - 1}
                        aria-label={t('moveDown', { name: project.name })}
                        onClick={() => void move(project, 1)}
                      >
                        ↓
                      </Button>
                    </div>
                  ) : null}
                </div>
                {progress.total > 0 ? (
                  <Progress
                    done={progress.done}
                    total={progress.total}
                    label={t('progress', {
                      ...progress,
                      percent: percentOf(progress),
                      open: progress.total - progress.done,
                    })}
                  />
                ) : (
                  <p className="text-sm text-text-secondary">{t('noTasks')}</p>
                )}
                <p className="text-xs text-text-secondary">
                  {t('updated', { when: when(project.updatedAt) })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-text-secondary">{t('inboxNote')}</p>
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
