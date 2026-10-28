import { z } from 'zod';
import { DEFAULT_WIDGETS, type Locale } from './defaults';

/**
 * Onboarding (ONBOARDING_AND_PERSONALIZATION §2–3, D-063). Durum `user_preferences.onboarding` JSONB alanında,
 * sürümlü şemayla saklanır (DATA_MODEL §3.5). Yanıtlar yalnızca başlangıç düzenini etkiler; yetki veya özellik
 * açıp kapatmaz (§1, D-002).
 */
export const INTENTS = ['personal', 'work'] as const;
export type Intent = (typeof INTENTS)[number];

export const OnboardingState = z.object({
  v: z.literal(1),
  status: z.enum(['pending', 'completed']).default('pending'),
  intents: z.array(z.enum(INTENTS)).default([]),
  /** "Atla" sayısı; ikinci atlamadan sonra bir daha önerilmez (§2). */
  skips: z.number().int().min(0).default(0),
  lastSkippedAt: z.string().optional(),
  completedAt: z.string().optional(),
  /** Örnek projeler bir kez oluşturulur; onboarding yeniden başlatılsa da tekrarlanmaz. */
  samplesCreated: z.boolean().default(false),
  /** ONBOARDING §4: "İlk adımlar" kapatıldı mı, kısayol rehberi açıldı mı. */
  checklist: z
    .object({ dismissed: z.boolean().default(false), shortcutsSeen: z.boolean().default(false) })
    .default({ dismissed: false, shortcutsSeen: false }),
});
export type OnboardingState = z.infer<typeof OnboardingState>;

/** Kayıtta yazılan `{ v: 1 }` dahil eski/eksik değerler varsayılanlarla okunur. */
export const parseOnboarding = (raw: unknown): OnboardingState =>
  OnboardingState.catch(OnboardingState.parse({ v: 1 })).parse(raw);

/**
 * §2: Tamamlanmadıysa önerilir. Bir kez atlandıysa yalnızca sonraki girişte (atlamadan sonra açılan oturumda)
 * bir kez daha önerilir; iki kez atlandıysa bir daha önerilmez (Ayarlar'dan yeniden başlatılabilir).
 */
export function shouldOfferOnboarding(state: OnboardingState, sessionStartedAt: Date): boolean {
  if (state.status === 'completed' || state.skips >= 2) return false;
  if (state.skips === 0) return true;
  return state.lastSkippedAt !== undefined && sessionStartedAt > new Date(state.lastSkippedAt);
}

export function recordSkip(state: OnboardingState, now: Date): OnboardingState {
  return { ...state, skips: state.skips + 1, lastSkippedAt: now.toISOString() };
}

export function restartOnboarding(state: OnboardingState): OnboardingState {
  return {
    v: 1,
    status: 'pending',
    intents: [],
    skips: 0,
    samplesCreated: state.samplesCreated,
    checklist: state.checklist,
  };
}

const has = (intents: readonly Intent[], i: Intent) => intents.includes(i);

/** §3: amaca göre dashboard widget sırası; listede olmayanlar gizli olarak sona eklenir. */
export function starterWidgets(intents: readonly Intent[]): string[] {
  const personal = has(intents, 'personal');
  const work = has(intents, 'work');
  if (personal && work) return ['today', 'overdue', 'upcoming', 'projects', 'goals'];
  if (personal) return ['today', 'overdue', 'upcoming', 'goals'];
  if (work) return ['today', 'overdue', 'priority', 'projects', 'upcoming'];
  return DEFAULT_WIDGETS;
}

export function starterLayout(intents: readonly Intent[]) {
  const visible = starterWidgets(intents);
  return {
    v: 1 as const,
    widgets: [
      ...visible.map((id) => ({ id, visible: true })),
      ...DEFAULT_WIDGETS.filter((id) => !visible.includes(id)).map((id) => ({
        id,
        visible: false,
      })),
    ],
  };
}

export type SampleProject = { name: string; description?: string };

const SAMPLE_TEXT = {
  tr: {
    home: 'Ev',
    health: 'Sağlık',
    growth: 'Kişisel gelişim',
    work: 'İş',
    workHint: 'Her müşteri/iş için ayrı proje oluşturabilirsin.',
  },
  en: {
    home: 'Home',
    health: 'Health',
    growth: 'Personal growth',
    work: 'Work',
    workHint: 'You can create a separate project for each client or job.',
  },
} as const;

/**
 * §3: amaca göre örnek projeler; adlar kullanıcının dilinde normal kayıt olarak oluşturulur (DATA_MODEL §8).
 * Örnek görev oluşturulmaz (§3).
 */
export function sampleProjects(intents: readonly Intent[], locale: Locale): SampleProject[] {
  const t = SAMPLE_TEXT[locale];
  const personal = has(intents, 'personal');
  const work = has(intents, 'work');
  if (personal && work) return [{ name: t.home }, { name: t.work }];
  if (personal) return [{ name: t.home }, { name: t.health }, { name: t.growth }];
  if (work) return [{ name: t.work, description: t.workHint }];
  return [];
}
