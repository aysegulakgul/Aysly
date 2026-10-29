'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiDelete, apiPatch } from '@/client/api';
import type { ManagedTag } from '@/modules/tags';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner } from '@/ui/components/feedback';
import { PROJECT_COLOR_NAMES, ProjectDot } from '../../projects/project-color';

/** Etiket satırları: ad alan bazında anında kaydedilir (USER_FLOWS §2.7 ile aynı yaklaşım), renk seçimi, silme onayı. */
export function TagsForm({ tags, workspaceId }: { tags: ManagedTag[]; workspaceId: string }) {
  const t = useTranslations('tags');
  const tColors = useTranslations('projects.color');
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [deleting, setDeleting] = useState<ManagedTag | null>(null);
  const base = `/api/v1/workspaces/${workspaceId}/tags` as const;

  async function save(tag: ManagedTag, body: { name?: string; color?: string }) {
    setError(undefined);
    setSaved(undefined);
    const result = await apiPatch(`${base}/${tag.id}`, body);
    if (!result.ok) {
      setError(result.error.rule === 'BR-TAG-001' ? t('duplicate') : t('failed'));
      router.refresh();
      return;
    }
    setSaved(t('saved'));
    router.refresh();
  }

  async function remove() {
    const tag = deleting;
    setDeleting(null);
    if (!tag) return;
    const result = await apiDelete(`${base}/${tag.id}`);
    if (!result.ok) setError(t('failed'));
    router.refresh();
  }

  if (tags.length === 0) return <p className="text-sm text-text-secondary">{t('empty')}</p>;
  return (
    <>
      <p role="status" aria-live="polite" className={saved ? 'text-sm text-success' : 'sr-only'}>
        {saved ?? ''}
      </p>
      {error ? <Banner>{error}</Banner> : null}
      <ul className="flex flex-col">
        {tags.map((tag) => (
          <li
            key={`${tag.id}-${tag.name}-${tag.color}`}
            data-tag-row
            className="flex flex-wrap items-center gap-3 border-b border-border py-2"
          >
            <ProjectDot color={tag.color} />
            <input
              aria-label={t('name', { name: tag.name })}
              defaultValue={tag.name}
              maxLength={50}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== tag.name) void save(tag, { name });
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="min-h-11 min-w-0 flex-1 rounded-sm border border-border bg-page px-3 text-base text-text"
            />
            <select
              aria-label={t('color', { name: tag.name })}
              defaultValue={tag.color}
              onChange={(e) => void save(tag, { color: e.target.value })}
              className="min-h-11 rounded-sm border border-border bg-page px-2 text-sm text-text"
            >
              {PROJECT_COLOR_NAMES.map((c) => (
                <option key={c} value={c}>
                  {tColors(c)}
                </option>
              ))}
            </select>
            <span className="w-24 text-xs text-text-secondary">
              {t('usage', { count: tag.tasks })}
            </span>
            <Button
              variant="ghost"
              className="text-sm text-danger"
              aria-label={t('deleteLabel', { name: tag.name })}
              onClick={() => setDeleting(tag)}
            >
              {t('delete')}
            </Button>
          </li>
        ))}
      </ul>
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteTitle')}
        description={
          deleting
            ? t('deleteDescription', { name: deleting.name, count: deleting.tasks })
            : undefined
        }
      >
        <div className="flex gap-2">
          <Button onClick={() => setDeleting(null)}>{t('cancel')}</Button>
          <Button variant="danger" onClick={() => void remove()}>
            {t('confirm')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
