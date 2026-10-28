import type { Clock } from '@/shared/kernel/clock';
import { notFound, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import type { Locale } from '../domain/defaults';
import {
  recordSkip,
  restartOnboarding as restartState,
  sampleProjects,
  starterLayout,
  type Intent,
  type OnboardingState,
  type SampleProject,
} from '../domain/onboarding';

/** Onboarding deposu portu. `save` tek veritabanı işleminde durumu, düzeni ve örnek projeleri yazar. */
export type OnboardingStore = {
  find(userId: string): Promise<{ state: OnboardingState; locale: Locale } | null>;
  save(
    userId: string,
    state: OnboardingState,
    effects: { layout?: ReturnType<typeof starterLayout>; projects?: SampleProject[] },
    now: Date,
  ): Promise<void>;
};

export type OnboardingDeps = { store: OnboardingStore; clock: Clock };

async function load(deps: OnboardingDeps, userId: string) {
  const found = await deps.store.find(userId);
  return found ?? null;
}

/** ONBOARDING §2–3: yanıtlar kaydedilir, başlangıç düzeni uygulanır, istenirse örnek projeler bir kez oluşturulur. */
export async function completeOnboarding(
  deps: OnboardingDeps,
  actor: { userId: string },
  command: { intents: Intent[]; createSamples: boolean },
): Promise<Result<OnboardingState, DomainError>> {
  const found = await load(deps, actor.userId);
  if (!found) return err(notFound());
  const now = deps.clock.now();
  const intents = [...new Set(command.intents)];
  const projects =
    command.createSamples && !found.state.samplesCreated
      ? sampleProjects(intents, found.locale)
      : [];
  const state: OnboardingState = {
    ...found.state,
    status: 'completed',
    intents,
    completedAt: now.toISOString(),
    samplesCreated: found.state.samplesCreated || projects.length > 0,
  };
  await deps.store.save(actor.userId, state, { layout: starterLayout(intents), projects }, now);
  return ok(state);
}

/** §2: "Atla" — düzen varsayılan kalır; atlama sayısı artar. */
export async function skipOnboarding(
  deps: OnboardingDeps,
  actor: { userId: string },
): Promise<Result<OnboardingState, DomainError>> {
  const found = await load(deps, actor.userId);
  if (!found) return err(notFound());
  if (found.state.status === 'completed') return ok(found.state);
  const now = deps.clock.now();
  const state = recordSkip(found.state, now);
  await deps.store.save(actor.userId, state, {}, now);
  return ok(state);
}

/** §2: Ayarlar'dan yeniden başlatma. Örnek projeler daha önce oluşturulduysa yeniden oluşturulmaz. */
export async function restartOnboarding(
  deps: OnboardingDeps,
  actor: { userId: string },
): Promise<Result<OnboardingState, DomainError>> {
  const found = await load(deps, actor.userId);
  if (!found) return err(notFound());
  const state = restartState(found.state);
  await deps.store.save(actor.userId, state, {}, deps.clock.now());
  return ok(state);
}
