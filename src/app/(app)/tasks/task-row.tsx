'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { TaskView } from '@/modules/tasks';
import { cn } from '@/ui/cn';
import { shortDate, shortTime } from './dates';
import type { TaskUiContext } from './task-context';

/** BR-DATE-003: gecikmiş mi? (tüm gün: tarih < bugün; saatli: an < şimdi) */
export function isOverdue(task: TaskView, today: string): boolean {
  if (!task.due || task.status === 'done') return false;
  return task.due.at ? Date.parse(task.due.at) < Date.now() : task.due.date < today;
}

/**
 * Satırın ikinci bilgisi (Figma 4:66716, Görevlerim 4:66732): "Ev · 14 Eki · Gecikti · ⚑ Yüksek",
 * "Müşteri A — Web · Bugün · 14:00 · 2/5 alt görev · ⚑ Yüksek", "Inbox · Tarihsiz · ⚑ Düşük".
 */
export function useTaskMeta(context: TaskUiContext) {
  const t = useTranslations('tasks');
  const locale = useLocale();
  return (task: TaskView) => {
    const parts = [task.project.name];
    if (task.due) {
      parts.push(
        task.due.date === context.today ? t('row.today') : shortDate(task.due.date, locale),
      );
      if (task.due.time) parts.push(shortTime(task.due.time, locale, context.timeFormat));
      if (isOverdue(task, context.today)) parts.push(t('row.overdue'));
    } else parts.push(t('row.noDate'));
    if (task.subtaskCount.total > 0) {
      parts.push(t('row.subtasks', task.subtaskCount));
    }
    if (task.priority > 0) parts.push(`⚑ ${t(`priority.${task.priority}`)}`);
    return parts.join(' · ');
  };
}

/**
 * Figma UI/TaskRow (Inbox 4:66713, Görevlerim 4:66732): satır yüksekliği (rahat 44 / sıkı 32 px), tamamlama
 * işareti, 15 px başlık (taşarsa üç nokta), 12 px ikincil bilgi; gecikmişte tehlike rengi. Başlık detay panelini
 * açar (`?task=`). Mobilde bilgi başlığın altına iner.
 */
export function TaskRow({
  task,
  meta,
  overdue = false,
  onComplete,
  actions,
}: {
  task: TaskView;
  meta: string;
  overdue?: boolean;
  onComplete: () => void;
  actions?: ReactNode;
}) {
  const t = useTranslations('tasks');
  const pathname = usePathname();
  const done = task.status === 'done';
  return (
    <li className="flex w-full flex-col border-b border-border">
      <div className="flex min-h-row w-full items-center gap-3 rounded-sm px-2 py-1">
        <button
          type="button"
          onClick={onComplete}
          aria-label={done ? t('detail.reopen') : t('row.complete', { title: task.title })}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center text-xl lg:size-6',
            done
              ? 'text-success'
              : task.status === 'in_progress'
                ? 'text-primary'
                : 'text-text-secondary',
          )}
        >
          <span aria-hidden="true">{done ? '✓' : task.status === 'in_progress' ? '◐' : '○'}</span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-center lg:gap-3">
          <Link
            href={`${pathname}?task=${task.id}` as never}
            scroll={false}
            className={cn('min-w-0 flex-1 truncate text-base text-text', done && 'line-through')}
          >
            {task.title}
          </Link>
          <p
            className={cn(
              'text-xs lg:w-[300px] lg:shrink-0',
              overdue ? 'text-danger' : 'text-text-secondary',
            )}
          >
            {meta}
          </p>
        </div>
        {actions ? <div className="hidden shrink-0 lg:flex">{actions}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-1 pb-2 pl-12 lg:hidden">{actions}</div> : null}
    </li>
  );
}
