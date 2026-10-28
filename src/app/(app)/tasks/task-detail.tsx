'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type KeyboardEvent } from 'react';
import { apiDelete, apiPatch, apiPost, type ApiResult } from '@/client/api';
import type { TaskDetailView, TaskView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Chip } from '@/ui/components/chip';
import { Banner } from '@/ui/components/feedback';
import { Popover, PopoverClose } from '@/ui/components/popover';
import { cn } from '@/ui/cn';
import { DatePickerPanel } from './date-picker';
import { longDay, offsetLabel, shortTime } from './dates';
import { useTaskCompletion } from './task-actions';
import type { TaskUiContext } from './task-context';

type Patch = Record<string, unknown>;
type Status = 'idle' | 'saved' | 'failed' | 'conflict';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Alan değişiklikleri anında kaydedilir (BR-TASK-010). Sürüm çakışmasında değişen alan sunucuda başkası
 * tarafından değiştirilmemişse değişiklik güncel kayda otomatik yeniden uygulanır; değiştirilmişse kullanıcıya
 * "Benimkini uygula / Güncel olanı al" seçimi sunulur. Kullanıcı girişi sessizce kaybolmaz.
 */
function useTaskSaver(task: TaskView, context: TaskUiContext) {
  const router = useRouter();
  const [version, setVersion] = useState(task.version);
  const [status, setStatus] = useState<Status>('idle');
  const [pending, setPending] = useState<{ patch: Patch; current: Record<string, unknown> } | null>(
    null,
  );
  const url = `/api/v1/workspaces/${context.workspaceId}/tasks/${task.id}` as const;

  async function send(patch: Patch, v: number): Promise<ApiResult<TaskView>> {
    return apiPatch<TaskView>(url, { version: v, ...patch });
  }

  async function save(patch: Patch) {
    const result = await send(patch, version);
    if (result.ok) {
      setVersion(result.data.version);
      setStatus('saved');
      router.refresh();
      return;
    }
    if (result.status === 409 && result.error.current) {
      const current = result.error.current as Record<string, unknown> & { version: number };
      const base = task as unknown as Record<string, unknown>;
      const touchedElsewhere = Object.keys(patch).some((k) => !same(current[k], base[k]));
      if (!touchedElsewhere) {
        const retry = await send(patch, current.version);
        if (retry.ok) {
          setVersion(retry.data.version);
          setStatus('saved');
          router.refresh();
          return;
        }
      }
      setPending({ patch, current });
      setStatus('conflict');
      return;
    }
    setStatus('failed');
  }

  async function keepMine() {
    if (!pending) return;
    const result = await send(pending.patch, pending.current.version as number);
    setPending(null);
    setStatus(result.ok ? 'saved' : 'failed');
    router.refresh();
  }

  function takeTheirs() {
    setPending(null);
    setStatus('idle');
    router.refresh();
  }

  return { save, status, keepMine, takeTheirs, url };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-11 grid-cols-[116px_1fr] items-center gap-3">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const selectClass =
  'min-h-11 w-full appearance-none rounded-sm bg-transparent px-2 text-sm text-text hover:bg-surface-muted';

/** Figma "Görev detayı" paneli (4:66875). Tekrar, hatırlatıcı ve bağlı kayıtlar ilgili fazlarda eklenir. */
export function TaskDetailPanel({
  detail,
  context,
}: {
  detail: TaskDetailView | null;
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks');
  const pathname = usePathname();
  const close = (
    <Link
      href={pathname as never}
      scroll={false}
      aria-label={t('detail.close')}
      className="flex size-11 items-center justify-center rounded-sm text-xl text-text-secondary"
    >
      <span aria-hidden="true">×</span>
    </Link>
  );
  return (
    <aside
      aria-label={t('detail.label')}
      className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-surface p-5 lg:inset-auto lg:top-4 lg:right-4 lg:bottom-4 lg:w-[432px] lg:rounded-md lg:border lg:border-border"
    >
      <div className="flex items-center justify-between">
        <p className="flex-1 text-sm text-text-secondary">{t('detail.label')}</p>
        {detail && !detail.deletedAt && !detail.archivedAt ? (
          <LifecycleMenu detail={detail} context={context} />
        ) : null}
        {close}
      </div>
      {detail ? (
        <DetailBody key={`${detail.id}:${detail.version}`} detail={detail} context={context} />
      ) : (
        <p className="py-10 text-center text-sm text-text-secondary">{t('detail.notFound')}</p>
      )}
    </aside>
  );
}

function DetailBody({ detail, context }: { detail: TaskDetailView; context: TaskUiContext }) {
  const t = useTranslations('tasks');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { save, status, keepMine, takeTheirs, url } = useTaskSaver(detail, context);
  const completion = useTaskCompletion(context);
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description ?? '');
  const [tagInput, setTagInput] = useState('');
  const [subtask, setSubtask] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const done = detail.status === 'done';
  const readOnly = detail.archivedAt !== null || detail.deletedAt !== null;
  const projectNames = context.projects.map((p) => p.id);
  const subtasksDone = detail.subtasks.filter((s) => s.status === 'done').length;

  async function addSubtask() {
    if (!subtask.trim()) return;
    const result = await apiPost(
      `/api/v1/workspaces/${context.workspaceId}/tasks`,
      { title: subtask, parentTaskId: detail.id },
      { 'idempotency-key': crypto.randomUUID() },
    );
    if (result.ok) {
      setSubtask('');
      router.refresh();
    }
  }

  function onTagKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || !tagInput.trim()) return;
    event.preventDefault();
    void save({ tagNames: [...detail.tags.map((tag) => tag.name), tagInput] });
    setTagInput('');
  }

  const dueText = detail.due
    ? `${longDay(detail.due.date, locale)}${detail.due.time ? ` · ${shortTime(detail.due.time, locale, context.timeFormat)}` : ''}`
    : t('detail.noDate');

  return (
    <div className="flex flex-col gap-4 pt-2">
      <LifecycleBand detail={detail} context={context} />
      {/* BR-DEL-002 / BR-DEL-007: arşivdeki ve çöpteki görev salt okunurdur. */}
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 disabled:opacity-80">
        {detail.parentTaskId ? (
          <Button
            variant="ghost"
            className="self-start text-sm"
            onClick={async () => {
              await apiPost(`${url}/detach`, { version: detail.version });
              router.refresh();
            }}
          >
            {t('detail.detach')}
          </Button>
        ) : null}
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={cn('text-xl', done ? 'text-success' : 'text-primary')}
          >
            {done ? '✓' : detail.status === 'in_progress' ? '◐' : '○'}
          </span>
          <input
            aria-label={t('detail.title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== detail.title && void save({ title })}
            maxLength={500}
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-text"
          />
        </div>
        {done ? (
          <Button
            className="self-start"
            onClick={async () => {
              await apiPost(`${url}/reopen`, { version: detail.version });
              router.refresh();
            }}
          >
            {t('detail.reopen')}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="self-start"
            icon={<span aria-hidden="true">✓</span>}
            onClick={() => completion.complete(detail)}
          >
            {t('detail.complete')}
          </Button>
        )}
        {completion.ui}
        {status === 'conflict' ? (
          <div className="flex flex-col gap-2">
            <Banner>{t('detail.conflict')}</Banner>
            <div className="flex gap-2">
              <Button onClick={() => void keepMine()}>{t('detail.keepMine')}</Button>
              <Button variant="ghost" onClick={takeTheirs}>
                {t('detail.takeTheirs')}
              </Button>
            </div>
          </div>
        ) : status === 'failed' ? (
          <Banner>{t('detail.saveFailed')}</Banner>
        ) : null}

        <div className="flex flex-col border-b border-border pb-3">
          {detail.parentTaskId ? null : (
            <Field label={t('detail.project')}>
              <select
                aria-label={t('detail.project')}
                value={projectNames.includes(detail.projectId) ? detail.projectId : ''}
                disabled={done}
                onChange={async (e) => {
                  await apiPost(`${url}/move`, {
                    version: detail.version,
                    projectId: e.target.value,
                  });
                  router.refresh();
                }}
                className={selectClass}
              >
                {context.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t('detail.status')}>
            {done ? (
              <p className="px-2 text-sm text-text">{t('detail.statuses.done')}</p>
            ) : (
              <select
                aria-label={t('detail.status')}
                value={detail.status}
                onChange={(e) => void save({ status: e.target.value })}
                className={selectClass}
              >
                <option value="todo">{t('detail.statuses.todo')}</option>
                <option value="in_progress">{t('detail.statuses.in_progress')}</option>
              </select>
            )}
          </Field>
          <Field label={t('detail.priority')}>
            <select
              aria-label={t('detail.priority')}
              value={detail.priority}
              onChange={(e) => void save({ priority: Number(e.target.value) })}
              className={selectClass}
            >
              {[0, 1, 2, 3].map((p) => (
                <option key={p} value={p}>
                  {p > 0 ? `⚑ ${t(`priority.${p}`)}` : t('priority.0')}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('detail.start')}>
            <input
              type="date"
              aria-label={t('detail.start')}
              value={detail.startDate ?? ''}
              onChange={(e) => void save({ startDate: e.target.value || null })}
              className={selectClass}
            />
          </Field>
          <Field label={t('detail.due')}>
            <Popover
              label={t('date.title')}
              open={dateOpen}
              onOpenChange={setDateOpen}
              trigger={
                <button type="button" className={cn(selectClass, 'text-left')}>
                  {dueText}
                </button>
              }
            >
              <DatePickerPanel
                value={detail.due}
                timezone={context.timezone}
                weekStart={context.weekStart}
                onApply={(due) => {
                  setDateOpen(false);
                  void save({ due });
                }}
              />
            </Popover>
          </Field>
          {detail.due?.timezone ? (
            <p className="text-xs text-text-secondary">
              {`${detail.due.timezone} · ${offsetLabel(detail.due.timezone, new Date())}`}
            </p>
          ) : null}
          <Field label={t('detail.tags')}>
            <div className="flex flex-wrap items-center gap-1 px-2 py-1">
              {detail.tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-label={t('detail.removeTag', { tag: tag.name })}
                  onClick={() =>
                    void save({
                      tagNames: detail.tags.filter((x) => x.id !== tag.id).map((x) => x.name),
                    })
                  }
                >
                  <Chip>{`#${tag.name} ×`}</Chip>
                </button>
              ))}
              <input
                aria-label={t('detail.tags')}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKey}
                placeholder={t('detail.tagsPlaceholder')}
                className="min-h-9 min-w-[140px] flex-1 bg-transparent text-sm text-text placeholder:text-text-secondary"
              />
            </div>
          </Field>
        </div>

        <section className="flex flex-col gap-2 border-b border-border pb-4">
          <h3 className="text-base font-semibold text-text">{t('detail.description')}</h3>
          <textarea
            aria-label={t('detail.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() =>
              description !== (detail.description ?? '') &&
              void save({ description: description || null })
            }
            placeholder={t('detail.descriptionPlaceholder')}
            rows={4}
            className="w-full resize-y rounded-sm bg-transparent p-2 text-base whitespace-pre-wrap text-text placeholder:text-text-secondary hover:bg-surface-muted"
          />
        </section>

        {detail.parentTaskId ? null : (
          <section className="flex flex-col gap-1 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text">{t('detail.subtasks')}</h3>
              {detail.subtasks.length ? (
                <Chip>{`${subtasksDone}/${detail.subtasks.length}`}</Chip>
              ) : null}
            </div>
            <ul className="flex flex-col">
              {detail.subtasks.map((s) => (
                <li key={s.id} className="flex min-h-11 items-center gap-3 px-2">
                  <button
                    type="button"
                    aria-label={
                      s.status === 'done'
                        ? t('detail.reopen')
                        : t('row.complete', { title: s.title })
                    }
                    onClick={async () => {
                      await apiPost(
                        `/api/v1/workspaces/${context.workspaceId}/tasks/${s.id}/${s.status === 'done' ? 'reopen' : 'complete'}`,
                        {
                          version: s.version,
                        },
                      );
                      router.refresh();
                    }}
                    className={cn(
                      'text-base',
                      s.status === 'done' ? 'text-success' : 'text-text-secondary',
                    )}
                  >
                    <span aria-hidden="true">{s.status === 'done' ? '✓' : '○'}</span>
                  </button>
                  <Link
                    href={`${pathname}?task=${s.id}` as never}
                    scroll={false}
                    className="min-w-0 flex-1 truncate text-base text-text"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex min-h-11 items-center gap-3 px-2">
              <span aria-hidden="true" className="text-primary">
                +
              </span>
              <input
                aria-label={t('detail.addSubtask')}
                value={subtask}
                onChange={(e) => setSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addSubtask()}
                placeholder={t('detail.addSubtask')}
                maxLength={500}
                className="min-w-0 flex-1 bg-transparent text-base text-text placeholder:text-text-secondary"
              />
            </div>
          </section>
        )}
      </fieldset>
      <p role="status" aria-live="polite" className="text-xs text-text-secondary">
        {status === 'saved' ? `✓ ${t('detail.saved')} · ` : ''}
        {t('detail.footer', { date: longDay(detail.createdAt.slice(0, 10), locale) })}
      </p>
    </div>
  );
}

const DAY = 86_400_000;

/** Figma'da yok (D-065): Figma UI/Popover ve UI/Button ile "…" menüsü — Arşivle, Çöpe taşı. */
function LifecycleMenu({ detail, context }: { detail: TaskDetailView; context: TaskUiContext }) {
  const t = useTranslations('tasks.detail');
  const router = useRouter();
  const url = `/api/v1/workspaces/${context.workspaceId}/tasks/${detail.id}` as const;
  return (
    <Popover
      label={t('more')}
      trigger={
        <button
          type="button"
          aria-label={t('more')}
          className="flex size-11 items-center justify-center rounded-sm text-xl text-text-secondary"
        >
          <span aria-hidden="true">⋯</span>
        </button>
      }
    >
      <div className="flex flex-col">
        <PopoverClose asChild>
          <button
            type="button"
            className="flex min-h-11 items-center rounded-sm px-3 text-left text-sm text-text"
            onClick={async () => {
              await apiPost(`${url}/archive`, { version: detail.version });
              router.refresh();
            }}
          >
            {t('archive')}
          </button>
        </PopoverClose>
        <PopoverClose asChild>
          <button
            type="button"
            className="flex min-h-11 items-center rounded-sm px-3 text-left text-sm text-danger"
            onClick={async () => {
              await apiDelete(url);
              router.refresh();
            }}
          >
            {t('delete')}
          </button>
        </PopoverClose>
        <p className="max-w-[240px] px-3 pt-2 text-xs text-text-secondary">{t('deleteConfirm')}</p>
      </div>
    </Popover>
  );
}

/** Arşivdeki/çöpteki görev bandı (BR-DEL-007): "Arşivden çıkar" veya kalan günle "Geri yükle". */
function LifecycleBand({ detail, context }: { detail: TaskDetailView; context: TaskUiContext }) {
  const t = useTranslations('tasks.detail');
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [now] = useState(() => Date.now());
  const base = `/api/v1/workspaces/${context.workspaceId}` as const;
  if (detail.deletedAt) {
    const days = Math.max(0, Math.ceil((Date.parse(detail.deletedAt) + 30 * DAY - now) / DAY));
    return (
      <div className="flex flex-col gap-2">
        <Banner>{t('deletedBand', { days })}</Banner>
        {days > 0 ? (
          <Button
            className="self-start"
            onClick={async () => {
              const result = await apiPost(`${base}/trash/restore`, {
                id: detail.id,
                restoreParent: true,
              });
              if (!result.ok) setFailed(true);
              router.refresh();
            }}
          >
            {t('restore')}
          </Button>
        ) : null}
        {failed ? <p className="text-sm text-danger">{t('restoreFailed')}</p> : null}
      </div>
    );
  }
  if (detail.archivedAt) {
    return (
      <div className="flex flex-col gap-2">
        <Banner>{t('archivedBand')}</Banner>
        <Button
          className="self-start"
          onClick={async () => {
            await apiPost(`${base}/tasks/${detail.id}/unarchive`, { version: detail.version });
            router.refresh();
          }}
        >
          {t('unarchive')}
        </Button>
      </div>
    );
  }
  return null;
}
