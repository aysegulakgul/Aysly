import { getTranslations } from 'next-intl/server';
import { getViewer } from '../../../viewer';
import { NotificationSettingsForm } from './notification-settings-form';

/** Ayarlar · Bildirimler (FR-NOTIF-04, BR-NOTIF-004; Figma'da yok, D-065): MVP'de yalnızca uygulama içi (D-037). */
export default async function NotificationSettingsPage() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations('settings')]);
  if (!viewer) return null;
  return (
    <>
      <h2 className="text-xl font-semibold text-text lg:sr-only">{t('notifications')}</h2>
      <NotificationSettingsForm initial={viewer.preferences} />
    </>
  );
}
