import type { DomainError } from '@/shared/kernel/errors';

/**
 * DomainError → HTTP yanıtı eşlemesi tek yerde (ARCHITECTURE §8, API_CONTRACTS §2.4).
 * `message` alanı kullanıcı diline çevrilmiş güvenli metindir; iç ayrıntı içermez.
 */
export type ErrorBody = {
  error: {
    code: string;
    message: string;
    rule?: string;
    details?: { field: string; reason: string }[];
    current?: unknown;
    requestId: string;
  };
};

export type Translate = (key: string) => string;

export function mapDomainError(
  error: DomainError,
  requestId: string,
  t: Translate,
): { status: number; body: ErrorBody } {
  switch (error.kind) {
    case 'validation':
      return {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: t('errors.validation'),
            details: error.issues,
            requestId,
          },
        },
      };
    case 'not_found':
      return {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: t('errors.notFound'), requestId } },
      };
    case 'forbidden':
      return {
        status: 403,
        body: { error: { code: 'FORBIDDEN', message: t('errors.forbidden'), requestId } },
      };
    case 'version_conflict':
      return {
        status: 409,
        body: {
          error: {
            code: 'VERSION_CONFLICT',
            message: t('errors.versionConflict'),
            current: error.current,
            requestId,
          },
        },
      };
    case 'business_rule':
      return {
        status: 422,
        body: {
          error: {
            code: 'BUSINESS_RULE_VIOLATION',
            message: t(`rules.${error.rule}`),
            rule: error.rule,
            ...(error.details ? { details: error.details } : {}),
            requestId,
          },
        },
      };
  }
}

export function internalError(
  requestId: string,
  t: Translate,
): { status: number; body: ErrorBody } {
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: t('errors.internal'), requestId } },
  };
}
