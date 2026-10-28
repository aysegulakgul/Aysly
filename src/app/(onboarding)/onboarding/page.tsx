import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { findOnboardingState, sampleProjects } from '@/modules/preferences';
import { getViewer } from '../../viewer';
import { OnboardingFlow } from './onboarding-flow';

/** ONBOARDING §2: en fazla 3 adım; her adımda "Atla". Tamamlanmışsa ana sayfaya dönülür. */
export default async function OnboardingPage() {
  const [viewer, locale] = await Promise.all([getViewer(), getLocale()]);
  if (!viewer) return null;
  const state = await findOnboardingState(viewer.user.id);
  if (!state || state.status === 'completed') redirect('/');
  const lang = locale === 'en' ? 'en' : 'tr';
  const names = (intents: ('personal' | 'work')[]) =>
    sampleProjects(intents, lang).map((p) => p.name);
  return (
    <OnboardingFlow
      preferences={viewer.preferences}
      samplesAlreadyCreated={state.samplesCreated}
      samplePreview={{
        personal: names(['personal']),
        work: names(['work']),
        both: names(['personal', 'work']),
      }}
      timeZones={Intl.supportedValuesOf('timeZone')}
    />
  );
}
