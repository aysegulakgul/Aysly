import { isAPIError } from 'better-auth/api';
import type { Credentials } from '../application/account';
import { auth } from './auth';

const isInvalidPassword = (error: unknown) =>
  isAPIError(error) && (error.body as { code?: string } | undefined)?.code === 'INVALID_PASSWORD';

/**
 * Credentials portunun Better Auth uyarlaması. İsteğin başlıklarıyla (oturum çerezi) çalışır; şifre değişince
 * kütüphanenin verdiği yeni oturum çerezi `setCookies` içinde toplanır ve HTTP yanıtına eklenir.
 */
export function createBetterAuthCredentials(headers: Headers): Credentials & {
  setCookies: string[];
} {
  const setCookies: string[] = [];
  return {
    setCookies,
    async verifyPassword(password) {
      try {
        await auth().api.verifyPassword({ body: { password }, headers });
        return true;
      } catch (error) {
        if (isInvalidPassword(error)) return false;
        throw error;
      }
    },
    async changePassword(currentPassword, newPassword) {
      try {
        const result = await auth().api.changePassword({
          body: { currentPassword, newPassword, revokeOtherSessions: true }, // BR-ACC-006
          headers,
          returnHeaders: true,
        });
        setCookies.push(...result.headers.getSetCookie());
        return 'changed';
      } catch (error) {
        if (isInvalidPassword(error)) return 'incorrect';
        throw error;
      }
    },
    async requestEmailChange(newEmail) {
      await auth().api.changeEmail({
        body: { newEmail, callbackURL: '/settings/profile?email=verified' },
        headers,
      });
    },
  };
}
