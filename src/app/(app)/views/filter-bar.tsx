'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiPost } from '@/client/api';
// Saf domain dosyası (Zod şeması ve URL dönüşümü); istemcide de aynı tanım kullanılır (BR-VIEW-002).
import {
  DUE_FILTERS,
  GROUP_KEYS,
  SORT_KEYS,
  activeConditionCount,
  taskFilterToParams,
  type TaskFilter,
  type ViewSettings,
  type ViewType,
} from '@/modules/views/domain/task-filter';
import { Button } from '@/ui/components/button';
import { Banner } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Input } from '@/ui/components/input';
import { Dialog } from '@/ui/components/dialog';
import { Popover, PopoverClose } from '@/ui/components/popover';
import { cn } from '@/ui/cn';

export type FilterOptions = {
  projects: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  /** Proje sayfasında proje koşulu sabittir; filtrede gösterilmez. */
  lockedProject?: boolean;
};

/** Görünüm adresi: filtre, sıralama, gruplama ve görünüm türü URL'de (USER_FLOWS §1.3); açık görev korunur. */
export function viewHref(
  pathname: string,
  filter: TaskFilter,
  settings: ViewSettings,
  viewType: ViewType,
  task?: string,
): Route {
  const params = taskFilterToParams(filter, settings);
  if (viewType !== 'list') params.set('view', viewType);
  if (task) params.set('task', task);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}` as Route;
}

/**
 * Figma "Liste · Pano · Takvim" sekmeleri (4:67132, 4:67253). BR-VIEW-002 / FR-VIEW-06: görünüm değişince filtre,
 * sıralama ve seçili görev korunur. Takvim sekmesi FR-VIEW-03 (Faz 6).
 */
export function ViewTabs({
  filter,
  settings,
  viewType,
  task,
}: {
  filter: TaskFilter;
  settings: ViewSettings;
  viewType: ViewType;
  task?: string | undefined;
}) {
  const t = useTranslations('projects');
  const pathname = usePathname();
  return (
    <nav aria-label={t('tabs')} className="flex w-full gap-1 border-b border-border">
      {(['list', 'board', 'calendar'] as const).map((type) => (
        <Link
          key={type}
          href={viewHref(pathname, filter, settings, type, task)}
          aria-current={viewType === type ? 'page' : undefined}
          data-view-tab={type}
          scroll={false}
          className={cn(
            'flex min-h-11 flex-col justify-center p-3 text-sm font-medium',
            viewType === type ? 'border-b-2 border-primary text-primary' : 'text-text-secondary',
          )}
        >
          {t(type)}
        </Link>
      ))}
    </nav>
  );
}

const STATUSES = ['todo', 'in_progress', 'done'] as const;
const PRIORITIES = [3, 2, 1, 0] as const;

/** Seçimli alanı filtreden çıkarır (exactOptionalPropertyTypes: `undefined` yazmak yerine anahtar silinir). */
function without<K extends keyof TaskFilter>(filter: TaskFilter, key: K): TaskFilter {
  const next = { ...filter };
  delete next[key];
  return next;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Filtre çubuğu (Figma "Filtrele" + "Manuel sıra", 4:67132): ortak filtreler (FR-VIEW-04), sıralama (FR-VIEW-05)
 * ve listede gruplama (FR-VIEW-01). Filtre paneli Figma'da yok (D-065): UI/Panel içinde onay kutuları.
 */
export function FilterBar({
  filter,
  settings,
  viewType,
  options,
  saveSlot,
}: {
  filter: TaskFilter;
  settings: ViewSettings;
  viewType: ViewType;
  options: FilterOptions;
  saveSlot?: React.ReactNode;
}) {
  const t = useTranslations('views');
  const tTasks = useTranslations('tasks');
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<TaskFilter>(filter);
  const [open, setOpen] = useState(false);
  const count = activeConditionCount({
    ...filter,
    projectId: options.lockedProject ? [] : filter.projectId,
  });

  const go = (next: TaskFilter, nextSettings: ViewSettings = settings) =>
    router.push(viewHref(pathname, next, nextSettings, viewType), { scroll: false });

  const box = 'flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text';
  const heading = 'text-xs font-medium tracking-wide text-text-secondary uppercase';
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Popover
        label={t('filters')}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft(filter);
        }}
        className="w-[min(360px,calc(100vw-32px))]"
        trigger={
          <Button variant="secondary" data-filter-button icon={<Icon name="sliders-horizontal" />}>
            {count ? t('filterCount', { count }) : t('filter')}
          </Button>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setOpen(false);
            go(draft);
          }}
        >
          <fieldset className="flex flex-col">
            <legend className={heading}>{t('status')}</legend>
            {STATUSES.map((s) => (
              <label key={s} className={box}>
                <input
                  type="checkbox"
                  checked={draft.status.includes(s)}
                  onChange={() => setDraft({ ...draft, status: toggle(draft.status, s) })}
                />
                {tTasks(`detail.statuses.${s}`)}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col">
            <legend className={heading}>{t('priority')}</legend>
            {PRIORITIES.map((p) => (
              <label key={p} className={box}>
                <input
                  type="checkbox"
                  checked={draft.priority.includes(p)}
                  onChange={() => setDraft({ ...draft, priority: toggle(draft.priority, p) })}
                />
                {tTasks(`priority.${p}`)}
              </label>
            ))}
          </fieldset>
          {options.lockedProject ? null : (
            <fieldset className="flex flex-col">
              <legend className={heading}>{t('project')}</legend>
              {options.projects.map((p) => (
                <label key={p.id} className={box}>
                  <input
                    type="checkbox"
                    checked={draft.projectId.includes(p.id)}
                    onChange={() =>
                      setDraft({ ...draft, projectId: toggle(draft.projectId, p.id) })
                    }
                  />
                  {p.name}
                </label>
              ))}
            </fieldset>
          )}
          {options.tags.length ? (
            <fieldset className="flex flex-col">
              <legend className={heading}>{t('tags')}</legend>
              {options.tags.map((tag) => (
                <label key={tag.id} className={box}>
                  <input
                    type="checkbox"
                    checked={draft.tagId.includes(tag.id)}
                    onChange={() => setDraft({ ...draft, tagId: toggle(draft.tagId, tag.id) })}
                  />
                  #{tag.name}
                </label>
              ))}
              <div className="flex gap-3">
                {(['any', 'all'] as const).map((mode) => (
                  <label key={mode} className={box}>
                    <input
                      type="radio"
                      name="tag-mode"
                      checked={draft.tagMode === mode}
                      onChange={() => setDraft({ ...draft, tagMode: mode })}
                    />
                    {t(`tagMode.${mode}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className={heading}>{t('due')}</legend>
            <select
              aria-label={t('due')}
              value={draft.due ?? ''}
              onChange={(e) => {
                const due = DUE_FILTERS.find((d) => d === e.target.value);
                setDraft(due ? { ...draft, due } : without(draft, 'due'));
              }}
              className="min-h-11 rounded-sm border border-border bg-page p-3 text-base text-text"
            >
              <option value="">—</option>
              {DUE_FILTERS.map((d) => (
                <option key={d} value={d}>
                  {t(`dueKeys.${d}`)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              {(['dueFrom', 'dueTo'] as const).map((key) => (
                <label key={key} className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
                  {t(key)}
                  <input
                    type="date"
                    value={draft[key] ?? ''}
                    onChange={(e) =>
                      setDraft(
                        e.target.value ? { ...draft, [key]: e.target.value } : without(draft, key),
                      )
                    }
                    className="min-h-11 rounded-sm border border-border bg-page p-2 text-sm text-text"
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <Input
            label={t('search')}
            value={draft.q ?? ''}
            onChange={(e) =>
              setDraft(e.target.value ? { ...draft, q: e.target.value } : without(draft, 'q'))
            }
          />
          <label className={box}>
            <input
              type="checkbox"
              checked={draft.includeArchived}
              onChange={(e) => setDraft({ ...draft, includeArchived: e.target.checked })}
            />
            {t('includeArchived')}
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              {t('apply')}
            </Button>
            <PopoverClose asChild>
              <Button
                variant="ghost"
                onClick={() =>
                  go({
                    v: filter.v,
                    status: [],
                    priority: [],
                    projectId: options.lockedProject ? filter.projectId : [],
                    tagId: [],
                    tagMode: 'any',
                    includeArchived: false,
                  })
                }
              >
                {t('clear')}
              </Button>
            </PopoverClose>
          </div>
        </form>
      </Popover>
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <span aria-hidden="true">⇅</span>
        <span className="sr-only">{t('sort')}</span>
        <select
          aria-label={t('sort')}
          value={settings.sort}
          onChange={(e) =>
            go(filter, { ...settings, sort: e.target.value as ViewSettings['sort'] })
          }
          className="min-h-11 rounded-md bg-transparent px-2 text-base font-medium text-text"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(`sortKeys.${key}`)}
            </option>
          ))}
        </select>
      </label>
      {viewType === 'list' ? (
        <select
          aria-label={t('group')}
          value={settings.groupBy}
          onChange={(e) =>
            go(filter, { ...settings, groupBy: e.target.value as ViewSettings['groupBy'] })
          }
          className="min-h-11 rounded-md bg-transparent px-2 text-base font-medium text-text"
        >
          {GROUP_KEYS.filter((key) => !(options.lockedProject && key === 'project')).map((key) => (
            <option key={key} value={key}>
              {t(`groupKeys.${key}`)}
            </option>
          ))}
        </select>
      ) : null}
      <div className="flex-1" />
      {saveSlot}
    </div>
  );
}

/** "Görünümü kaydet" (FR-VIEW-07, BR-VIEW-001): ad, tür, filtre ve sıralama kaydedilir; Figma'da form yok (D-065). */
export function SaveViewButton({
  workspaceId,
  filter,
  settings,
  viewType,
  defaultName = '',
}: {
  workspaceId: string;
  filter: TaskFilter;
  settings: ViewSettings;
  viewType: ViewType;
  defaultName?: string;
}) {
  const t = useTranslations('views');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(undefined);
    const result = await apiPost<{ id: string }>(
      `/api/v1/workspaces/${workspaceId}/views`,
      { name: name.trim(), viewType, filter, sort: settings.sort, groupBy: settings.groupBy },
      { 'Idempotency-Key': crypto.randomUUID() },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error.rule === 'BR-VIEW-001' ? t('limit') : t('failed'));
      return;
    }
    setOpen(false);
    router.push(`/views/${result.data.id}` as Route);
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" data-save-view onClick={() => setOpen(true)}>
        {t('save')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('saveTitle')}
        description={t('saveDescription')}
      >
        <form onSubmit={save} className="flex w-full flex-col gap-4">
          {error ? <Banner>{error}</Banner> : null}
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
              {t('save')}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
