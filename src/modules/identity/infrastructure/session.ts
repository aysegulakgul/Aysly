import { headers } from 'next/headers';
import { cache } from 'react';
import type { Actor } from '@/shared/http/api-route';
import type { CurrentUser } from '../application/current-user';
import { auth } from './auth';

/**
 * Sunucu bileşenleri ve route handler'lar için oturumdaki kullanıcı; oturum yoksa null.
 * Aynı istek içinde (düzen, dil, sayfa) tek kez çözülür.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, emailVerified } = session.user;
  return { id, name, email, emailVerified };
});

/** API uç noktaları için aktör (ARCHITECTURE §7: getCurrentActor → aktör ya da 401). */
export async function getCurrentActor(): Promise<Actor | null> {
  const user = await getCurrentUser();
  return user ? { userId: user.id } : null;
}
