import { eq } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import type { Locale } from '../domain/defaults';
import type { Preferences } from '../domain/preferences';
import { createDrizzlePreferencesStore } from './drizzle-preferences-store';
import { userPreferences } from './schema';

/** Kullanıcının dil tercihi; tercih kaydı yoksa Türkçe (BR-PREF-001). */
export async function findUserLocale(db: DbExecutor, userId: string): Promise<Locale> {
  const [row] = await db
    .select({ locale: userPreferences.locale })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return row?.locale === 'en' ? 'en' : 'tr';
}

/** Sayfa düzeni ve ayarlar ekranı için kullanıcının tercihleri. */
export function findUserPreferences(db: DbExecutor, userId: string): Promise<Preferences | null> {
  return createDrizzlePreferencesStore(db).find(userId);
}
