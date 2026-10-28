import { getTranslations } from 'next-intl/server';
import { getViewer } from '../../../viewer';
import { AppearanceForm } from './appearance-form';

export default async function AppearanceSettingsPage() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations('settings')]);
  if (!viewer) return null;
  return (
    <>
      {/* Figma mobilde kategori başlığını gösterir (4:68973); masaüstünde yalnızca ekran okuyucu için. */}
      <h2 className="text-xl font-semibold text-text lg:sr-only">{t('appearance')}</h2>
      <AppearanceForm initial={viewer.preferences} />
    </>
  );
}
