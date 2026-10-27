import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import { serverText } from '@/i18n/server-messages';
import { LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from '@/i18n/config';
import { env } from '@/shared/config/env';
import { db } from '@/shared/db/client';
import { internalError, mapDomainError } from '@/shared/http/error-mapper';
import { isSameOrigin } from '@/shared/http/origin';
import { REQUEST_ID_HEADER, resolveRequestId } from '@/shared/http/request-id';
import { systemClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { logger } from '@/shared/observability/logger';
import { registerUser } from '../application/register-user';
import { auth } from '../infrastructure/auth';
import { createDrizzleRegistrationStore } from '../infrastructure/drizzle-registration-store';
import { consumeRateLimit } from '../infrastructure/rate-limiter';

/** API_CONTRACTS §3: POST /api/v1/auth/sign-up. Bilinmeyen alanlar reddedilir (§2.6). */
const SignUpBody = z.strictObject({
  name: z.string().max(200),
  email: z.string().max(320),
  password: z.string().max(1000),
  timezone: z.string().max(100).optional(),
});

function localeOf(request: Request): Locale {
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === LOCALE_COOKIE)?.[1];
  return isLocale(cookie) ? cookie : negotiateLocale(request.headers.get('accept-language'));
}

/**
 * Yerelde proxy yoktur; X-Forwarded-For istemci tarafından uydurulabileceği için güvenilmez ve tüm istekler
 * aynı anahtarı paylaşır. Yayına alındığında güvenilir proxy başlığı yapılandırılır (OQ-032).
 */
function clientKey(): string {
  return 'local';
}

export async function handleSignUp(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const locale = localeOf(request);
  const t = serverText(locale);
  const json = (status: number, body: unknown, headers?: HeadersInit) =>
    NextResponse.json(body, { status, headers: { [REQUEST_ID_HEADER]: requestId, ...headers } });

  try {
    if (!isSameOrigin(request.headers, env().APP_BASE_URL)) {
      return json(403, {
        error: { code: 'CSRF_REJECTED', message: t('errors.forbidden'), requestId },
      });
    }

    // SECURITY §4.4: kayıt 5 / saat / IP
    const limit = env().AUTH_RATE_LIMIT_ENABLED
      ? await consumeRateLimit(db(), {
          key: `sign-up:${clientKey()}`,
          windowSeconds: 3600,
          max: 5,
          nowMs: Date.now(),
        })
      : { allowed: true, retryAfterSeconds: 0 };
    if (!limit.allowed) {
      return json(
        429,
        { error: { code: 'RATE_LIMITED', message: t('errors.rateLimited'), requestId } },
        { 'Retry-After': String(limit.retryAfterSeconds) },
      );
    }

    const parsed = SignUpBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        reason: i.code,
      }));
      const mapped = mapDomainError({ kind: 'validation', issues }, requestId, t);
      return json(mapped.status, mapped.body);
    }

    const result = await registerUser(
      {
        store: createDrizzleRegistrationStore(db()),
        hasher: { hash: hashPassword },
        clock: systemClock,
        newId: uuidv7,
      },
      { ...parsed.data, locale },
    );
    if (!result.ok) {
      const mapped = mapDomainError(result.error, requestId, t);
      return json(mapped.status, mapped.body);
    }

    // D-040: kullanıcı kayıttan hemen sonra uygulamayı kullanabilir → oturum açılır.
    const signIn = await auth().api.signInEmail({
      body: { email: result.value.email, password: parsed.data.password },
      headers: request.headers,
      returnHeaders: true,
    });
    // BR-ACC-004 / D-055: doğrulama e-postası (yerelde Mailpit). Gönderilemezse kayıt yine tamamlanır (E39).
    try {
      await auth().api.sendVerificationEmail({
        body: { email: result.value.email, callbackURL: '/' },
      });
    } catch (error) {
      logger().warn(
        { requestId, err: error instanceof Error ? error.message : 'bilinmeyen' },
        'doğrulama e-postası gönderilemedi',
      );
    }

    const response = json(201, {
      data: { user: { id: result.value.userId }, workspaceId: result.value.workspaceId },
    });
    for (const cookie of signIn.headers.getSetCookie())
      response.headers.append('set-cookie', cookie);
    return response;
  } catch (error) {
    logger().error(
      { requestId, err: error instanceof Error ? error.message : 'bilinmeyen' },
      'kayıt başarısız',
    );
    const mapped = internalError(requestId, t);
    return json(mapped.status, mapped.body);
  }
}
