import { z } from 'zod';
import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { systemClock } from '@/shared/kernel/clock';
import {
  completeOnboarding,
  restartOnboarding,
  skipOnboarding,
  updateChecklist,
} from '../application/onboarding';
import { INTENTS, shouldOfferOnboarding } from '../domain/onboarding';
import { createDrizzleOnboardingStore } from '../infrastructure/drizzle-onboarding-store';

/** API_CONTRACTS §4: POST /me/onboarding. Boş `intents` "amaç seçilmedi" demektir (varsayılan düzen). */
const CompleteBody = z.strictObject({
  intents: z.array(z.enum(INTENTS)).max(INTENTS.length),
  createSamples: z.boolean(),
});

const deps = () => ({ store: createDrizzleOnboardingStore(db()), clock: systemClock });

export async function postOnboarding(ctx: ApiContext): Promise<Response> {
  const body = await ctx.parse(CompleteBody);
  if (!body.ok) return body.response;
  const result = await completeOnboarding(deps(), ctx.actor, body.data);
  return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
}

export async function postOnboardingSkip(ctx: ApiContext): Promise<Response> {
  const result = await skipOnboarding(deps(), ctx.actor);
  return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
}

export async function postOnboardingRestart(ctx: ApiContext): Promise<Response> {
  const result = await restartOnboarding(deps(), ctx.actor);
  return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
}

/** Sayfa düzeni için: bu oturumda onboarding önerilmeli mi? (ONBOARDING §2) */
export async function findOnboardingOffer(userId: string, sessionStartedAt: Date) {
  const found = await createDrizzleOnboardingStore(db()).find(userId);
  return found ? shouldOfferOnboarding(found.state, sessionStartedAt) : false;
}

export async function findOnboardingState(userId: string) {
  return (await createDrizzleOnboardingStore(db()).find(userId))?.state ?? null;
}

const ChecklistBody = z.strictObject({
  dismissed: z.literal(true).optional(),
  shortcutsSeen: z.literal(true).optional(),
});

/** PATCH /me/onboarding/checklist (ONBOARDING §4). */
export async function patchChecklist(ctx: ApiContext): Promise<Response> {
  const body = await ctx.parse(ChecklistBody);
  if (!body.ok) return body.response;
  const result = await updateChecklist(deps(), ctx.actor, body.data);
  return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
}
