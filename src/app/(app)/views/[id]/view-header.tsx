'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiDelete, apiPatch } from '@/client/api';
import type { GroupKey, SortKey, TaskFilter, ViewType } from '@/modules/views/domain/task-filter';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner } from '@/ui/components/feedback';
import { Input } from '@/ui/components/input';

/** Kayıtlı görünüm başlığı: yeniden adlandır, değişiklikleri kaydet, sil (Figma'da yok, D-065). */
export function ViewHeader({
  view,
  workspaceId,
  changes,
  count,
}: {
  view: { id: string; name: string; version: number };
  workspaceId: string;
  changes: { filter: TaskFilter; sort: SortKey; groupBy: GroupKey; viewType: ViewType } | null;
  count: number;
}) {
  const t = useTranslations('views');
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(view.name);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const url = `/api/v1/workspaces/${workspaceId}/views/${view.id}` as const;

  async function patch(body: Record<string, unknown>) {
    setPending(true);
    setFailed(false);
    const result = await apiPatch(url, { version: view.version, ...body });
    setPending(false);
    if (!result.ok) return setFailed(true);
    setRenaming(false);
    router.replace(`/views/${view.id}` as Route);
    router.refresh();
  }

  async function remove() {
    const result = await apiDelete(url);
    if (!result.ok) return setFailed(true);
    router.push('/projects');
    router.refresh();
  }

  return (
    <>
      <div className="flex w-full flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold text-text">
            <span aria-hidden="true">☆ </span>
            {view.name}
          </h1>
          <p className="text-sm text-text-secondary">{t('count', { count })}</p>
        </div>
        {changes ? (
          <Button variant="primary" loading={pending} onClick={() => void patch(changes)}>
            {t('update')}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => setRenaming(true)}>
          {t('rename')}
        </Button>
        <Button variant="ghost" className="text-danger" onClick={() => setDeleting(true)}>
          {t('delete')}
        </Button>
      </div>
      {failed ? <Banner>{t('failed')}</Banner> : null}
      <Dialog open={renaming} onOpenChange={setRenaming} title={t('rename')}>
        <form
          className="flex w-full flex-col gap-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (name.trim()) void patch({ name: name.trim() });
          }}
        >
          <Input
            label={t('name')}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={pending}>
              {t('rename')}
            </Button>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('deleteTitle')}
        description={t('deleteDescription', { name: view.name })}
      >
        <div className="flex gap-2">
          <Button onClick={() => setDeleting(false)}>{t('cancel')}</Button>
          <Button variant="danger" onClick={() => void remove()}>
            {t('deleteConfirm')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
