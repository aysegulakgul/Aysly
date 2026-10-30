'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiDelete, apiPost } from '@/client/api';
import type { TrashGroupsView } from '@/modules/lifecycle';

type TrashGroupView = TrashGroupsView[number];
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner, EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';

type Restore = { batchId: string; projectChoice?: 'restore' | 'inbox' };

export function TrashList({
  groups,
  workspaceId,
}: {
  groups: TrashGroupView[];
  workspaceId: string;
}) {
  const t = useTranslations('trash');
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [choosing, setChoosing] = useState<string>();
  const [purging, setPurging] = useState<TrashGroupView | 'all' | null>(null);
  const base = `/api/v1/workspaces/${workspaceId}/trash` as const;

  async function restore(body: Restore) {
    setError(undefined);
    setMessage(undefined);
    setChoosing(undefined);
    const result = await apiPost<{ restored: number; movedToInbox: number }>(
      `${base}/restore`,
      body,
    );
    if (!result.ok) {
      // BR-DEL-004: görevin projesi de çöpteyse kullanıcı seçer.
      if (result.error.rule === 'BR-DEL-004') return setChoosing(body.batchId);
      return setError(result.error.message || t('failed'));
    }
    setMessage(
      result.data.movedToInbox > 0
        ? t('movedToInbox', { count: result.data.movedToInbox })
        : t('restored'),
    );
    router.refresh();
  }

  async function purge() {
    const target = purging;
    setPurging(null);
    setError(undefined);
    const result = await apiDelete(target === 'all' ? base : `${base}/${target?.batchId ?? ''}`, {
      confirm: true,
    });
    if (!result.ok) setError(t('failed'));
    router.refresh();
  }

  const title = (g: TrashGroupView) =>
    g.root.type === 'project'
      ? t('projectGroup', { title: g.root.title, count: g.count })
      : g.root.type === 'note'
        ? t('noteGroup', { title: g.root.title })
        : g.root.type === 'goal'
          ? t('goalGroup', { title: g.root.title })
          : g.count > 1
            ? t('taskGroupMore', { title: g.root.title, count: g.count - 1 })
            : t('taskGroup', { title: g.root.title });
  const projects = groups.filter((g) => g.root.type === 'project').length;
  const tasks = groups.reduce((n, g) => n + g.count, 0);

  return (
    <>
      <div className="flex w-full items-start gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('description')}</p>
        </div>
        {groups.length ? (
          <Button variant="danger" onClick={() => setPurging('all')}>
            {t('emptyTrash')}
          </Button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className={message ? 'text-sm text-success' : 'sr-only'}>
        {message ?? ''}
      </p>
      {error ? <Banner>{error}</Banner> : null}
      {groups.length === 0 ? (
        <EmptyState icon={<Icon name="inbox" />} title={t('empty')} description="" />
      ) : (
        <ul className="flex flex-col">
          {groups.map((g) => (
            <li
              key={g.batchId}
              data-trash-row
              className="flex min-h-row flex-wrap items-center gap-3 border-b border-border px-2 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-base text-text">{title(g)}</p>
                <p className="text-xs text-text-secondary">
                  {g.expired ? t('expired') : t('daysLeft', { days: g.daysLeft })}
                </p>
              </div>
              <Button
                variant="ghost"
                className="text-sm text-primary"
                disabled={g.expired}
                onClick={() => void restore({ batchId: g.batchId })}
              >
                {t('restore')}
              </Button>
              <Button variant="ghost" className="text-sm text-danger" onClick={() => setPurging(g)}>
                {t('purge')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={choosing !== undefined}
        onOpenChange={(open) => !open && setChoosing(undefined)}
        title={t('choiceTitle')}
        description={t('choiceDescription')}
      >
        <Button
          variant="primary"
          onClick={() => choosing && void restore({ batchId: choosing, projectChoice: 'restore' })}
        >
          {t('restoreProject')}
        </Button>
        <Button
          onClick={() => choosing && void restore({ batchId: choosing, projectChoice: 'inbox' })}
        >
          {t('restoreToInbox')}
        </Button>
        <Button variant="ghost" onClick={() => setChoosing(undefined)}>
          {t('cancel')}
        </Button>
      </Dialog>
      <Dialog
        open={purging !== null}
        onOpenChange={(open) => !open && setPurging(null)}
        title={purging === 'all' ? t('emptyTitle') : t('purgeTitle')}
        description={
          purging === 'all'
            ? t('emptyDescription', { projects, tasks })
            : purging
              ? t('purgeDescription', { title: title(purging) })
              : undefined
        }
      >
        <div className="flex gap-2">
          <Button onClick={() => setPurging(null)}>{t('cancel')}</Button>
          <Button variant="danger" onClick={() => void purge()}>
            {t('confirm')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
