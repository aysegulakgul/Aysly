'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { TaskView } from '@/modules/tasks';
import { shortDate, shortTime } from './dates';
import type { TaskUiContext } from './task-context';

/** Satırın ikinci bilgisi: "Inbox · 19 Eki 14:00 · ⚑ Yüksek" / "Inbox · Tarihsiz · ⚑ Düşük" (Figma 4:66716). */
export function useTaskMeta(context: TaskUiContext) {
  const t = useTranslations('tasks');
  const locale = useLocale();
  return (task: TaskView, projectName: string) => {
    const parts = [projectName];
    parts.push(
      task.due
        ? `${shortDate(task.due.date, locale)}${task.due.time ? ` ${shortTime(task.due.time, locale, context.timeFormat)}` : ''}`
        : t('row.noDate'),
    );
    if (task.priority > 0) parts.push(`⚑ ${t(`priority.${task.priority}`)}`);
    return parts.join(' · ');
  };
}

/**
 * Figma UI/TaskRow (Inbox, 4:66713): satır yüksekliği (rahat 44 / sıkı 32 px), 24 px tamamlama işareti, 15 px
 * başlık (taşarsa üç nokta), 12 px ikincil bilgi. Mobilde bilgi başlığın altına iner (4:68036).
 */
export function TaskRow({
  task,
  meta,
  onComplete,
}: {
  task: TaskView;
  meta: string;
  onComplete: () => void;
}) {
  const t = useTranslations('tasks');
  return (
    <li className="flex min-h-row w-full items-center gap-3 rounded-sm border-b border-border px-2 py-1">
      <button
        type="button"
        onClick={onComplete}
        aria-label={t('row.complete', { title: task.title })}
        className="flex size-11 shrink-0 items-center justify-center text-xl text-text-secondary lg:size-6"
      >
        <span aria-hidden="true">{task.status === 'in_progress' ? '◐' : '○'}</span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-center lg:gap-3">
        <p className="min-w-0 flex-1 truncate text-base text-text">{task.title}</p>
        <p className="text-xs text-text-secondary lg:w-[240px] lg:shrink-0">{meta}</p>
      </div>
    </li>
  );
}
