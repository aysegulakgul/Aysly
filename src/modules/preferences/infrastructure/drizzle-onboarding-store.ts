import { eq, sql } from 'drizzle-orm';
import { insertProjects } from '@/modules/projects';
import { findPersonalWorkspaceId } from '@/modules/workspaces';
import type { Database } from '@/shared/db/client';
import { uuidv7 } from '@/shared/kernel/id';
import type { OnboardingStore } from '../application/onboarding';
import { parseOnboarding } from '../domain/onboarding';
import { userPreferences } from './schema';

/**
 * Onboarding durumu, dashboard düzeni ve örnek projeler tek işlemde yazılır: yarıda kalan bir onboarding
 * projeleri oluşturup durumu "bekliyor" bırakmaz.
 */
export function createDrizzleOnboardingStore(database: Database): OnboardingStore {
  return {
    async find(userId) {
      const [row] = await database
        .select({ onboarding: userPreferences.onboarding, locale: userPreferences.locale })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      if (!row) return null;
      return { state: parseOnboarding(row.onboarding), locale: row.locale === 'en' ? 'en' : 'tr' };
    },

    async save(userId, state, effects, now) {
      await database.transaction(async (tx) => {
        await tx
          .update(userPreferences)
          .set({
            onboarding: state,
            ...(effects.layout ? { dashboardLayout: effects.layout } : {}),
            version: sql`${userPreferences.version} + 1`,
            updatedAt: now,
          })
          .where(eq(userPreferences.userId, userId));

        if (effects.projects?.length) {
          const workspaceId = await findPersonalWorkspaceId(tx, userId);
          if (!workspaceId) throw new Error('kişisel çalışma alanı bulunamadı');
          await insertProjects(tx, {
            workspaceId,
            createdBy: userId,
            projects: effects.projects.map((p) => ({ id: uuidv7(), ...p })),
            now,
          });
        }
      });
    },
  };
}
