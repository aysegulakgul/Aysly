'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiGet, apiPost } from '@/client/api';
import type { NotificationView } from '@/modules/notifications';
import { Button } from '@/ui/components/button';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { cn } from '@/ui/cn';
import { notificationHref, useNotificationText, useNotifications } from './notification-center';

export function NotificationList({
  initial,
  timezone,
}: {
  initial: NotificationView[];
  timezone: string;
}) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const text = useNotificationText();
  const { refresh } = useNotifications();
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(initial.length === 20);

  async function reload() {
    const result = await apiGet<NotificationView[]>('/api/v1/notifications');
    if (result.ok) {
      setItems(result.data);
      setMore(result.data.length === 20);
    }
    void refresh();
  }
  async function loadMore() {
    const last = items.at(-1);
    if (!last) return;
    const result = await apiGet<NotificationView[]>(
      `/api/v1/notifications?before=${encodeURIComponent(last.createdAt)}`,
    );
    if (result.ok) {
      setItems([...items, ...result.data]);
      setMore(result.data.length === 20);
    }
  }
  async function toggle(n: NotificationView) {
    await apiPost(`/api/v1/notifications/${n.id}/${n.readAt ? 'unread' : 'read'}`, {});
    await reload();
  }
  async function open(n: NotificationView) {
    if (!n.readAt) await apiPost(`/api/v1/notifications/${n.id}/read`, {});
    void refresh();
    router.push(notificationHref(n));
  }

  return (
    <>
      <div className="flex w-full items-start gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('description')}</p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            await apiPost('/api/v1/notifications/read-all', {});
            await reload();
          }}
        >
          {t('readAll')}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Icon name="inbox" />} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <ul className="flex flex-col">
          {items.map((n) => (
            <li
              key={n.id}
              data-notification
              className="flex min-h-row items-center gap-3 border-b border-border px-2 py-2"
            >
              <span aria-hidden="true">⏰</span>
              <button
                type="button"
                onClick={() => void open(n)}
                className="flex min-w-0 flex-1 flex-col text-left"
              >
                <span className={cn('truncate text-base text-text', !n.readAt && 'font-semibold')}>
                  {n.payload.title}
                </span>
                <span className="text-xs text-text-secondary">{text(n, timezone)}</span>
              </button>
              <Button variant="ghost" className="px-2 text-sm" onClick={() => void toggle(n)}>
                {n.readAt ? t('markUnread') : t('markRead')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {more ? (
        <Button variant="ghost" className="self-start" onClick={() => void loadMore()}>
          {t('more')}
        </Button>
      ) : null}
    </>
  );
}
