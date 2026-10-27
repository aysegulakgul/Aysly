/** preferences modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  defaultPreferences,
  isValidTimezone,
  type Locale,
  type PreferenceDefaults,
} from './domain/defaults';
export { insertDefaultPreferences } from './infrastructure/preferences-writer';
export { findUserLocale } from './infrastructure/preferences-reader';
