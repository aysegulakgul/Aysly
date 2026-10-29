'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiDelete, apiPost } from '@/client/api';
// Saf domain dosyaları: istemcide de aynı kural ayrıştırma ve saat dilimi dönüşümü (BR-REC-003, BR-DATE-006).
import { zonedTimeToUtc } from '@/modules/tasks/domain/due';
import {
  WEEKDAYS,
  formatRule,
  parseRule,
  type RecurrenceMode,
  type RecurrenceRule,
  type Weekday,
} from '@/modules/tasks/domain/recurrence';
import type { TaskDetailView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner } from '@/ui/components/feedback';
import { Popover } from '@/ui/components/popover';
import { cn } from '@/ui/cn';
import type { TaskUiContext } from './task-context';

type Freq = 'none' | RecurrenceRule['freq'];
type End = 'never' | 'until' | 'count';
const ORDER: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
const nthOf = (date: string) => {
  const day = Number(date.slice(8, 10));
  const last = new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0),
  ).getUTCDate();
  return day + 7 > last ? -1 : Math.ceil(day / 7);
};

/** Tekrar özeti (satır ve alan metni): "Her hafta: Pzt", "Her 3 günde bir" … */
export function useRecurrenceLabel() {
  const t = useTranslations('tasks.recurrence');
  return (rule: string | null | undefined) => {
    if (!rule) return t('none');
    const parsed = parseRule(rule);
    if (!parsed.ok) return t('custom');
    const r = parsed.value;
    const base = r.interval === 1 ? t(`every.${r.freq}`) : t(`everyN.${r.freq}`, { n: r.interval });
    const days = r.byDay?.length ? `: ${r.byDay.map((d) => t(`days.${d}`)).join(', ')}` : '';
    const nth = r.nthWeekday
      ? `: ${t(`nth.${r.nthWeekday.n}`)} ${t(`daysLong.${r.nthWeekday.day}`)}`
      : '';
    const day = r.monthDay ? `: ${t('monthDay', { day: r.monthDay })}` : '';
    return `${base}${days}${nth}${day}`;
  };
}

/**
 * Tekrar alanı (BR-REC-001..003, D-087; Figma'da düzenleyici yok, D-065): sıklık, aralık, haftanın günleri, aylıkta
 * "ayın N. günü" veya "ayın N. haftasının günü", mod (planlanan tarihe göre / tamamlandıktan sonra) ve bitiş.
 * Son tarihi olmayan görevde kapalıdır.
 */
export function RecurrenceField({
  detail,
  onSave,
}: {
  detail: TaskDetailView;
  onSave: (recurrence: { rule: string; mode: RecurrenceMode } | null) => void;
}) {
  const t = useTranslations('tasks.recurrence');
  const label = useRecurrenceLabel();
  const current = detail.recurrence ? parseRule(detail.recurrence.rule) : null;
  const rule = current?.ok ? current.value : null;
  const due = detail.due?.date ?? null;
  const [open, setOpen] = useState(false);
  const [freq, setFreq] = useState<Freq>(rule?.freq ?? 'none');
  const [every, setEvery] = useState(rule?.interval ?? 1);
  const [days, setDays] = useState<Weekday[]>(rule?.byDay ?? (due ? [weekdayOf(due)] : []));
  const [monthly, setMonthly] = useState<'day' | 'weekday'>(rule?.nthWeekday ? 'weekday' : 'day');
  const [mode, setMode] = useState<RecurrenceMode>(detail.recurrence?.mode ?? 'fixed_schedule');
  const [end, setEnd] = useState<End>(rule?.until ? 'until' : rule?.count ? 'count' : 'never');
  const [until, setUntil] = useState(rule?.until ?? '');
  const [count, setCount] = useState(rule?.count ?? 10);

  function submit(event: FormEvent) {
    event.preventDefault();
    setOpen(false);
    if (freq === 'none' || !due) return onSave(null);
    const next: RecurrenceRule = { freq, interval: Math.max(1, Math.min(365, every)) };
    if (freq === 'WEEKLY' && days.length) next.byDay = ORDER.filter((d) => days.includes(d));
    if (freq === 'MONTHLY') {
      if (monthly === 'weekday') next.nthWeekday = { n: nthOf(due), day: weekdayOf(due) };
      else next.monthDay = Number(due.slice(8, 10));
    }
    if (end === 'until' && until) next.until = until;
    if (end === 'count') next.count = Math.max(1, Math.min(999, count));
    onSave({ rule: formatRule(next), mode });
  }

  const input = 'min-h-11 rounded-sm border border-border bg-page px-2 text-sm text-text';
  return (
    <Popover
      label={t('title')}
      open={open}
      onOpenChange={setOpen}
      className="w-[min(340px,calc(100vw-32px))]"
      trigger={
        <button
          id="detail-recurrence"
          type="button"
          disabled={!due}
          className="min-h-11 w-full rounded-sm px-2 text-left text-sm text-text hover:bg-surface-muted disabled:text-text-secondary"
        >
          {due
            ? `${detail.recurrence ? '↻ ' : ''}${label(detail.recurrence?.rule)}`
            : t('needsDue')}
        </button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          {t('frequency')}
          <select value={freq} onChange={(e) => setFreq(e.target.value as Freq)} className={input}>
            {(['none', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((f) => (
              <option key={f} value={f}>
                {f === 'none' ? t('none') : t(`every.${f}`)}
              </option>
            ))}
          </select>
        </label>
        {freq !== 'none' ? (
          <>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              {t('interval')}
              <input
                type="number"
                min={1}
                max={365}
                value={every}
                onChange={(e) => setEvery(Number(e.target.value))}
                className={cn(input, 'w-20')}
              />
            </label>
            {freq === 'WEEKLY' ? (
              <fieldset className="flex flex-wrap gap-1">
                <legend className="sr-only">{t('weekdays')}</legend>
                {ORDER.map((d) => (
                  <label
                    key={d}
                    className={cn(
                      'flex size-11 cursor-pointer items-center justify-center rounded-sm text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                      days.includes(d)
                        ? 'bg-support-1 text-primary'
                        : 'border border-border text-text',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={days.includes(d)}
                      onChange={() =>
                        setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])
                      }
                      aria-label={t(`daysLong.${d}`)}
                    />
                    {t(`days.${d}`)}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {freq === 'MONTHLY' && due ? (
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                {t('monthly')}
                <select
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value as 'day' | 'weekday')}
                  className={input}
                >
                  <option value="day">{t('monthDay', { day: Number(due.slice(8, 10)) })}</option>
                  <option value="weekday">
                    {`${t(`nth.${nthOf(due)}`)} ${t(`daysLong.${weekdayOf(due)}`)}`}
                  </option>
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              {t('mode')}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as RecurrenceMode)}
                className={input}
              >
                <option value="fixed_schedule">{t('modes.fixed_schedule')}</option>
                <option value="after_completion">{t('modes.after_completion')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              {t('end')}
              <select value={end} onChange={(e) => setEnd(e.target.value as End)} className={input}>
                <option value="never">{t('ends.never')}</option>
                <option value="until">{t('ends.until')}</option>
                <option value="count">{t('ends.count')}</option>
              </select>
            </label>
            {end === 'until' ? (
              <input
                type="date"
                aria-label={t('ends.until')}
                value={until}
                min={due ?? undefined}
                onChange={(e) => setUntil(e.target.value)}
                className={input}
              />
            ) : null}
            {end === 'count' ? (
              <input
                type="number"
                aria-label={t('ends.count')}
                min={1}
                max={999}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className={cn(input, 'w-24')}
              />
            ) : null}
          </>
        ) : null}
        <Button type="submit" variant="primary">
          {t('apply')}
        </Button>
      </form>
    </Popover>
  );
}

/** BR-REC-006: tekrarlayan görevin tarihi değişirken "yalnızca bu örnek" / "bu ve sonraki örnekler". */
export function RecurrenceScopeDialog({
  open,
  onChoose,
  onCancel,
}: {
  open: boolean;
  onChoose: (scope: 'this' | 'following') => void;
  onCancel: () => void;
}) {
  const t = useTranslations('tasks.recurrence');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={t('scopeTitle')}
      description={t('scopeDescription')}
    >
      <Button variant="primary" onClick={() => onChoose('this')}>
        {t('scopeThis')}
      </Button>
      <Button onClick={() => onChoose('following')}>{t('scopeFollowing')}</Button>
      <Button variant="ghost" onClick={onCancel}>
        {t('cancel')}
      </Button>
    </Dialog>
  );
}

const PRESETS = [0, 10, 30, 60, 1440] as const;

/**
 * Hatırlatıcılar bölümü (BR-REM-001/002; Figma'da düzenleyici yok, D-065): göreli hazır seçenekler (son tarihli
 * görevde) ve belirli bir an. Anlar kullanıcının saat diliminde gösterilir ve girilir (FR-CAL-06).
 */
export function RemindersSection({
  detail,
  context,
}: {
  detail: TaskDetailView;
  context: TaskUiContext;
}) {
  const t = useTranslations('tasks.reminders');
  const tRules = useTranslations('rules');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [date, setDate] = useState(context.today);
  const [time, setTime] = useState('09:00');
  const [open, setOpen] = useState(false);
  const base = `/api/v1/workspaces/${context.workspaceId}/tasks/${detail.id}/reminders` as const;

  async function add(body: object) {
    setError(undefined);
    const result = await apiPost(base, body);
    setOpen(false);
    if (!result.ok) {
      setError(result.error.rule ? tRules(result.error.rule as never) : t('failed'));
      return;
    }
    router.refresh();
  }
  async function remove(id: string) {
    const result = await apiDelete(`${base}/${id}`);
    if (!result.ok) setError(t('failed'));
    router.refresh();
  }

  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: context.timeFormat === '12h' ? 'h12' : 'h23',
      timeZone: context.timezone,
    }).format(new Date(iso));
  const describe = (r: TaskDetailView['reminders'][number]) =>
    r.kind === 'relative' && r.offsetMinutes !== null
      ? `${t(`offset.${PRESETS.includes(r.offsetMinutes as never) ? r.offsetMinutes : 'other'}`, {
          minutes: r.offsetMinutes,
        })} · ${when(r.remindAt)}`
      : when(r.remindAt);

  return (
    <section
      className="flex flex-col gap-2 border-b border-border pb-4"
      aria-labelledby="reminders"
    >
      <div className="flex items-center gap-2">
        <h3 id="reminders" className="flex-1 text-base font-semibold text-text">
          {t('title')}
        </h3>
        <Popover
          label={t('add')}
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button variant="ghost" className="text-sm text-primary" data-add-reminder>
              {t('add')}
            </Button>
          }
        >
          <div className="flex flex-col gap-1">
            {detail.due ? (
              PRESETS.map((offset) => (
                <Button
                  key={offset}
                  variant="ghost"
                  className="justify-start px-2 text-sm"
                  onClick={() => void add({ kind: 'relative', offsetMinutes: offset })}
                >
                  {t(`offset.${offset}`)}
                </Button>
              ))
            ) : (
              <p className="text-xs text-text-secondary">{t('relativeNeedsDue')}</p>
            )}
          </div>
          <form
            className="flex flex-col gap-2 border-t border-border pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const at = zonedTimeToUtc(date, time, context.timezone);
              void add({ kind: 'absolute', remindAt: at.toISOString() });
            }}
          >
            <p className="text-xs text-text-secondary">
              {t('absolute', { zone: context.timezone })}
            </p>
            <div className="flex gap-2">
              <input
                type="date"
                aria-label={t('date')}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-11 rounded-sm border border-border bg-page px-2 text-sm text-text"
              />
              <input
                type="time"
                aria-label={t('time')}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="min-h-11 rounded-sm border border-border bg-page px-2 text-sm text-text"
              />
            </div>
            <Button type="submit" variant="primary">
              {t('addAbsolute')}
            </Button>
          </form>
        </Popover>
      </div>
      {error ? <Banner>{error}</Banner> : null}
      {detail.reminders.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col">
          {detail.reminders.map((r) => (
            <li key={r.id} className="flex min-h-11 items-center gap-2 text-sm text-text">
              <span aria-hidden="true">⏰</span>
              <span className={cn('flex-1', r.status !== 'pending' && 'text-text-secondary')}>
                {describe(r)}
                {r.status !== 'pending' ? ` · ${t(`status.${r.status}`)}` : ''}
              </span>
              <Button
                variant="ghost"
                className="px-2 text-sm"
                aria-label={t('remove', { when: describe(r) })}
                onClick={() => void remove(r.id)}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
