import { and, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import type { PreferencesStore } from '../application/update-preferences';
import { normalizeLayout } from '../domain/dashboard';
import type { Preferences } from '../domain/preferences';
import { userPreferences } from './schema';

const columns = {
  locale: userPreferences.locale,
  timezone: userPreferences.timezone,
  theme: userPreferences.theme,
  density: userPreferences.density,
  dateFormat: userPreferences.dateFormat,
  timeFormat: userPreferences.timeFormat,
  weekStart: userPreferences.weekStart,
  dashboardLayout: userPreferences.dashboardLayout,
  allDayReminderTime: userPreferences.allDayReminderTime,
  notificationSettings: userPreferences.notificationSettings,
  version: userPreferences.version,
};

// Değerler veritabanı CHECK kısıtlarıyla sınırlıdır (schema.ts); okunan satır domain türüne uyar.
const toPreferences = (row: Record<keyof typeof columns, unknown>) =>
  ({
    ...row,
    dashboardLayout: normalizeLayout(row.dashboardLayout),
    // Postgres `time` "09:00:00" döner; tercih HH:MM olarak sunulur.
    allDayReminderTime: String(row.allDayReminderTime).slice(0, 5),
    notificationSettings: normalizeNotificationSettings(row.notificationSettings),
  }) as Preferences;

/** DATA_MODEL §3.5 / E20: bozuk JSON varsayılana düşer (hatırlatıcılar açık). */
function normalizeNotificationSettings(value: unknown) {
  const inApp = (value as { reminder?: { inApp?: unknown } } | null)?.reminder?.inApp;
  return { v: 1 as const, reminder: { inApp: inApp !== false } };
}

export function createDrizzlePreferencesStore(db: DbExecutor): PreferencesStore {
  return {
    async find(userId) {
      const [row] = await db
        .select(columns)
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      return row ? toPreferences(row) : null;
    },

    async update(userId, expectedVersion, changes, now) {
      const [row] = await db
        .update(userPreferences)
        .set({ ...changes, version: sql`${userPreferences.version} + 1`, updatedAt: now })
        .where(
          and(eq(userPreferences.userId, userId), eq(userPreferences.version, expectedVersion)),
        )
        .returning(columns);
      return row ? toPreferences(row) : null;
    },
  };
}
