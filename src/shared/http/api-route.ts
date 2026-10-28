import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from '@/i18n/config';
import { serverText } from '@/i18n/server-messages';
import { env } from '@/shared/config/env';
import type { DomainError } from '@/shared/kernel/errors';
import { logger } from '@/shared/observability/logger';
import { internalError, mapDomainError, type Translate } from './error-mapper';
import { isSameOrigin } from './origin';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id';

/** Oturumdaki aktör (ARCHITECTURE §7). Kimlik modülü tarafından çözülür ve rotada enjekte edilir. */
export type Actor = { userId: string };

/** İsteğin dili: kullanıcının seçtiği dil çerezi, yoksa tarayıcı dili. Hata metinleri bu dilde döner. */
export function requestLocale(headers: Headers): Locale {
  const cookie = headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === LOCALE_COOKIE)?.[1];
  return isLocale(cookie) ? cookie : negotiateLocale(headers.get('accept-language'));
}

export type ApiContext = {
  request: Request;
  requestId: string;
  locale: Locale;
  t: Translate;
  actor: Actor;
  json(status: number, body: unknown, headers?: HeadersInit): NextResponse;
  fail(error: DomainError): NextResponse;
  /** Gövdeyi Zod şemasıyla doğrular; geçersizse 400 yanıtını döner (API_CONTRACTS §2.4). */
  parse<T>(
    schema: ZodType<T>,
  ): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }>;
};

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Kendi /api/v1 uç noktalarımızın ortak sarmalayıcısı: istek kimliği, yazma isteklerinde Origin kontrolü
 * (SECURITY §6), oturum zorunluluğu (401), tek yerde hata eşleme ve beklenmeyen hatalarda güvenli 500.
 */
export function apiRoute(options: {
  resolveActor: () => Promise<Actor | null>;
  handler: (ctx: ApiContext) => Promise<Response>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
    const locale = requestLocale(request.headers);
    const t = serverText(locale);
    const json = (status: number, body: unknown, headers?: HeadersInit) =>
      NextResponse.json(body, { status, headers: { [REQUEST_ID_HEADER]: requestId, ...headers } });
    const errorBody = (code: string, message: string) => ({ error: { code, message, requestId } });

    try {
      if (MUTATING.has(request.method) && !isSameOrigin(request.headers, env().APP_BASE_URL)) {
        return json(403, errorBody('CSRF_REJECTED', t('errors.forbidden')));
      }
      const actor = await options.resolveActor();
      if (!actor) return json(401, errorBody('UNAUTHENTICATED', t('errors.unauthenticated')));

      const fail = (error: DomainError) => {
        const mapped = mapDomainError(error, requestId, t);
        return json(mapped.status, mapped.body);
      };
      return await options.handler({
        request,
        requestId,
        locale,
        t,
        actor,
        json,
        fail,
        async parse(schema) {
          const parsed = schema.safeParse(await request.json().catch(() => null));
          if (parsed.success) return { ok: true, data: parsed.data };
          const issues = parsed.error.issues.map((i) => ({
            field: i.path.join('.') || 'body',
            reason: i.code,
          }));
          return { ok: false, response: fail({ kind: 'validation', issues }) };
        },
      });
    } catch (error) {
      logger().error(
        { requestId, err: error instanceof Error ? error.message : 'bilinmeyen' },
        'istek başarısız',
      );
      const mapped = internalError(requestId, t);
      return json(mapped.status, mapped.body);
    }
  };
}
