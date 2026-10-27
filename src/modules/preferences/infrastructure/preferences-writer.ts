import type { DbExecutor } from '@/shared/db/client';
import type { PreferenceDefaults } from '../domain/defaults';
import { userPreferences } from './schema';

/** BR-PREF-001: kayıtta varsayılan tercihler. Çağıranın işlemi içinde çalışır. */
export async function insertDefaultPreferences(
  db: DbExecutor,
  input: { userId: string; preferences: PreferenceDefaults; now: Date },
): Promise<void> {
  const p = input.preferences;
  await db.insert(userPreferences).values({
    userId: input.userId,
    locale: p.locale,
    timezone: p.timezone,
    theme: p.theme,
    density: p.density,
    dateFormat: p.dateFormat,
    timeFormat: p.timeFormat,
    weekStart: p.weekStart,
    defaultTaskView: p.defaultTaskView,
    startPage: p.startPage,
    allDayReminderTime: p.allDayReminderTime,
    dashboardLayout: p.dashboardLayout,
    notificationSettings: p.notificationSettings,
    onboarding: p.onboarding,
    updatedAt: input.now,
  });
}
