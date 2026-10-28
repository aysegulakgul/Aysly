import type { Clock } from '@/shared/kernel/clock';
import { notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { normalizeLayout } from '../domain/dashboard';
import {
  validatePreferenceChanges,
  type PreferenceChanges,
  type Preferences,
} from '../domain/preferences';

/** Tercih deposu portu. `update`, sürüm uyuşmazsa veya kayıt yoksa null döner (iyimser kilit). */
export type PreferencesStore = {
  find(userId: string): Promise<Preferences | null>;
  update(
    userId: string,
    expectedVersion: number,
    changes: PreferenceChanges,
    now: Date,
  ): Promise<Preferences | null>;
};

export type UpdatePreferencesDeps = { store: PreferencesStore; clock: Clock };

/**
 * BR-PREF-002: tercihler yalnızca sahibine aittir; aktör kendi kaydını değiştirir, başka kullanıcının kimliği
 * istekte yer almaz. BR-PREF-003: yalnızca sunum değişir, saklanan veri dönüştürülmez.
 */
export async function updatePreferences(
  deps: UpdatePreferencesDeps,
  actor: { userId: string },
  command: { version: number; changes: PreferenceChanges },
): Promise<Result<Preferences, DomainError>> {
  const issues = validatePreferenceChanges(command.changes);
  if (issues.length > 0) return err(validationError(issues));

  const changes = command.changes.dashboardLayout
    ? { ...command.changes, dashboardLayout: normalizeLayout(command.changes.dashboardLayout) }
    : command.changes;
  const updated = await deps.store.update(actor.userId, command.version, changes, deps.clock.now());
  if (updated) return ok(updated);

  const current = await deps.store.find(actor.userId);
  if (!current) return err(notFound());
  return err({ kind: 'version_conflict', current });
}
