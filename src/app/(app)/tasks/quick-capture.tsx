'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { apiPost } from '@/client/api';
import { Button } from '@/ui/components/button';
import { Banner } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Popover, PopoverClose } from '@/ui/components/popover';
import { cn } from '@/ui/cn';
import { DatePickerPanel, type DueValue } from './date-picker';
import { shortDate, shortTime } from './dates';
import type { TaskUiContext } from './task-context';

const PRIORITIES = [0, 1, 2, 3] as const;
type Priority = (typeof PRIORITIES)[number];

const newKey = () => crypto.randomUUID();

/**
 * Figma UI/QuickCapture (Inbox 4:66690; akış 4:69297 varsayılan, 4:69319 kayıt hatası). BR-INBOX-001: proje
 * seçilmediğinde görev Inbox'a eklenir. BR-TASK-007: her gönderim için idempotency anahtarı; hata sonrası
 * "Tekrar dene" aynı anahtarla gönderir, başlık ve seçilen alanlar korunur.
 */
export function QuickCapture({
  context,
  autoFocus = false,
}: {
  context: TaskUiContext;
  autoFocus?: boolean;
}) {
  const t = useTranslations('tasks');
  const reasons = useTranslations('auth.reasons');
  const locale = useLocale();
  const router = useRouter();
  const inputId = useId();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<DueValue | null>(null);
  const [priority, setPriority] = useState<Priority>(0);
  const [focused, setFocused] = useState(autoFocus);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [added, setAdded] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const key = useRef<string>(newKey());

  const expanded = focused || title.length > 0 || failed;

  function reset() {
    setTitle('');
    setFocused(false);
    setDue(null);
    setPriority(0);
    setFailed(false);
    setFieldError(undefined);
    key.current = newKey();
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending || title.trim().length === 0) {
      if (title.trim().length === 0) setFieldError(reasons('required'));
      return;
    }
    setPending(true);
    setAdded(false);
    const result = await apiPost(
      `/api/v1/workspaces/${context.workspaceId}/tasks`,
      { title, priority, ...(due ? { due } : {}) },
      { 'idempotency-key': key.current },
    );
    setPending(false);
    if (result.ok) {
      reset();
      setAdded(true);
      router.refresh();
      return;
    }
    if (result.status === 400 && result.error.details?.length) {
      const reason = result.error.details[0]?.reason ?? 'invalid';
      setFieldError(reasons.has(reason) ? reasons(reason) : reasons('invalid'));
      key.current = newKey(); // düzeltilmiş gövde yeni bir istektir
      return;
    }
    setFailed(true); // ağ veya sunucu hatası: aynı anahtarla tekrar denenebilir
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') reset();
  }

  const dueLabel = due
    ? `${shortDate(due.date, locale)}${due.time ? ` ${shortTime(due.time, locale, context.timeFormat)}` : ''}`
    : t('date.button');

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex w-full flex-col gap-2 rounded-md border border-border bg-surface p-4"
      // Kart odakla açılır ve odak kaybında kapanmaz: kapanması altındaki listeyi kaydırır, tıklamalar
      // yanlış hedefe düşer. Esc ile kapanır.
      onFocus={() => setFocused(true)}
    >
      <label htmlFor={inputId} className="text-xs text-text-secondary">
        {t('quickAdd.label')}
      </label>
      <div className="flex min-h-11 items-center gap-3">
        <Icon name="plus" tone="primary" />
        <input
          id={inputId}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setFieldError(undefined);
            setAdded(false);
          }}
          onKeyDown={onKeyDown}
          placeholder={t('quickAdd.placeholder')}
          autoFocus={autoFocus}
          maxLength={500}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${inputId}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent text-base text-text placeholder:text-text-secondary focus-visible:outline-none"
        />
      </div>
      {fieldError ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {fieldError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center">
        {/* Hedef proje: proje seçimi proje sayfalarıyla birlikte gelir; şimdilik her zaman Inbox. */}
        <span className="inline-flex min-h-11 items-center px-4 text-base font-medium text-text">
          {t('quickAdd.target')}
        </span>
        <Popover
          label={t('date.title')}
          open={dateOpen}
          onOpenChange={setDateOpen}
          trigger={
            <Button variant="ghost" className={cn(due && 'text-primary')}>
              {dueLabel}
            </Button>
          }
        >
          <DatePickerPanel
            value={due}
            timezone={context.timezone}
            weekStart={context.weekStart}
            onApply={(value) => {
              setDue(value);
              setDateOpen(false);
            }}
          />
        </Popover>
        <Popover
          label={t('priority.button')}
          trigger={
            <Button variant="ghost" className={cn(priority > 0 && 'text-primary')}>
              {priority > 0 ? `⚑ ${t(`priority.${priority}`)}` : t('priority.button')}
            </Button>
          }
        >
          <div role="radiogroup" aria-label={t('priority.button')} className="flex flex-col">
            {PRIORITIES.map((p) => (
              <PopoverClose asChild key={p}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={p === priority}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex min-h-11 items-center rounded-sm px-3 text-left text-sm',
                    p === priority ? 'bg-support-1 text-primary' : 'text-text',
                  )}
                >
                  {p > 0 ? `⚑ ${t(`priority.${p}`)}` : t('priority.0')}
                </button>
              </PopoverClose>
            ))}
          </div>
        </Popover>
      </div>
      {failed ? (
        <>
          <Banner icon={<span aria-hidden="true">ⓘ</span>}>{t('quickAdd.failed')}</Banner>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">{t('quickAdd.kept')}</p>
            <Button type="submit" variant="primary" loading={pending}>
              {t('quickAdd.retry')}
            </Button>
          </div>
        </>
      ) : expanded ? (
        <>
          <p className="text-xs text-text-secondary">{t('quickAdd.hint')}</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="hidden text-xs text-text-secondary sm:block">{t('quickAdd.keys')}</p>
            <Button type="submit" variant="primary" loading={pending}>
              {t('quickAdd.submit')}
            </Button>
          </div>
        </>
      ) : null}
      <p
        role="status"
        aria-live="polite"
        className={cn('text-sm text-success', !added && 'sr-only')}
      >
        {added ? `✓ ${t('quickAdd.added')}` : ''}
      </p>
    </form>
  );
}
