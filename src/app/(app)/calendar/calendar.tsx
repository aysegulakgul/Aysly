'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { apiPatch, apiPost } from '@/client/api';
import type { TaskView } from '@/modules/tasks';
import { Banner } from '@/ui/components/feedback';
import { cn } from '@/ui/cn';
import { addDays, monthGrid, offsetLabel, shortTime, todayIn, weekday } from '../tasks/dates';
import { GiveDate } from '../tasks/row-actions';
import type { TaskUiContext } from '../tasks/task-context';
import { isOverdue } from '../tasks/task-row';
import { PROJECT_COLOR_VALUES, type ProjectColorName } from '../projects/project-color';

/** D-100: proje rengi (takvim çipleri ve dolu günler). */
const hex = (color: string) =>
  PROJECT_COLOR_VALUES[color as ProjectColorName] ?? PROJECT_COLOR_VALUES.slate;

export type CalendarMode = 'month' | 'week' | 'day';
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MONTH_CELL_LIMIT = 3;

/** FR-CAL-06: saatli görev kullanıcının saat diliminde gösterilir; tüm gün görevin tarihi yüzendir (BR-DATE-001). */
/** D-100: alt görev takvimde ↳ ile işaretlenir. */
const taskLabel = (task: { title: string; parentTaskId: string | null }) =>
  task.parentTaskId ? `↳ ${task.title}` : task.title;

function placement(
  task: TaskView,
  timezone: string,
): { date: string; minutes: number | null } | null {
  if (!task.due) return null;
  if (!task.due.at) return { date: task.due.date, minutes: null };
  const at = new Date(task.due.at);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: todayIn(timezone, at), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const startOfWeek = (date: string, weekStart: number) =>
  addDays(date, -((weekday(date) - weekStart + 7) % 7));

/**
 * Takvim (FR-CAL-01..04, FR-CAL-06; Figma 4:67372 masaüstü, 4:68640 mobil). Ay / Hafta / Gün; tüm gün görevler gün
 * başlığında, saatli görevler saat ızgarasında. D-047: masaüstünde hafta ve ay görünümünde sürükle-bırak; mobilde
 * "Tarihi değiştir" (tarih seçici). Her görev detay paneline açılır (klavye alternatifi). Masaüstünde "Tarihsiz"
 * paneli; oradan takvime sürüklenebilir (FR-CAL-04).
 */
export function Calendar({
  tasks,
  context,
  mode,
  date,
  filters,
}: {
  tasks: TaskView[];
  context: TaskUiContext;
  mode: CalendarMode | null;
  date: string;
  filters?: React.ReactNode;
}) {
  const t = useTranslations('calendar');
  const tTasks = useTranslations('tasks');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  // Figma: masaüstünde Hafta, mobilde Gün varsayılan.
  const view: CalendarMode = mode ?? (narrow ? 'day' : 'week');
  const { timezone, weekStart, today } = context;
  const [offset] = useState(() => offsetLabel(timezone, new Date()));

  const href = (next: { cal?: CalendarMode; date?: string; task?: string | null }) => {
    const p = new URLSearchParams(params.toString());
    if (next.cal) p.set('cal', next.cal);
    if (next.date) p.set('date', next.date);
    if (next.task === null) p.delete('task');
    else if (next.task) p.set('task', next.task);
    return `${pathname}?${p.toString()}` as Route;
  };

  const placed = tasks.flatMap((task) => {
    const at = placement(task, timezone);
    return at ? [{ task, ...at }] : [];
  });
  const undated = tasks.filter((task) => !task.due);
  const onDay = (day: string) =>
    placed.filter((p) => p.date === day).sort((a, b) => (a.minutes ?? -1) - (b.minutes ?? -1));

  const weekFirst = startOfWeek(date, weekStart);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekFirst, i));
  const [y, m] = date.split('-').map(Number) as [number, number];
  const step =
    view === 'month'
      ? (dir: number) => {
          const d = new Date(Date.UTC(y, m - 1 + dir, 1));
          return d.toISOString().slice(0, 10);
        }
      : (dir: number) => addDays(date, dir * (view === 'week' ? 7 : 1));

  const fmt = (d: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const rangeLabel =
    view === 'month'
      ? fmt(date, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${fmt(weekDays[0]!, { day: 'numeric' })}–${fmt(weekDays[6]!, { day: 'numeric', month: 'long', year: 'numeric' })}`
        : fmt(date, { day: 'numeric', month: 'long', weekday: 'long' });

  /** Sürükle-bırak ile tarih (ve hafta ızgarasında saat) değişikliği; tekrarlayan görevde yalnızca bu örnek. */
  async function move(taskId: string, day: string, minutes: number | null) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;
    setFailed(false);
    const time =
      minutes === null
        ? (task.due?.time ?? null)
        : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const result = await apiPatch(`/api/v1/workspaces/${context.workspaceId}/tasks/${task.id}`, {
      version: task.version,
      due: {
        date: day,
        time,
        timezone: time ? (minutes === null ? (task.due?.timezone ?? timezone) : timezone) : null,
      },
      ...(task.recurrence ? { recurrenceScope: 'this' } : {}),
    });
    if (!result.ok) setFailed(true);
    router.refresh();
  }
  const dropTarget = (day: string, minutes: number | null) => ({
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (id) void move(id, day, minutes);
    },
  });

  const chip = (task: TaskView, minutes: number | null, compact = false) => (
    <Link
      key={task.id}
      href={href({ task: task.id })}
      scroll={false}
      draggable
      data-calendar-task={task.id}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
      className={cn(
        'block rounded-sm px-1.5 py-1 text-xs leading-4 text-text',
        isOverdue(task, today) && 'text-danger',
        task.status === 'done' && 'text-text-secondary line-through',
        compact && 'truncate',
      )}
      style={{
        backgroundColor: `${hex(task.project.color)}26`,
        boxShadow: `inset 3px 0 0 ${hex(task.project.color)}`,
      }}
    >
      <span aria-hidden="true">{task.status === 'in_progress' ? '◐ ' : '○ '}</span>
      {taskLabel(task)}
      {minutes !== null && task.due?.at
        ? ` · ${shortTime(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, locale, context.timeFormat)}`
        : ''}
      {task.recurrence ? ' ↻' : ''}
    </Link>
  );

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view === 'week' && scroller.current) scroller.current.scrollTop = 8 * 48;
  }, [view]);

  const weekdayShort = (d: string) => fmt(d, { weekday: 'short' });

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm text-text-secondary">{`${rangeLabel} · ${timezone} (${offset})`}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href({ date: step(-1) })}
          aria-label={t('previous')}
          className="flex size-11 items-center justify-center rounded-md text-text"
        >
          ‹
        </Link>
        <Link
          href={href({ date: today })}
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface-muted px-4 text-base font-medium text-text"
        >
          {t('today')}
        </Link>
        <Link
          href={href({ date: step(1) })}
          aria-label={t('next')}
          className="flex size-11 items-center justify-center rounded-md text-text"
        >
          ›
        </Link>
        {filters}
      </div>
      <nav aria-label={t('views')} className="flex w-full gap-1 border-b border-border">
        {(['month', 'week', 'day'] as const).map((c) => (
          <Link
            key={c}
            href={href({ cal: c })}
            aria-current={view === c ? 'page' : undefined}
            data-cal-tab={c}
            className={cn(
              'flex min-h-11 flex-col justify-center p-3 text-sm font-medium',
              view === c ? 'border-b-2 border-primary text-primary' : 'text-text-secondary',
            )}
          >
            {t(c)}
          </Link>
        ))}
      </nav>
      {failed ? <Banner>{t('moveFailed')}</Banner> : null}

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {view === 'month' ? (
            <div
              role="grid"
              aria-label={rangeLabel}
              className="grid grid-cols-7 rounded-md border border-border"
            >
              {weekDays.map((d) => (
                <div
                  key={d}
                  role="columnheader"
                  className="border-b border-border bg-support-1 p-2 text-center text-xs font-semibold tracking-wide text-primary uppercase"
                >
                  {weekdayShort(d)}
                </div>
              ))}
              {monthGrid(y, m - 1, weekStart).map((day, i) =>
                day ? (
                  <div
                    key={day}
                    role="gridcell"
                    data-calendar-day={day}
                    {...dropTarget(day, null)}
                    data-has-tasks={onDay(day).length > 0 || undefined}
                    className={cn(
                      'flex min-h-24 flex-col gap-1 border-b border-r border-border p-1',
                      day === today && 'ring-2 ring-primary ring-inset',
                    )}
                    style={
                      onDay(day).length > 0
                        ? {
                            backgroundImage: `linear-gradient(180deg, ${hex(onDay(day)[0]!.task.project.color)}1f, transparent)`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        'self-end px-1 text-xs',
                        day === today
                          ? 'rounded-sm bg-primary text-on-primary'
                          : 'text-text-secondary',
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {onDay(day)
                      .slice(0, MONTH_CELL_LIMIT)
                      .map((p) => chip(p.task, p.minutes, true))}
                    {onDay(day).length > MONTH_CELL_LIMIT ? (
                      <Link
                        href={href({ cal: 'day', date: day })}
                        className="px-1 text-xs text-primary"
                      >
                        {t('more', { count: onDay(day).length - MONTH_CELL_LIMIT })}
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <div
                    key={`empty-${i}`}
                    role="gridcell"
                    className="border-b border-r border-border"
                  />
                ),
              )}
            </div>
          ) : view === 'week' ? (
            <div
              tabIndex={0}
              aria-label={rangeLabel}
              className="overflow-x-auto rounded-md border border-border"
            >
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border bg-support-1">
                  <span />
                  {weekDays.map((d) => (
                    <Link
                      key={d}
                      href={href({ cal: 'day', date: d })}
                      data-has-tasks={onDay(d).length > 0 || undefined}
                      className={cn(
                        'flex flex-col items-center py-2 text-xs font-semibold text-primary uppercase',
                        d === today && 'bg-primary text-on-primary',
                      )}
                      style={
                        onDay(d).length > 0 && d !== today
                          ? { boxShadow: `inset 0 -3px 0 ${hex(onDay(d)[0]!.task.project.color)}` }
                          : undefined
                      }
                    >
                      {weekdayShort(d)}
                      <span className="text-lg font-semibold">{Number(d.slice(8))}</span>
                    </Link>
                  ))}
                </div>
                <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
                  <span className="bg-surface-muted p-1 text-xs font-semibold text-text-secondary">
                    {t('allDay')}
                  </span>
                  {weekDays.map((d) => (
                    <div
                      key={d}
                      data-calendar-day={d}
                      {...dropTarget(d, null)}
                      className="flex min-h-16 flex-col gap-1 border-l border-border p-1"
                    >
                      {onDay(d)
                        .filter((p) => p.minutes === null)
                        .map((p) => chip(p.task, null))}
                    </div>
                  ))}
                </div>
                <div
                  ref={scroller}
                  tabIndex={0}
                  aria-label={t('hours')}
                  className="max-h-[576px] overflow-y-auto"
                >
                  {HOURS.map((h) => (
                    <div key={h} className="grid min-h-12 grid-cols-[56px_repeat(7,1fr)]">
                      <span className="bg-surface-muted p-1 text-xs font-medium text-text-secondary">{`${String(h).padStart(2, '0')}:00`}</span>
                      {weekDays.map((d) => (
                        <div
                          key={d}
                          data-calendar-slot={`${d}T${h}`}
                          {...dropTarget(d, h * 60)}
                          className="flex flex-col gap-1 border-t border-l border-border p-0.5"
                        >
                          {onDay(d)
                            .filter((p) => p.minutes !== null && Math.floor(p.minutes / 60) === h)
                            .map((p) => chip(p.task, p.minutes))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <DayView
              day={date}
              weekDays={weekDays}
              items={onDay(date)}
              context={context}
              href={href}
              weekdayShort={weekdayShort}
            />
          )}
        </div>
        <section
          aria-labelledby="undated"
          className={cn(
            'flex flex-col gap-2 rounded-md border border-border bg-surface p-4 lg:w-[240px]',
            view !== 'day' && 'hidden lg:flex',
          )}
        >
          <div className="flex items-center gap-2">
            <h2 id="undated" className="flex-1 text-base font-semibold text-text">
              {t('undated')}
            </h2>
            <span className="text-xs text-text-secondary">
              {t('count', { count: undated.length })}
            </span>
          </div>
          <ul className="flex flex-col">
            {undated.map((task) => (
              <li
                key={task.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                className="flex flex-wrap items-center gap-2 border-b border-border py-2"
              >
                <Link
                  href={href({ task: task.id })}
                  scroll={false}
                  className="min-w-0 flex-1 text-sm text-text"
                >
                  {taskLabel(task)}
                  <span className="block text-xs text-text-secondary">
                    {`${task.project.name} · ${tTasks('row.noDate')}`}
                  </span>
                </Link>
                <span className="lg:hidden">
                  <GiveDate task={task} context={context} />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-secondary">{t('undatedHint')}</p>
        </section>
      </div>
    </div>
  );
}

/** Gün görünümü (Figma mobil 4:68640): hafta şeridi, Tüm gün, Günün planı (saatli, "Tarihi değiştir"). */
function DayView({
  day,
  weekDays,
  items,
  context,
  href,
  weekdayShort,
}: {
  day: string;
  weekDays: string[];
  items: { task: TaskView; minutes: number | null }[];
  context: TaskUiContext;
  href: (next: { cal?: CalendarMode; date?: string; task?: string | null }) => Route;
  weekdayShort: (d: string) => string;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const allDay = items.filter((i) => i.minutes === null);
  const timed = items.filter((i) => i.minutes !== null);
  const time = (minutes: number) =>
    shortTime(
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      locale,
      context.timeFormat,
    );

  /** USER_FLOWS §2.8: güne görev ekleme (BR-INBOX-001: bağlamsız ekleme Inbox'a). */
  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const result = await apiPost(
      `/api/v1/workspaces/${context.workspaceId}/tasks`,
      { title: title.trim(), due: { date: day } },
      { 'idempotency-key': crypto.randomUUID() },
    );
    if (result.ok) setTitle('');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => (
          <Link
            key={d}
            href={href({ cal: 'day', date: d })}
            aria-current={d === day ? 'date' : undefined}
            className={cn(
              'flex min-h-11 flex-col items-center rounded-sm bg-support-1 text-xs font-semibold text-primary',
              d === day && 'bg-primary text-on-primary',
            )}
          >
            {weekdayShort(d)}
            <span className="text-sm">{Number(d.slice(8))}</span>
          </Link>
        ))}
      </div>
      <section
        aria-labelledby="all-day"
        className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4"
      >
        <h2 id="all-day" className="text-base font-semibold text-text">
          {t('allDay')}
        </h2>
        {allDay.length === 0 ? <p className="text-sm text-text-secondary">{t('none')}</p> : null}
        <ul className="flex flex-col">
          {allDay.map(({ task }) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-2 border-b border-border py-2"
            >
              <Link
                href={href({ task: task.id })}
                scroll={false}
                className="min-w-0 flex-1 text-sm text-text"
              >
                ○ {taskLabel(task)}
              </Link>
              <GiveDate task={task} context={context} />
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex gap-2">
          <input
            aria-label={t('addOnDay')}
            placeholder={t('addOnDay')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-sm border border-border bg-page px-3 text-sm text-text"
          />
        </form>
      </section>
      <section aria-labelledby="day-plan" className="flex flex-col gap-2">
        <h2 id="day-plan" className="flex items-center gap-2 text-base font-medium text-text">
          <span className="flex-1">{t('dayPlan')}</span>
          <span className="text-sm text-text-secondary">{timed.length}</span>
        </h2>
        {timed.map(({ task, minutes }) => (
          <div
            key={task.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4"
          >
            <p className="text-xs text-primary">{`${time(minutes!)} · ${context.timezone.split('/').pop()?.replace('_', ' ')}`}</p>
            <Link href={href({ task: task.id })} scroll={false} className="text-base text-text">
              {task.status === 'in_progress' ? '◐ ' : '○ '}
              {taskLabel(task)}
              {task.recurrence ? ' ↻' : ''}
            </Link>
            <GiveDate task={task} context={context} />
          </div>
        ))}
      </section>
    </div>
  );
}
