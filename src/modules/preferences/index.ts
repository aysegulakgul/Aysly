/** preferences modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  defaultPreferences,
  isValidTimezone,
  type Locale,
  type PreferenceDefaults,
} from './domain/defaults';
export type { Density, Preferences, Theme } from './domain/preferences';
export { sampleProjects, type Intent, type OnboardingState } from './domain/onboarding';
export { insertDefaultPreferences } from './infrastructure/preferences-writer';
export { findUserLocale, findUserPreferences } from './infrastructure/preferences-reader';
export { getPreferences, patchPreferences } from './http/preferences-handlers';
export {
  findOnboardingOffer,
  findOnboardingState,
  postOnboarding,
  postOnboardingRestart,
  postOnboardingSkip,
} from './http/onboarding-handlers';
