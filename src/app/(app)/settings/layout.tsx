import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PageFrame } from '../page-frame';
import { SettingsCategories } from './categories';

/**
 * Ayarlar (Figma 4:67693 masaüstü, 4:68939 mobil): başlık ve açıklama; masaüstünde solda 204 px kategori listesi,
 * mobilde kategoriler sarmalanan düğmeler halinde üstte.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('settings');
  return (
    <PageFrame title={t('title')}>
      <div className="flex w-full flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-secondary">{t('description')}</p>
      </div>
      <div className="flex w-full flex-col gap-6 lg:flex-row">
        <SettingsCategories />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </PageFrame>
  );
}
