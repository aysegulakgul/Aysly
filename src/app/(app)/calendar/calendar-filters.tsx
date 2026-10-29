'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { TaskFilter } from '@/modules/views/domain/task-filter';

/** Figma Takvim (4:67372): "Tüm projeler" ve "Etiketler" seçimleri; seçim URL'de, takvim tarihi korunur. */
export function CalendarFilters({
  filter,
  projects,
  tags,
}: {
  filter: TaskFilter;
  projects: { id: string; name: string }[];
  tags: { id: string; name: string }[];
}) {
  const t = useTranslations('calendar');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: 'projectId' | 'tagId', value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    if (value) next.set(key, value);
    router.push(`${pathname}?${next.toString()}` as Route, { scroll: false });
  };
  const select = 'min-h-11 rounded-md bg-transparent px-3 text-base font-medium text-text';
  return (
    <>
      <select
        aria-label={t('project')}
        value={filter.projectId[0] ?? ''}
        onChange={(e) => set('projectId', e.target.value)}
        className={select}
      >
        <option value="">{t('allProjects')}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {tags.length ? (
        <select
          aria-label={t('tags')}
          value={filter.tagId[0] ?? ''}
          onChange={(e) => set('tagId', e.target.value)}
          className={select}
        >
          <option value="">{t('allTags')}</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              #{tag.name}
            </option>
          ))}
        </select>
      ) : null}
    </>
  );
}
