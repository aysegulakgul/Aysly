/** notifications modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export type { Notification, NotificationStore, ReminderPayload } from './application/notifications';
export {
  createNotificationStore,
  purgeOldNotifications,
} from './infrastructure/notification-store';
export {
  findNotifications,
  getNotifications,
  getUnreadCount,
  postNotificationRead,
  postNotificationUnread,
  postReadAll,
  toNotificationJson,
  type NotificationView,
} from './http/notification-handlers';
