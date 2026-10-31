import { getLocale, getTranslations } from 'next-intl/server';
import { deletionDueAt } from '@/modules/identity';
import { systemClock } from '@/shared/kernel/clock';
import { getViewer } from '../../../viewer';
import { DeleteAccountForm, ExportForm } from './data-privacy-forms';

/**
 * Ayarlar · Veri ve gizlilik (Figma'da kategori var 4:67746, içerik yok — D-065: Güvenlik ekranının düzeni ve Figma
 * bileşenleriyle). Dışa aktarma (D-046) ve hesap silme (D-036).
 */
export default async function DataPrivacySettingsPage() {
  const [viewer, locale, t] = await Promise.all([
    getViewer(),
    getLocale(),
    getTranslations('settings'),
  ]);
  if (!viewer) return null;
  const due = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: viewer.preferences.timezone,
  }).format(deletionDueAt(systemClock.now()));
  return (
    <>
      <h2 className="text-xl font-semibold text-text lg:sr-only">{t('dataPrivacy')}</h2>
      <ExportForm />
      <DeleteAccountForm due={due} />
    </>
  );
}
