import { z } from 'zod';
import { LOCALE_COOKIE, LOCALES } from '@/i18n/config';
import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { systemClock } from '@/shared/kernel/clock';
import { updatePreferences } from '../application/update-preferences';
import { DATE_FORMATS, DENSITIES, THEMES, TIME_FORMATS, WEEK_STARTS } from '../domain/preferences';
import { createDrizzlePreferencesStore } from '../infrastructure/drizzle-preferences-store';

/** API_CONTRACTS §4: PATCH /me/preferences. `version` zorunlu; bilinmeyen alanlar reddedilir (§2.6). */
const PatchPreferencesBody = z.strictObject({
  version: z.number().int().positive(),
  locale: z.enum(LOCALES).optional(),
  timezone: z.string().min(1).max(100).optional(),
  theme: z.enum(THEMES).optional(),
  density: z.enum(DENSITIES).optional(),
  dateFormat: z.enum(DATE_FORMATS).optional(),
  timeFormat: z.enum(TIME_FORMATS).optional(),
  weekStart: z.union(WEEK_STARTS.map((n) => z.literal(n))).optional(),
});

/** Dil çerezi bir yıl geçerlidir; oturum açık değilken giriş ekranlarının da bu dilde açılmasını sağlar. */
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function getPreferences(ctx: ApiContext): Promise<Response> {
  const preferences = await createDrizzlePreferencesStore(db()).find(ctx.actor.userId);
  if (!preferences) return ctx.fail({ kind: 'not_found' });
  return ctx.json(200, { data: preferences });
}

export async function patchPreferences(ctx: ApiContext): Promise<Response> {
  const body = await ctx.parse(PatchPreferencesBody);
  if (!body.ok) return body.response;
  const { version, ...changes } = body.data;

  const result = await updatePreferences(
    { store: createDrizzlePreferencesStore(db()), clock: systemClock },
    ctx.actor,
    { version, changes },
  );
  if (!result.ok) return ctx.fail(result.error);

  const response = ctx.json(200, { data: result.value });
  if (changes.locale) {
    response.cookies.set(LOCALE_COOKIE, changes.locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: LOCALE_COOKIE_MAX_AGE,
    });
  }
  return response;
}
