/** preferences modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  defaultPreferences,
  isValidTimezone,
  type Locale,
  type PreferenceDefaults,
} from './domain/defaults';
export type { Density, Preferences, Theme } from './domain/preferences';
export { insertDefaultPreferences } from './infrastructure/preferences-writer';
export { findUserLocale, findUserPreferences } from './infrastructure/preferences-reader';
export { getPreferences, patchPreferences } from './http/preferences-handlers';
