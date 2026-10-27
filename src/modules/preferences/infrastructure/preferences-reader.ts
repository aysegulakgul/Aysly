import { eq } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import type { Locale } from '../domain/defaults';
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
