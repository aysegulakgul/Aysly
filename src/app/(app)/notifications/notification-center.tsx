'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiGet, apiPost } from '@/client/api';
import type { NotificationView } from '@/modules/notifications';
import { Button } from '@/ui/components/button';
import { Popover } from '@/ui/components/popover';
import { cn } from '@/ui/cn';

const POLL_MS = 60_000; // D-053: uygulama açıkken ~60 sn'de bir

type Center = { unread: number; refresh: () => Promise<void> };
const NotificationContext = createContext<Center>({ unread: 0, refresh: async () => {} });

/**
 * Bildirim sayacı (FR-NOTIF-01, BR-REM-005, D-053): uygulama açıkken ~60 sn'de bir ve sekmeye dönüldüğünde
 * okunmamış sayısı istenir; sunucu bu sırada zamanı gelmiş hatırlatıcıları bildirime dönüştürür. Tek sağlayıcı,
 * kenar çubuğu ve mobil başlıktaki ziller aynı sayıyı paylaşır.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(async () => {
    const result = await apiGet<{ count: number }>('/api/v1/notifications/unread-count');
    if (result.ok) setUnread(result.data.count);
  }, []);
  useEffect(() => {
    const tick = () => void refresh();
    tick();
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);
  return (
    <NotificationContext.Provider value={{ unread, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);

/** Bildirime tıklanınca okundu yapılır ve göreve gidilir (BR-NOTIF-003); görev silinmişse BR-DEL-007 ekranı. */
export function notificationHref(n: NotificationView): Route {
  return `/my-tasks?task=${n.payload.taskId}` as Route;
}

export function useNotificationText() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  return (n: NotificationView, timezone: string) => {
    const when = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(n.payload.remindAt));
    return `${when}${n.payload.late ? ` · ${t('late')}` : ''}`;
  };
}

/**
 * Zil ve açılır panel (USER_FLOWS §2.12: son 20, "Tümünü okundu say", tam sayfa bağlantısı). Figma'da zil kenar
 * çubuğu başlığındadır (4:66491); panel Figma'da yok (D-065).
 */
export function NotificationBell({
  timezone,
  className,
}: {
  timezone: string;
  className?: string;
}) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const { unread, refresh } = useNotifications();
  const text = useNotificationText();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);

  async function load() {
    const result = await apiGet<NotificationView[]>('/api/v1/notifications');
    setItems(result.ok ? result.data : []);
    void refresh();
  }
  async function openItem(n: NotificationView) {
    setOpen(false);
    if (!n.readAt) await apiPost(`/api/v1/notifications/${n.id}/read`, {});
    void refresh();
    router.push(notificationHref(n));
  }
  async function readAll() {
    await apiPost('/api/v1/notifications/read-all', {});
    await load();
  }

  const label = unread ? t('bellUnread', { count: unread }) : t('bell');
  return (
    <Popover
      label={t('title')}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
      className="w-[min(360px,calc(100vw-32px))]"
      trigger={
        <button
          type="button"
          aria-label={label}
          data-notification-bell
          className={cn(
            'relative flex size-11 items-center justify-center rounded-md text-lg text-text-secondary',
            className,
          )}
        >
          <span aria-hidden="true">🔔︎</span>
          {unread ? (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-on-primary"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      }
    >
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-base font-semibold text-text">{t('title')}</h2>
        <Button variant="ghost" className="px-2 text-sm" onClick={() => void readAll()}>
          {t('readAll')}
        </Button>
      </div>
      {items === null ? (
        <p className="text-sm text-text-secondary">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void openItem(n)}
                className="flex min-h-11 w-full items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-surface-muted"
              >
                <span aria-hidden="true">⏰</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn('truncate text-sm text-text', !n.readAt && 'font-semibold')}>
                    {n.payload.title}
                  </span>
                  <span className="text-xs text-text-secondary">{text(n, timezone)}</span>
                </span>
                {n.readAt ? null : <span className="sr-only">{t('unread')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link href="/notifications" onClick={() => setOpen(false)} className="text-sm text-primary">
        {t('seeAll')}
      </Link>
    </Popover>
  );
}
