import { getTranslations } from 'next-intl/server';
import { getViewer } from '../../../viewer';
import { DateTimeForm } from './date-time-form';

/** Ayarlar · Tarih ve saat (D-065: Figma'da yok; Figma UI/Panel ve UI/Input ile, Görünüm ekranının düzeninde). */
export default async function DateTimeSettingsPage() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations('settings')]);
  if (!viewer) return null;
  const timeZones = Intl.supportedValuesOf('timeZone');
  return (
    <>
      <h2 className="text-xl font-semibold text-text lg:sr-only">{t('dateTime')}</h2>
      <DateTimeForm initial={viewer.preferences} timeZones={timeZones} />
    </>
  );
}
