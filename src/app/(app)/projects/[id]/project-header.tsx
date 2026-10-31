'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/client/api';
import type { ProjectView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Chip } from '@/ui/components/chip';
import { Dialog } from '@/ui/components/dialog';
import { Banner } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Popover, PopoverClose } from '@/ui/components/popover';
import { Progress } from '@/ui/components/progress';
import { ProjectDot } from '../project-color';
import { ProjectFormDialog } from '../project-form';
import { percentOf } from '../projects-board';
import { updatedWhen } from '../when';

type Preview = { tasks: number; topLevel: number; subtasks: number };

/**
 * Proje başlığı (Figma 4:67132): ad, durum, "N açık · Son güncelleme", açıklama, ilerleme (BR-PROJ-003), "Görev ekle"
 * ve "⋯" menüsü (USER_FLOWS §2.6: düzenle, tamamla, arşivle, sil). Arşivli projede salt okunur bant (BR-PROJ-004).
 */
export function ProjectHeader({
  project,
  workspaceId,
  timezone,
  timeFormat,
  existingNames,
}: {
  project: ProjectView;
  workspaceId: string;
  timezone: string;
  timeFormat: '24h' | '12h';
  existingNames: string[];
}) {
  const t = useTranslations('projects');
  const tShell = useTranslations('shell');
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const progress = project.progress ?? { done: 0, total: 0 };
  const open = progress.total - progress.done;
  const archived = project.archivedAt !== null;
  const base = `/api/v1/workspaces/${workspaceId}/projects/${project.id}` as const;

  async function act(request: () => Promise<{ ok: boolean }>) {
    setPending(true);
    setFailed(false);
    const result = await request();
    setPending(false);
    if (!result.ok) setFailed(true);
    router.refresh();
    return result.ok;
  }

  /** BR-PROJ-002: açık görev varsa "hepsini tamamla / olduğu gibi bırak / vazgeç" sorulur. */
  function complete() {
    if (open > 0) setCompleting(true);
    else void finish(false);
  }
  async function finish(completeOpenTasks: boolean) {
    setCompleting(false);
    await act(() => apiPost(`${base}/complete`, { version: project.version, completeOpenTasks }));
  }

  async function askDelete() {
    const preview = await apiGet<Preview>(`${base}/delete-preview`);
    if (!preview.ok) return setFailed(true);
    setDeleting(preview.data);
  }
  async function remove() {
    setPending(true);
    const result = await apiDelete<{ batchId: string }>(base);
    setPending(false);
    setDeleting(null);
    if (!result.ok) return setFailed(true);
    router.push(`/projects?deleted=${result.data.batchId}` as Route);
    router.refresh();
  }

  const when = updatedWhen(project.updatedAt, {
    locale,
    timezone,
    timeFormat,
    today: (time) => time,
    yesterday: (time) => t('when.yesterday', { time }),
  });
  const item = 'w-full justify-start px-2 text-sm';
  return (
    <>
      <div className="flex w-full items-start gap-3">
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-xl font-semibold text-text">
          <ProjectDot color={project.color} className="size-3" />
          <span className="truncate">{project.name}</span>
        </h1>
        {archived ? null : (
          <Button
            variant="primary"
            icon={<Icon name="plus" />}
            onClick={() => document.querySelector<HTMLInputElement>('#project-add input')?.focus()}
          >
            {tShell('addTask')}
          </Button>
        )}
        <Popover
          label={t('menu')}
          trigger={
            <button
              type="button"
              aria-label={t('menu')}
              data-project-menu
              className="flex size-11 items-center justify-center rounded-md text-xl text-text-secondary"
            >
              ⋯
            </button>
          }
        >
          {archived ? (
            <PopoverClose asChild>
              <Button
                variant="ghost"
                className={item}
                onClick={() =>
                  void act(() => apiPost(`${base}/unarchive`, { version: project.version }))
                }
              >
                {t('unarchive')}
              </Button>
            </PopoverClose>
          ) : (
            <>
              <PopoverClose asChild>
                <Button variant="ghost" className={item} onClick={() => setEditing(true)}>
                  {t('edit')}
                </Button>
              </PopoverClose>
              {(['not_started', 'active', 'on_hold'] as const)
                .filter((s) => s !== project.status)
                .map((s) => (
                  <PopoverClose asChild key={s}>
                    <Button
                      variant="ghost"
                      className={item}
                      onClick={() =>
                        void act(() => apiPatch(base, { version: project.version, status: s }))
                      }
                    >
                      {t('statusLabel', { status: t(`status.${s}`) })}
                    </Button>
                  </PopoverClose>
                ))}
              {project.status === 'completed' ? null : (
                <PopoverClose asChild>
                  <Button variant="ghost" className={item} onClick={complete}>
                    {t('complete')}
                  </Button>
                </PopoverClose>
              )}
              <PopoverClose asChild>
                <Button
                  variant="ghost"
                  className={item}
                  onClick={() =>
                    void act(() => apiPost(`${base}/archive`, { version: project.version }))
                  }
                >
                  {t('archive')}
                </Button>
              </PopoverClose>
            </>
          )}
          <PopoverClose asChild>
            <Button
              variant="ghost"
              className={`${item} text-danger`}
              onClick={() => void askDelete()}
            >
              {t('delete')}
            </Button>
          </PopoverClose>
        </Popover>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={project.status === 'completed' ? 'success' : 'neutral'}>
          {t(`status.${project.status}`)}
        </Chip>
        <p className="text-sm text-text-secondary">{t('headerMeta', { open, when })}</p>
      </div>
      {project.description ? (
        <p className="text-sm whitespace-pre-wrap text-text">{project.description}</p>
      ) : null}
      {progress.total > 0 ? (
        <Progress
          done={progress.done}
          total={progress.total}
          label={t('headerProgress', { ...progress, percent: percentOf(progress) })}
        />
      ) : (
        <p className="text-sm text-text-secondary">{t('headerNoProgress')}</p>
      )}
      {archived ? (
        <Banner>
          <span className="flex flex-wrap items-center gap-3">
            {t('archived')}
            <Button
              variant="secondary"
              loading={pending}
              onClick={() =>
                void act(() => apiPost(`${base}/unarchive`, { version: project.version }))
              }
            >
              {t('unarchive')}
            </Button>
          </span>
        </Banner>
      ) : null}
      {failed ? <Banner>{t('actionFailed')}</Banner> : null}
      {editing ? (
        <ProjectFormDialog
          open={editing}
          onOpenChange={setEditing}
          workspaceId={workspaceId}
          project={project}
          existingNames={existingNames}
        />
      ) : null}
      <Dialog
        open={completing}
        onOpenChange={setCompleting}
        context={project.name}
        title={t('completeDialog.title')}
        description={t('completeDialog.description', { open })}
      >
        <Button variant="primary" onClick={() => void finish(true)}>
          {t('completeDialog.all')}
        </Button>
        <Button onClick={() => void finish(false)}>{t('completeDialog.keep')}</Button>
        <Button variant="ghost" onClick={() => setCompleting(false)}>
          {t('completeDialog.cancel')}
        </Button>
      </Dialog>
      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        context={t('deleteDialog.context', { name: project.name })}
        title={t('deleteDialog.question')}
        description={
          deleting && deleting.tasks > 0
            ? t('deleteDialog.description', { name: project.name, ...deleting })
            : t('deleteDialog.descriptionEmpty', { name: project.name })
        }
        footnote={t('deleteDialog.footnote')}
      >
        <div className="flex gap-2">
          <Button onClick={() => setDeleting(null)}>{t('deleteDialog.cancel')}</Button>
          <Button
            variant="danger"
            loading={pending}
            data-confirm-delete
            onClick={() => void remove()}
          >
            {t('deleteDialog.confirm')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/** BR-DEL-007: çöpteki projeye doğrudan gidilince "çöp kutusunda" ekranı ve "Geri yükle". */
export function TrashedProject({
  project,
  workspaceId,
  daysLeft,
}: {
  project: ProjectView;
  workspaceId: string;
  daysLeft: number;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  async function restore() {
    const result = await apiPost(`/api/v1/workspaces/${workspaceId}/trash/restore`, {
      type: 'project',
      id: project.id,
    });
    if (!result.ok) return setFailed(true);
    router.refresh();
  }
  return (
    <>
      <h1 className="text-xl font-semibold text-text">{project.name}</h1>
      <Banner>
        <span className="flex flex-wrap items-center gap-3">
          {t('inTrash', { days: daysLeft })}
          <Button variant="secondary" onClick={() => void restore()}>
            {t('restore')}
          </Button>
        </span>
      </Banner>
      {failed ? <Banner>{t('actionFailed')}</Banner> : null}
    </>
  );
}
