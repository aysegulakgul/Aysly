'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/ui/components/button';
import { cn } from '@/ui/cn';
import {
  addDays,
  longDay,
  monthGrid,
  monthTitle,
  nextWeekStart,
  offsetLabel,
  todayIn,
  weekdayNames,
} from './dates';

export type DueValue = { date: string; time: string | null; timezone: string | null };

/**
 * Figma "Tarih seç" (4:69362): hızlı seçimler (Bugün, Yarın, Gelecek hafta), ay takvimi, saat, saat dilimi,
 * "Tarihi kaldır" ve "Uygula". Saat seçilirse görev kullanıcının saat diliminde saatli olur (BR-DATE-001).
 */
export function DatePickerPanel({
  value,
  timezone,
  weekStart,
  onApply,
}: {
  value: DueValue | null;
  timezone: string;
  weekStart: number;
  onApply: (due: DueValue | null) => void;
}) {
  const t = useTranslations('tasks.date');
  const locale = useLocale();
  const now = new Date();
  const today = todayIn(timezone, now);
  const [date, setDate] = useState<string | null>(value?.date ?? null);
  const [time, setTime] = useState(value?.time ?? '');
  const initial = (value?.date ?? today).split('-').map(Number) as [number, number, number];
  const [view, setView] = useState({ year: initial[0], month: initial[1] - 1 });

  const shift = (delta: number) => {
    const m = view.month + delta;
    setView({ year: view.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };
  const pick = (d: string) => {
    setDate(d);
    const [y, m] = d.split('-').map(Number) as [number, number];
    setView({ year: y, month: m - 1 });
  };
  const apply = () =>
    onApply(date ? { date, time: time || null, timezone: time ? timezone : null } : null);

  return (
    <div className="flex w-[min(320px,calc(100vw-64px))] flex-col gap-3">
      <p className="text-sm font-medium text-text">{t('title')}</p>
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" onClick={() => pick(today)}>
          {t('today')}
        </Button>
        <Button variant="ghost" onClick={() => pick(addDays(today, 1))}>
          {t('tomorrow')}
        </Button>
        <Button variant="ghost" onClick={() => pick(nextWeekStart(today, weekStart))}>
          {t('nextWeek')}
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label={t('prevMonth')}
          className="flex size-11 items-center justify-center rounded-sm text-text-secondary"
        >
          ‹
        </button>
        <p className="text-sm font-medium text-text" aria-live="polite">
          {monthTitle(view.year, view.month, locale)}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label={t('nextMonth')}
          className="flex size-11 items-center justify-center rounded-sm text-text-secondary"
        >
          ›
        </button>
      </div>
      <div
        role="grid"
        aria-label={monthTitle(view.year, view.month, locale)}
        className="grid grid-cols-7 text-center text-xs"
      >
        <div role="row" className="contents">
          {weekdayNames(locale, weekStart).map((name) => (
            <span role="columnheader" key={name} className="py-1 text-text-secondary">
              {name}
            </span>
          ))}
        </div>
        {chunk(monthGrid(view.year, view.month, weekStart), 7).map((week, i) => (
          <div role="row" key={i} className="contents">
            {week.map((d, j) =>
              d ? (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  aria-selected={d === date}
                  aria-label={longDay(d, locale)}
                  onClick={() => setDate(d)}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-sm text-sm',
                    d === date ? 'bg-primary text-on-primary' : 'text-text',
                    d === today && d !== date ? 'font-semibold text-primary underline' : '',
                  )}
                >
                  {Number(d.slice(8))}
                </button>
              ) : (
                <span key={`e${i}-${j}`} role="gridcell" />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-2 text-sm text-text-secondary">
          {t('time')}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!date}
            className="min-h-11 rounded-sm border border-border bg-page p-3 text-base text-text disabled:opacity-60"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm text-text-secondary">
          {t('timezone')}
          <p className="py-3 text-xs text-text">{`${timezone} · ${offsetLabel(timezone, now)}`}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => onApply(null)}>
          {t('clear')}
        </Button>
        <Button variant="primary" onClick={apply} disabled={!date}>
          {t('apply')}
        </Button>
      </div>
    </div>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );
}
