'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/client/api';
import type { GoalView } from '@/modules/goals';
import type { SearchHit } from '@/modules/search';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner, EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Input } from '@/ui/components/input';
import { Popover, PopoverClose } from '@/ui/components/popover';
import { Progress } from '@/ui/components/progress';
import { cn } from '@/ui/cn';

type Status = 'active' | 'achieved' | 'abandoned';

/** Figma Hedefler (4:67474): sekmeler, hedef kartları, sağda seçili hedefin detayı. */
export function GoalsWorkspace({
  goals,
  current,
  status,
  workspaceId,
  projects,
}: {
  goals: GoalView[];
  current: GoalView | null;
  status: Status;
  workspaceId: string;
  projects: { id: string; name: string }[];
}) {
  const t = useTranslations('goals');
  const locale = useLocale();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

  const meta = (g: GoalView) =>
    `${g.targetDate ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${g.targetDate}T00:00:00Z`)) : t('noDate')} · ${t(`modes.${g.progressMode}`)}`;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className={cn('flex w-full items-start gap-4', current && 'hidden lg:flex')}>
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <Button variant="primary" icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
          {t('create')}
        </Button>
      </div>
      <nav
        aria-label={t('tabs')}
        className={cn('flex gap-1 border-b border-border', current && 'hidden lg:flex')}
      >
        {(['active', 'achieved', 'abandoned'] as const).map((s) => (
          <Link
            key={s}
            href={(s === 'active' ? pathname : `${pathname}?status=${s}`) as Route}
            aria-current={status === s ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-col justify-center p-3 text-sm font-medium',
              status === s ? 'border-b-2 border-primary text-primary' : 'text-text-secondary',
            )}
          >
            {t(`tab.${s}`)}
          </Link>
        ))}
      </nav>
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
        <ul
          className={cn(
            'flex w-full flex-col gap-3 lg:w-[360px] lg:shrink-0',
            current && 'hidden lg:flex',
          )}
        >
          {goals.length === 0 ? (
            <EmptyState
              icon={<Icon name="inbox" />}
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          ) : (
            goals.map((g) => (
              <li key={g.id}>
                <Link
                  href={
                    `${pathname}?${status === 'active' ? '' : `status=${status}&`}goal=${g.id}` as Route
                  }
                  scroll={false}
                  data-goal-card
                  aria-current={current?.id === g.id ? 'true' : undefined}
                  className={cn(
                    'flex flex-col gap-3 rounded-md border bg-surface p-4',
                    current?.id === g.id ? 'border-primary' : 'border-border',
                  )}
                >
                  <span className="text-base font-semibold text-text">{g.title}</span>
                  <span className="text-xs text-text-secondary">{meta(g)}</span>
                  <GoalProgressBar goal={g} />
                </Link>
              </li>
            ))
          )}
        </ul>
        {current ? (
          <GoalDetail
            key={`${current.id}-${current.version}`}
            goal={current}
            workspaceId={workspaceId}
            projects={projects}
            meta={meta(current)}
          />
        ) : null}
      </div>
      {creating ? (
        <CreateGoal workspaceId={workspaceId} onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}

/** BR-GOAL-002: otomatikte "2/6 · %33", manuelde "%70"; bağlı kayıt/değer yoksa "—". */
function GoalProgressBar({ goal }: { goal: GoalView }) {
  const t = useTranslations('goals');
  const p = goal.progress;
  if (p.percent === null) {
    return (
      <p className="text-sm text-text-secondary">
        <span aria-hidden="true">—</span> {p.mode === 'auto' ? t('noLinks') : t('noManual')}
      </p>
    );
  }
  const label =
    p.mode === 'auto'
      ? t('progressAuto', { done: p.done, total: p.total, percent: p.percent })
      : t('progressManual', { percent: p.percent });
  return <Progress done={p.percent} total={100} label={label} />;
}

function GoalDetail({
  goal,
  workspaceId,
  projects,
  meta,
}: {
  goal: GoalView;
  workspaceId: string;
  projects: { id: string; name: string }[];
  meta: string;
}) {
  const t = useTranslations('goals');
  const router = useRouter();
  const pathname = usePathname();
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState(goal.manualProgress ?? 0);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const url = `/api/v1/workspaces/${workspaceId}/goals/${goal.id}` as const;
  const archived = goal.archivedAt !== null;
  const links = {
    taskIds: goal.links.tasks.map((x) => x.id),
    projectIds: goal.links.projects.map((x) => x.id),
  };
  const linkedProjects = new Set(links.projectIds);

  async function patch(body: Record<string, unknown>) {
    setFailed(false);
    const result = await apiPatch(url, { version: goal.version, ...body });
    if (!result.ok) setFailed(true);
    router.refresh();
  }
  async function put(next: typeof links) {
    const result = await apiPut(`${url}/links`, next);
    if (!result.ok) setFailed(true);
    router.refresh();
  }
  async function find(value: string) {
    setQ(value);
    if (value.trim().length < 2) return setHits([]);
    const result = await apiGet<SearchHit[]>(
      `/api/v1/search?types=task&q=${encodeURIComponent(value.trim())}`,
    );
    setHits(result.ok ? result.data : []);
  }

  return (
    <section
      aria-label={goal.title}
      className="flex min-w-0 flex-1 flex-col gap-4 rounded-md border border-border bg-surface p-5"
      data-goal-detail
    >
      <Link href={pathname as Route} className="text-sm text-primary lg:hidden">
        ‹ {t('title')}
      </Link>
      <div className="flex items-start gap-3">
        <h2 className="flex-1 text-lg font-semibold text-text">{goal.title}</h2>
        <span className="text-sm text-text-secondary">{t(`status.${goal.status}`)}</span>
        <Popover
          label={t('more')}
          trigger={
            <button
              type="button"
              aria-label={t('more')}
              className="flex size-11 items-center justify-center rounded-md text-xl text-text-secondary"
            >
              ⋯
            </button>
          }
        >
          {goal.status !== 'abandoned' && !archived ? (
            <PopoverClose asChild>
              <Button
                variant="ghost"
                className="justify-start px-2 text-sm"
                onClick={() => void patch({ status: 'abandoned' })}
              >
                {t('abandon')}
              </Button>
            </PopoverClose>
          ) : null}
          {goal.status !== 'active' && !archived ? (
            <PopoverClose asChild>
              <Button
                variant="ghost"
                className="justify-start px-2 text-sm"
                onClick={() => void patch({ status: 'active' })}
              >
                {t('reactivate')}
              </Button>
            </PopoverClose>
          ) : null}
          <PopoverClose asChild>
            <Button
              variant="ghost"
              className="justify-start px-2 text-sm"
              onClick={async () => {
                await apiPost(`${url}/${archived ? 'unarchive' : 'archive'}`, {});
                router.refresh();
              }}
            >
              {archived ? t('unarchive') : t('archive')}
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button
              variant="ghost"
              className="justify-start px-2 text-sm text-danger"
              onClick={async () => {
                await apiDelete(url);
                router.replace(pathname as Route);
                router.refresh();
              }}
            >
              {t('delete')}
            </Button>
          </PopoverClose>
        </Popover>
      </div>
      <p className="text-xs text-text-secondary">{meta}</p>
      {goal.description ? (
        <p className="text-sm whitespace-pre-wrap text-text">{goal.description}</p>
      ) : null}
      {archived ? <Banner>{t('archivedBand')}</Banner> : null}
      {failed ? <Banner>{t('failed')}</Banner> : null}
      {goal.suggestAchieved ? <Banner>{t('suggestAchieved')}</Banner> : null}
      <fieldset disabled={archived} className="flex flex-col gap-4 border-t border-border pt-4">
        <legend className="sr-only">{t('progressMode')}</legend>
        <p className="text-base font-medium text-text">{t('progressMode')}</p>
        <div
          role="radiogroup"
          aria-label={t('progressMode')}
          className="flex gap-1 border-b border-border"
        >
          {(['auto', 'manual'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={goal.progressMode === mode}
              onClick={() => goal.progressMode !== mode && void patch({ progressMode: mode })}
              className={cn(
                'flex min-h-11 flex-col justify-center p-3 text-sm font-medium',
                goal.progressMode === mode
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-secondary',
              )}
            >
              {t(`modes.${mode}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-secondary">{t(`modeHint.${goal.progressMode}`)}</p>
        {goal.progressMode === 'manual' ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void patch({ manualProgress: Math.max(0, Math.min(100, Math.round(manual))) });
            }}
          >
            <Input
              label={t('manualLabel')}
              type="number"
              min={0}
              max={100}
              value={manual}
              onChange={(e) => setManual(Number(e.target.value))}
            />
            <Button type="submit">{t('save')}</Button>
          </form>
        ) : null}
        <GoalProgressBar goal={goal} />
      </fieldset>
      <section
        aria-labelledby="goal-projects"
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <div className="flex items-center">
          <h3 id="goal-projects" className="flex-1 text-base font-medium text-text">
            {t('linkedProjects')}
          </h3>
          {archived ? null : (
            <Popover
              label={t('addProject')}
              trigger={
                <Button variant="ghost" className="px-2 text-sm text-primary">
                  {t('add')}
                </Button>
              }
            >
              {projects
                .filter((p) => !linkedProjects.has(p.id))
                .map((p) => (
                  <PopoverClose asChild key={p.id}>
                    <Button
                      variant="ghost"
                      className="justify-start px-2 text-sm"
                      onClick={() =>
                        void put({ ...links, projectIds: [...links.projectIds, p.id] })
                      }
                    >
                      ▭ {p.name}
                    </Button>
                  </PopoverClose>
                ))}
            </Popover>
          )}
        </div>
        {goal.links.projects.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <Link href={`/projects/${p.id}` as Route} className="flex-1 text-primary">
              {p.name}
            </Link>
            {archived ? null : (
              <Button
                variant="ghost"
                className="px-2 text-sm"
                aria-label={t('unlink', { name: p.name })}
                onClick={() =>
                  void put({ ...links, projectIds: links.projectIds.filter((x) => x !== p.id) })
                }
              >
                ✕
              </Button>
            )}
          </div>
        ))}
      </section>
      <section aria-labelledby="goal-tasks" className="flex flex-col gap-2">
        <div className="flex items-center">
          <h3 id="goal-tasks" className="flex-1 text-base font-medium text-text">
            {t('linkedTasks')}
          </h3>
          {archived ? null : (
            <Popover
              label={t('addTask')}
              className="w-[min(340px,calc(100vw-32px))]"
              trigger={
                <Button variant="ghost" className="px-2 text-sm text-primary">
                  {t('add')}
                </Button>
              }
            >
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                {t('searchTask')}
                <input
                  value={q}
                  onChange={(e) => void find(e.target.value)}
                  className="min-h-11 rounded-sm border border-border bg-page px-3 text-base text-text"
                />
              </label>
              {hits
                .filter((h) => !links.taskIds.includes(h.id))
                .map((h) => (
                  <PopoverClose asChild key={h.id}>
                    <Button
                      variant="ghost"
                      className="justify-start px-2 text-sm"
                      onClick={() => void put({ ...links, taskIds: [...links.taskIds, h.id] })}
                    >
                      ○ {h.title}
                    </Button>
                  </PopoverClose>
                ))}
            </Popover>
          )}
        </div>
        {goal.links.tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 text-sm">
            <Link href={`/my-tasks?task=${task.id}` as Route} className="flex-1 text-primary">
              {task.status === 'done' ? '✓' : task.status === 'in_progress' ? '◐' : '○'}{' '}
              {task.title}
            </Link>
            {archived ? null : (
              <Button
                variant="ghost"
                className="px-2 text-sm"
                aria-label={t('unlink', { name: task.title })}
                onClick={() =>
                  void put({ ...links, taskIds: links.taskIds.filter((x) => x !== task.id) })
                }
              >
                ✕
              </Button>
            )}
          </div>
        ))}
        {goal.links.tasks.some((task) => linkedProjects.has(task.projectId)) ? (
          <p className="text-xs text-text-secondary">{t('countedOnce')}</p>
        ) : null}
      </section>
      {goal.status === 'active' && !archived ? (
        <Button
          variant="secondary"
          className="self-start"
          data-mark-achieved
          onClick={() => void patch({ status: 'achieved' })}
        >
          ✓ {t('markAchieved')}
        </Button>
      ) : null}
    </section>
  );
}

function CreateGoal({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const t = useTranslations('goals');
  const router = useRouter();
  const pathname = usePathname();
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError(t('titleRequired'));
    const result = await apiPost<GoalView>(
      `/api/v1/workspaces/${workspaceId}/goals`,
      {
        title: title.trim(),
        targetDate: targetDate || null,
        description: description.trim() || null,
      },
      { 'Idempotency-Key': crypto.randomUUID() },
    );
    if (!result.ok) return setError(t('failed'));
    onClose();
    router.push(`${pathname}?goal=${result.data.id}` as Route);
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={t('create')}>
      <form onSubmit={submit} className="flex w-full flex-col gap-4">
        <Input
          label={t('goalTitle')}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          error={error}
          autoFocus
        />
        <Input
          label={t('targetDate')}
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
        <label className="flex flex-col gap-2 text-sm text-text-secondary">
          {t('description')}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-sm border border-border bg-page p-3 text-base text-text"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">
            {t('create')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
