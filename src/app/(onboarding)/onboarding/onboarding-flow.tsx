'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiPatch, apiPost } from '@/client/api';
import { LOCALES, type Locale } from '@/i18n/config';
import type { Intent, Preferences } from '@/modules/preferences';
import { Button } from '@/ui/components/button';
import { OptionCard, Select } from '@/ui/components/choice';
import { Banner } from '@/ui/components/feedback';
import { Panel, SectionHeading } from '@/ui/components/panel';

const LANGUAGE_NAMES: Record<Locale, string> = { tr: 'Türkçe', en: 'English' };
const WEEK_STARTS = [1, 0, 6] as const;

type Step = 'intents' | 'samples' | 'prefs';

/**
 * ONBOARDING §2: 1) kullanım amacı (çoklu), 2) örnek projeler, 3) temel tercihlerin onayı. Her adımda "Atla".
 * Örnek projeler daha önce oluşturulduysa (rehber yeniden başlatıldıysa) 2. adım gösterilmez.
 */
export function OnboardingFlow({
  preferences,
  samplesAlreadyCreated,
  samplePreview,
  timeZones,
}: {
  preferences: Preferences;
  samplesAlreadyCreated: boolean;
  samplePreview: Record<'personal' | 'work' | 'both', string[]>;
  timeZones: string[];
}) {
  const t = useTranslations('onboarding');
  const tSettings = useTranslations('settings');
  const router = useRouter();
  const steps: Step[] = samplesAlreadyCreated
    ? ['intents', 'prefs']
    : ['intents', 'samples', 'prefs'];
  const [index, setIndex] = useState(0);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [createSamples, setCreateSamples] = useState(true);
  const [prefs, setPrefs] = useState({
    timezone: preferences.timezone,
    locale: preferences.locale,
    weekStart: preferences.weekStart,
  });
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const step = steps[index] ?? 'intents';

  const toggle = (intent: Intent, on: boolean) =>
    setIntents((list) => (on ? [...list, intent] : list.filter((i) => i !== intent)));
  const preview =
    intents.length === 2
      ? samplePreview.both
      : intents.length === 1
        ? samplePreview[intents[0] ?? 'personal']
        : [];

  function done() {
    router.replace('/');
    router.refresh();
  }

  async function skip() {
    setPending(true);
    const result = await apiPost('/api/v1/me/onboarding/skip', {});
    setPending(false);
    if (!result.ok) return setFailed(true);
    done();
  }

  async function finish() {
    setPending(true);
    setFailed(false);
    const changed =
      prefs.timezone !== preferences.timezone ||
      prefs.locale !== preferences.locale ||
      prefs.weekStart !== preferences.weekStart;
    if (changed) {
      const saved = await apiPatch('/api/v1/me/preferences', {
        version: preferences.version,
        ...prefs,
      });
      if (!saved.ok) {
        setPending(false);
        return setFailed(true);
      }
    }
    const result = await apiPost('/api/v1/me/onboarding', {
      intents,
      createSamples: !samplesAlreadyCreated && createSamples && preview.length > 0,
    });
    setPending(false);
    if (!result.ok) return setFailed(true);
    done();
  }

  const last = index === steps.length - 1;

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {t('step', { current: index + 1, total: steps.length })}
        </p>
        <Button variant="ghost" onClick={skip} disabled={pending}>
          {t('skip')}
        </Button>
      </div>
      <h1 className="text-2xl font-semibold text-text">{t('title')}</h1>
      {failed ? <Banner>{t('failed')}</Banner> : null}

      {step === 'intents' ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 flex flex-col gap-2">
            <SectionHeading>{t('intents.title')}</SectionHeading>
            <span className="text-sm text-text-secondary">{t('intents.description')}</span>
          </legend>
          {(['personal', 'work'] as const).map((intent) => (
            <OptionCard
              key={intent}
              type="checkbox"
              name="intents"
              checked={intents.includes(intent)}
              onChange={(on) => toggle(intent, on)}
            >
              {t(`intents.${intent}`)}
            </OptionCard>
          ))}
        </fieldset>
      ) : null}

      {step === 'samples' ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 flex flex-col gap-2">
            <SectionHeading>{t('samples.title')}</SectionHeading>
            <span className="text-sm text-text-secondary">{t('samples.description')}</span>
          </legend>
          {preview.length > 0 ? (
            <>
              <OptionCard
                type="radio"
                name="samples"
                checked={createSamples}
                onChange={() => setCreateSamples(true)}
              >
                {t('samples.yes')}
              </OptionCard>
              <OptionCard
                type="radio"
                name="samples"
                checked={!createSamples}
                onChange={() => setCreateSamples(false)}
              >
                {t('samples.no')}
              </OptionCard>
              {createSamples ? (
                <p className="text-sm text-text-secondary">
                  {t('samples.list', { names: preview.join(', ') })}
                </p>
              ) : null}
              <p className="text-sm text-text-secondary">{t('samples.notice')}</p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">{t('samples.none')}</p>
          )}
        </fieldset>
      ) : null}

      {step === 'prefs' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <SectionHeading>{t('prefs.title')}</SectionHeading>
            <p className="text-sm text-text-secondary">{t('prefs.description')}</p>
          </div>
          <Select
            label={tSettings('timezone.label')}
            value={prefs.timezone}
            onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
          >
            {(timeZones.includes(prefs.timezone) ? timeZones : [prefs.timezone, ...timeZones]).map(
              (zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll('_', ' ')}
                </option>
              ),
            )}
          </Select>
          <Select
            label={tSettings('language.label')}
            value={prefs.locale}
            onChange={(e) => setPrefs({ ...prefs, locale: e.target.value as Locale })}
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale} lang={locale}>
                {LANGUAGE_NAMES[locale]}
              </option>
            ))}
          </Select>
          <Select
            label={tSettings('formats.weekStart')}
            value={String(prefs.weekStart)}
            onChange={(e) =>
              setPrefs({ ...prefs, weekStart: Number(e.target.value) as Preferences['weekStart'] })
            }
          >
            {WEEK_STARTS.map((day) => (
              <option key={day} value={day}>
                {tSettings(`weekdays.${day}`)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        {index > 0 ? (
          <Button onClick={() => setIndex(index - 1)} disabled={pending}>
            {t('back')}
          </Button>
        ) : (
          <span />
        )}
        {last ? (
          <Button variant="primary" onClick={finish} loading={pending}>
            {t('finish')}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setIndex(index + 1)}>
            {t('next')}
          </Button>
        )}
      </div>
    </Panel>
  );
}
