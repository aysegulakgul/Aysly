'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type DragEvent, type FormEvent } from 'react';
import { apiPatch, apiPost } from '@/client/api';
import type { TaskView } from '@/modules/tasks';
import type { TaskFilter, ViewSettings } from '@/modules/views/domain/task-filter';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Popover, PopoverClose } from '@/ui/components/popover';
import { cn } from '@/ui/cn';
import { shortDate, shortTime } from '../tasks/dates';
import type { TaskUiContext } from '../tasks/task-context';
import { isOverdue } from '../tasks/task-row';
import { viewHref } from './filter-bar';

const COLUMNS = ['todo', 'in_progress', 'on_hold', 'done'] as const;
type Status = (typeof COLUMNS)[number];
const DONE_LIMIT = 20; // UI_UX §9.3: Tamamlandı sütununda son 20, "Tümünü gör"
const TAG_LIMIT = 3; // UI_UX §6 BoardCard: en fazla 3 etiket + "+2"
const GLYPH: Record<Status, string> = { todo: '○', in_progress: '◐', on_hold: '‖', done: '✓' };

type Drop = { status: Status; beforeId?: string | undefined; afterId?: string | undefined };

/**
 * Pano (FR-VIEW-02, Figma 4:67253, mobil 4:68533): sütunlar durumlardır. D-083: masaüstünde sürükle-bırak; her
 * boyutta kart menüsünde "Durumu değiştir" ve "Yukarı/Aşağı taşı" klavye ve dokunmatik alternatifidir. Durum
 * değişikliği tekil kurallardan geçer: "Tamamlandı"ya geçiş tamamlama işlemiyle (BR-TASK-004, açık alt görev varsa
 * BR-SUB-003 sorusu), oradan çıkış yeniden açmayla; sütun içi sıra BR-TASK-006 konumuyla.
 */
export function Board({
  tasks,
  context,
  projectId,
  filter,
  settings,
  readOnly = false,
}: {
  tasks: TaskView[];
  context: TaskUiContext;
  /** Proje sayfasında sütundan doğrudan görev eklenir. */
  projectId?: string | undefined;
  filter: TaskFilter;
  settings: ViewSettings;
  readOnly?: boolean;
}) {
  const t = useTranslations('board');
  const tTasks = useTranslations('tasks');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [local, setLocal] = useState(tasks);
  const [dragging, setDragging] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [asking, setAsking] = useState<{ task: TaskView; drop: Drop }>();
  // Sunucudan yeni liste gelince iyimser yerel sıra bırakılır (önceki prop ile karşılaştırma, React önerisi).
  const [source, setSource] = useState(tasks);
  if (source !== tasks) {
    setSource(tasks);
    setLocal(tasks);
  }

  const base = `/api/v1/workspaces/${context.workspaceId}/tasks` as const;
  const column = (status: Status) => local.filter((task) => task.status === status);
  const statusName = (status: Status) => tTasks(`detail.statuses.${status}`);

  async function apply(task: TaskView, drop: Drop, completeSubtasks = false) {
    setAsking(undefined);
    setFailed(false);
    // İyimser yerleşim: kart hemen hedef sütuna ve konuma geçer; sunucu yanıtı sonra yenilenir.
    setLocal((list) => {
      const rest = list.filter((x) => x.id !== task.id);
      const moved = { ...task, status: drop.status };
      const anchor = drop.beforeId ? rest.findIndex((x) => x.id === drop.beforeId) : -1;
      const after = drop.afterId ? rest.findIndex((x) => x.id === drop.afterId) : -1;
      const index = anchor >= 0 ? anchor : after >= 0 ? after + 1 : rest.length;
      return [...rest.slice(0, index), moved, ...rest.slice(index)];
    });
    let version = task.version;
    let ok = true;
    if (drop.status !== task.status) {
      if (drop.status === 'done') {
        const r = await apiPost<{ version: number }>(`${base}/${task.id}/complete`, {
          version,
          ...(completeSubtasks ? { completeSubtasks: true } : {}),
        });
        ok = r.ok;
        if (r.ok) version = r.data.version;
      } else {
        if (task.status === 'done') {
          const r = await apiPost<{ version: number }>(`${base}/${task.id}/reopen`, { version });
          ok = r.ok;
          if (r.ok) version = r.data.version;
        }
        if (ok && (task.status !== 'done' || drop.status === 'in_progress')) {
          const r = await apiPatch<{ version: number }>(`${base}/${task.id}`, {
            version,
            status: drop.status,
          });
          ok = r.ok;
          if (r.ok) version = r.data.version;
        }
      }
    }
    if (ok && (drop.beforeId || drop.afterId)) {
      const r = await apiPost(`${base}/${task.id}/move`, {
        version,
        ...(drop.beforeId ? { beforeId: drop.beforeId } : {}),
        ...(drop.afterId ? { afterId: drop.afterId } : {}),
      });
      ok = r.ok;
    }
    if (!ok) setFailed(true);
    else setAnnounce(t('moved', { title: task.title, status: statusName(drop.status) }));
    router.refresh();
  }

  function request(task: TaskView, drop: Drop) {
    if (readOnly) return;
    const open = task.subtaskCount.total - task.subtaskCount.done;
    if (drop.status === 'done' && task.status !== 'done' && open > 0) setAsking({ task, drop });
    else void apply(task, drop);
  }

  function onDrop(event: DragEvent, drop: Drop) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer.getData('text/plain');
    setDragging(undefined);
    const task = local.find((x) => x.id === id);
    if (task && task.id !== drop.beforeId) request(task, drop);
  }

  function shift(task: TaskView, direction: -1 | 1) {
    const list = column(task.status as Status);
    const index = list.findIndex((x) => x.id === task.id);
    const neighbour = list[index + direction];
    if (!neighbour) return;
    request(task, {
      status: task.status as Status,
      ...(direction === -1 ? { beforeId: neighbour.id } : { afterId: neighbour.id }),
    });
  }

  const cardMeta = (task: TaskView) => {
    const parts: string[] = [];
    if (task.due) {
      parts.push(
        task.due.date === context.today ? tTasks('row.today') : shortDate(task.due.date, locale),
      );
      if (task.due.time) parts.push(shortTime(task.due.time, locale, context.timeFormat));
    } else parts.push(tTasks('row.noDate'));
    if (task.subtaskCount.total > 0)
      parts.push(`${task.subtaskCount.done}/${task.subtaskCount.total}`);
    if (task.priority > 0) parts.push(`⚑ ${tTasks(`priority.${task.priority}`)}`);
    return parts.join(' · ');
  };

  const counts = asking?.task.subtaskCount ?? { total: 0, done: 0 };
  return (
    <div className="flex w-full flex-col gap-3">
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {failed ? <Banner>{t('failed')}</Banner> : null}
      {readOnly ? <p className="text-sm text-text-secondary">{t('readOnly')}</p> : null}
      <div
        aria-label={t('label')}
        role="region"
        className="flex w-full flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start"
      >
        {COLUMNS.map((status) => {
          const all = column(status);
          const shown = status === 'done' ? all.slice(-DONE_LIMIT) : all;
          return (
            <section
              key={status}
              data-board-column={status}
              aria-label={t('column', { status: statusName(status), count: all.length })}
              onDragOver={(e) => !readOnly && e.preventDefault()}
              onDrop={(e) => onDrop(e, { status })}
              className={cn(
                'flex min-h-40 flex-col gap-3 rounded-md border border-border bg-surface-muted p-3',
                dragging && 'outline-1 outline-dashed outline-border',
              )}
            >
              <h2 className="flex items-center gap-2 text-sm font-medium text-text">
                <span aria-hidden="true">{GLYPH[status]}</span>
                <span className="flex-1">{statusName(status)}</span>
                <span className="rounded-sm border border-border px-1.5 text-xs text-text-secondary">
                  {all.length}
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {shown.map((task, index) => (
                  <li
                    key={task.id}
                    data-board-card
                    data-task-id={task.id}
                    draggable={!readOnly}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', task.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragging(task.id);
                    }}
                    onDragEnd={() => setDragging(undefined)}
                    onDragOver={(e) => !readOnly && e.preventDefault()}
                    onDrop={(e) => onDrop(e, { status, beforeId: task.id })}
                    className={cn(
                      'flex flex-col gap-2 rounded-md border border-border bg-surface p-3',
                      !readOnly && 'lg:cursor-grab',
                      dragging === task.id && 'opacity-50',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'pt-0.5 text-sm',
                          status === 'done'
                            ? 'text-success'
                            : status === 'in_progress'
                              ? 'text-primary'
                              : 'text-text-secondary',
                        )}
                      >
                        {GLYPH[status]}
                      </span>
                      <Link
                        href={`${viewHref(pathname, filter, settings, 'board', task.id)}` as Route}
                        scroll={false}
                        className={cn(
                          'min-w-0 flex-1 text-base text-text',
                          status === 'done' && 'line-through',
                        )}
                      >
                        {task.title}
                      </Link>
                      {readOnly ? null : (
                        <Popover
                          label={t('cardMenu', { title: task.title })}
                          trigger={
                            <button
                              type="button"
                              aria-label={t('cardMenu', { title: task.title })}
                              data-card-menu
                              className="flex size-11 shrink-0 items-center justify-center rounded-sm text-text-secondary lg:size-8"
                            >
                              ⋯
                            </button>
                          }
                        >
                          <p className="text-xs text-text-secondary">{t('changeStatus')}</p>
                          {COLUMNS.filter((s) => s !== status).map((s) => (
                            <PopoverClose asChild key={s}>
                              <Button
                                variant="ghost"
                                className="justify-start px-2 text-sm"
                                onClick={() => request(task, { status: s })}
                              >
                                {GLYPH[s]} {statusName(s)}
                              </Button>
                            </PopoverClose>
                          ))}
                          <PopoverClose asChild>
                            <Button
                              variant="ghost"
                              className="justify-start px-2 text-sm"
                              disabled={index === 0}
                              onClick={() => shift(task, -1)}
                            >
                              ↑ {t('moveUp')}
                            </Button>
                          </PopoverClose>
                          <PopoverClose asChild>
                            <Button
                              variant="ghost"
                              className="justify-start px-2 text-sm"
                              disabled={index === shown.length - 1}
                              onClick={() => shift(task, 1)}
                            >
                              ↓ {t('moveDown')}
                            </Button>
                          </PopoverClose>
                        </Popover>
                      )}
                    </div>
                    {task.tags.length ? (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.slice(0, TAG_LIMIT).map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-sm border border-border bg-surface-muted px-2 py-0.5 text-xs text-text-secondary"
                          >
                            #{tag.name}
                          </span>
                        ))}
                        {task.tags.length > TAG_LIMIT ? (
                          <span className="px-1 text-xs text-text-secondary">
                            +{task.tags.length - TAG_LIMIT}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <p
                      className={cn(
                        'text-xs',
                        isOverdue(task, context.today)
                          ? 'text-danger'
                          : task.due?.date === context.today
                            ? 'text-warning'
                            : 'text-text-secondary',
                      )}
                    >
                      {cardMeta(task)}
                    </p>
                  </li>
                ))}
              </ul>
              {status === 'done' && all.length > DONE_LIMIT ? (
                <Link
                  href={viewHref(pathname, { ...filter, status: ['done'] }, settings, 'list')}
                  className="text-sm text-primary"
                >
                  {t('showAll')}
                </Link>
              ) : null}
              {projectId && status !== 'done' && !readOnly ? (
                <ColumnAdd context={context} projectId={projectId} status={status} />
              ) : null}
            </section>
          );
        })}
      </div>
      <Dialog
        open={asking !== undefined}
        onOpenChange={(open) => !open && setAsking(undefined)}
        context={asking?.task.title}
        title={tTasks('completeDialog.title')}
        description={tTasks('completeDialog.description', {
          ...counts,
          open: counts.total - counts.done,
        })}
        footnote={tTasks('completeDialog.footnote')}
      >
        <Button
          variant="primary"
          onClick={() => asking && void apply(asking.task, asking.drop, true)}
        >
          {tTasks('completeDialog.all')}
        </Button>
        <Button onClick={() => asking && void apply(asking.task, asking.drop)}>
          {tTasks('completeDialog.onlyParent')}
        </Button>
        <Button variant="ghost" onClick={() => setAsking(undefined)}>
          {tTasks('completeDialog.cancel')}
        </Button>
      </Dialog>
    </div>
  );
}

/** Sütundan görev ekleme (Figma "+ Görev ekle"): projenin sonuna; "Devam ediyor" sütununda durum da ayarlanır. */
function ColumnAdd({
  context,
  projectId,
  status,
}: {
  context: TaskUiContext;
  projectId: string;
  status: 'todo' | 'in_progress' | 'on_hold';
}) {
  const t = useTranslations('board');
  const tViews = useTranslations('views');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    setFailed(false);
    const base = `/api/v1/workspaces/${context.workspaceId}/tasks` as const;
    const created = await apiPost<{ id: string; version: number }>(
      base,
      { title: title.trim(), projectId },
      { 'Idempotency-Key': crypto.randomUUID() },
    );
    if (created.ok && status !== 'todo') {
      await apiPatch(`${base}/${created.data.id}`, { version: created.data.version, status });
    }
    setPending(false);
    if (!created.ok) return setFailed(true);
    setTitle('');
    router.refresh();
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="justify-start px-2"
        icon={<Icon name="plus" />}
        onClick={() => setOpen(true)}
      >
        {t('add')}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {failed ? <Banner>{t('failed')}</Banner> : null}
      <input
        aria-label={t('add')}
        value={title}
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="min-h-11 rounded-sm border border-border bg-page p-3 text-base text-text"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={pending}>
          {t('add')}
        </Button>
        <Button variant="ghost" aria-label={tViews('cancel')} onClick={() => setOpen(false)}>
          ✕
        </Button>
      </div>
    </form>
  );
}
