import { getTranslations } from 'next-intl/server';
import { findNotifications } from '@/modules/notifications';
import { dispatchRemindersFor } from '@/modules/tasks';
import { getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { NotificationList } from './notification-list';

/** Bildirimler (USER_FLOWS §2.12, FR-NOTIF-01; Figma'da yok, D-065): okundu/okunmadı, tümünü okundu say. */
export default async function NotificationsPage() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations('notifications')]);
  if (!viewer) return null;
  await dispatchRemindersFor(viewer.user.id);
  const items = await findNotifications(viewer.user.id);
  return (
    <PageFrame title={t('title')}>
      <NotificationList initial={items} timezone={viewer.preferences.timezone} />
    </PageFrame>
  );
}
