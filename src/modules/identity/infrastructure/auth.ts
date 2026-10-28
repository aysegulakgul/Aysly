import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, isAPIError } from 'better-auth/api';
import { recordAuditEvent } from '@/modules/audit';
import { findUserLocale } from '@/modules/preferences';
import { serverText } from '@/i18n/server-messages';
import { env } from '@/shared/config/env';
import { getEmailSender } from '@/shared/composition';
import { db } from '@/shared/db/client';
import { uuidv7 } from '@/shared/kernel/id';
import { logger } from '@/shared/observability/logger';
import { buildSecurityEmail, type SecurityEmailKind } from '../application/security-emails';
import { authAccounts, authRateLimits, authSessions, authVerifications, users } from './schema';

const DAY = 60 * 60 * 24;

async function sendSecurityEmail(
  kind: SecurityEmailKind,
  user: { id: string; email: string; name: string },
  url?: string,
) {
  const locale = await findUserLocale(db(), user.id);
  await getEmailSender().send(buildSecurityEmail(kind, serverText(locale), user, url));
}

async function audit(action: string, userId: string) {
  await recordAuditEvent(db(), { id: uuidv7(), action, actorUserId: userId, now: new Date() });
}

/**
 * Kimlik doğrulama (FR-AUTH, BR-ACC-002..006, D-039, D-040, D-055). Kayıt bu yapılandırmayla değil
 * `registerUser` use case'iyle yapılır (BR-WS-001: tek işlem); bu yüzden Better Auth'un kayıt uç noktası kapalıdır.
 */
function createAuth() {
  const config = env();
  return betterAuth({
    appName: 'Aysly',
    baseURL: config.APP_BASE_URL,
    basePath: '/api/auth',
    secret: config.AUTH_SECRET,
    trustedOrigins: [config.APP_BASE_URL], // SECURITY §6: Origin kontrolü
    database: drizzleAdapter(db(), {
      provider: 'pg',
      transaction: true,
      schema: {
        user: users,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
        rateLimit: authRateLimits,
      },
    }),
    advanced: {
      database: { generateId: () => uuidv7() }, // D-015
      cookiePrefix: 'aysly',
      // Yerelde http://localhost; Secure çerez yayında zorunlu (SECURITY §4.2, ARCHITECTURE §12.3).
      useSecureCookies: config.NODE_ENV === 'production',
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10, // BR-ACC-002
      maxPasswordLength: 128,
      requireEmailVerification: false, // D-040: temel özellikler hemen kullanılabilir
      resetPasswordTokenExpiresIn: 30 * 60, // BR-ACC-003: 30 dakika
      revokeSessionsOnPasswordReset: true, // BR-ACC-003: tüm oturumlar kapanır
      sendResetPassword: async ({ user, url }) => sendSecurityEmail('reset', user, url),
      onPasswordReset: async ({ user }) => {
        await audit('auth.password_reset', user.id);
        await sendSecurityEmail('passwordChanged', user); // D-055
      },
    },
    user: {
      // BR-ACC-004: yeni adrese doğrulama bağlantısı gider, doğrulanınca e-posta değişir; o zamana kadar eski adres
      // geçerlidir. Eski adrese onay e-postası MVP'de yok (D-055, D-062).
      changeEmail: { enabled: true, updateEmailWithoutVerification: false },
    },
    emailVerification: {
      sendOnSignUp: false, // kayıt kendi use case'imizde; e-posta oradan istenir
      expiresIn: DAY, // BR-ACC-004: 24 saat
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => sendSecurityEmail('verify', user, url),
    },
    session: {
      expiresIn: 30 * DAY, // BR-ACC-006: 30 gün hareketsizlikte sona erer
      updateAge: DAY,
    },
    /**
     * Bu işlemler kendi /api/v1/me uç noktalarımızdan yapılır: doğrulama kuralları uygulanır, oturum listesinde
     * token'lar tarayıcıya gönderilmez, şifre değişince diğer oturumlar her zaman kapanır. Kapalı yollar yalnızca
     * HTTP'den kapanır; sunucu içi `auth().api` çağrıları çalışmaya devam eder.
     */
    disabledPaths: [
      '/update-user',
      '/change-email',
      '/change-password',
      '/verify-password',
      '/list-sessions',
      '/revoke-session',
      '/revoke-sessions',
      '/revoke-other-sessions',
      '/delete-user',
      '/set-password',
    ],
    rateLimit: {
      enabled: config.AUTH_RATE_LIMIT_ENABLED,
      storage: 'database',
      modelName: 'rateLimit',
      window: 60,
      max: 100,
      // SECURITY §4.4
      customRules: {
        '/sign-in/email': { window: 15 * 60, max: 10 },
        '/request-password-reset': { window: 60 * 60, max: 3 },
        '/reset-password/*': { window: 60 * 60, max: 10 },
        '/send-verification-email': { window: 60 * 60, max: 3 },
        // Şifre ve e-posta değiştirme sınırları kendi uç noktalarımızda (account-handlers.ts).
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const session = ctx.context.newSession ?? ctx.context.session;
        if (ctx.path === '/sign-in/email' && ctx.context.newSession) {
          await audit('auth.sign_in', ctx.context.newSession.user.id);
        }
        if (ctx.path === '/change-password' && session && !isAPIError(ctx.context.returned)) {
          await audit('auth.password_changed', session.user.id);
          await sendSecurityEmail('passwordChanged', session.user); // D-055
        }
      }),
    },
    logger: {
      log: (level, message) => {
        // Kullanıcı verisi veya token loglanmaz (SECURITY §7); yalnızca kütüphane mesajı.
        logger()[level](message);
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;
export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}
