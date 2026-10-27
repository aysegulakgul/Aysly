import { headers } from 'next/headers';
import type { CurrentUser } from '../application/current-user';
import { auth } from './auth';

/** Sunucu bileşenleri ve route handler'lar için oturumdaki kullanıcı; oturum yoksa null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, emailVerified } = session.user;
  return { id, name, email, emailVerified };
}
