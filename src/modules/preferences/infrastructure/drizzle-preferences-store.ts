import { and, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import type { PreferencesStore } from '../application/update-preferences';
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
  version: userPreferences.version,
};

// Değerler veritabanı CHECK kısıtlarıyla sınırlıdır (schema.ts); okunan satır domain türüne uyar.
const toPreferences = (row: Record<keyof typeof columns, unknown>) => row as Preferences;

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
