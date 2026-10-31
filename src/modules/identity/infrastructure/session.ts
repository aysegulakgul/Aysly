import { headers } from 'next/headers';
import { cache } from 'react';
import type { Actor } from '@/shared/http/api-route';
import type { CurrentUser } from '../application/current-user';
import { auth } from './auth';

const deletionOf = (user: { deletionRequestedAt?: Date | string | null | undefined }) =>
  user.deletionRequestedAt ? new Date(user.deletionRequestedAt) : null;

/** Aynı istek içinde (düzen, dil, sayfa, uç nokta) oturum tek kez çözülür. */
const getSession = cache(async () => auth().api.getSession({ headers: await headers() }));

/** Sunucu bileşenleri ve route handler'lar için oturumdaki kullanıcı; oturum yoksa null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const { id, name, email, emailVerified } = session.user;
  return { id, name, email, emailVerified, deletionRequestedAt: deletionOf(session.user) };
});

/** API uç noktaları için aktör (ARCHITECTURE §7: getCurrentActor → { userId, sessionId } ya da 401). */
export async function getCurrentActor(): Promise<Actor | null> {
  const session = await getSession();
  if (!session) return null;
  const actor: Actor = { userId: session.user.id, sessionId: session.session.id };
  return deletionOf(session.user) ? { ...actor, deletionPending: true } : actor;
}

/** Oturumun açıldığı an (ONBOARDING §2: atlanan onboarding bir sonraki girişte bir kez daha önerilir). */
export async function getSessionStartedAt(): Promise<Date | null> {
  const session = await getSession();
  return session ? new Date(session.session.createdAt) : null;
}
