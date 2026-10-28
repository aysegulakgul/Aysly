'use client';

import { useTranslations } from 'next-intl';
import { LOCALES, type Locale } from '@/i18n/config';
import type { Density, Preferences, Theme } from '@/modules/preferences';
import { Select, TabChoice, ThemeChoice } from '@/ui/components/choice';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { SaveStatusText } from '../save-status';
import { usePreferences } from '../use-preferences';

/** Dil adları her dilde kendi adıyla gösterilir (Figma: "Desteklenen diller: Türkçe, English."). */
const LANGUAGE_NAMES: Record<Locale, string> = { tr: 'Türkçe', en: 'English' };

/** Ayarlar · Görünüm (Figma 4:67748): Tema, Yoğunluk, Dil. Her değişiklik hemen kaydedilir. */
export function AppearanceForm({ initial }: { initial: Preferences }) {
  const t = useTranslations('settings');
  const { preferences, status, save } = usePreferences(initial);

  function setTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    void save({ theme });
  }
  function setDensity(density: Density) {
    document.documentElement.dataset.density = density;
    void save({ density });
  }

  return (
    <>
      <Panel>
        <SectionHeading>{t('theme.title')}</SectionHeading>
        <p className="text-sm text-text-secondary">{t('theme.description')}</p>
        <ThemeChoice
          label={t('theme.title')}
          value={preferences.theme}
          onChange={setTheme}
          preview={t('theme.preview')}
          options={[
            { value: 'dark', label: t('theme.dark') },
            { value: 'light', label: t('theme.light') },
            { value: 'system', label: t('theme.system') },
          ]}
        />
      </Panel>
      <Panel>
        <SectionHeading>{t('density.title')}</SectionHeading>
        <TabChoice
          label={t('density.title')}
          value={preferences.density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: t('density.comfortable') },
            { value: 'compact', label: t('density.compact') },
          ]}
        />
        <p className="text-sm text-text-secondary">{t('density.hint')}</p>
      </Panel>
      <Panel>
        <SectionHeading>{t('language.title')}</SectionHeading>
        <Select
          label={t('language.label')}
          value={preferences.locale}
          onChange={(e) => void save({ locale: e.target.value as Locale })}
        >
          {LOCALES.map((locale) => (
            <option key={locale} value={locale} lang={locale}>
              {LANGUAGE_NAMES[locale]}
            </option>
          ))}
        </Select>
        <p className="text-sm text-text-secondary">{t('language.hint')}</p>
      </Panel>
      <SaveStatusText status={status} />
    </>
  );
}
