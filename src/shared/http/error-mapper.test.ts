import { describe, expect, it } from 'vitest';
import { businessRule, forbidden, notFound, validationError } from '@/shared/kernel/errors';
import { internalError, mapDomainError } from './error-mapper';

const t = (key: string) => `t:${key}`;

describe('hata eşleme (API_CONTRACTS §2.4)', () => {
  it.each([
    [validationError([{ field: 'title', reason: 'required' }]), 400, 'VALIDATION_FAILED'],
    [notFound(), 404, 'NOT_FOUND'],
    [forbidden(), 403, 'FORBIDDEN'],
    [{ kind: 'version_conflict' as const }, 409, 'VERSION_CONFLICT'],
    [businessRule('BR-PROJ-004'), 422, 'BUSINESS_RULE_VIOLATION'],
  ])('%o → %i %s', (error, status, code) => {
    const mapped = mapDomainError(error, 'req-1', t);
    expect(mapped.status).toBe(status);
    expect(mapped.body.error.code).toBe(code);
    expect(mapped.body.error.requestId).toBe('req-1');
  });

  it('iş kuralı ihlalinde kural kimliğini ve çevrilmiş mesajı döner', () => {
    const { body } = mapDomainError(businessRule('BR-PROJ-004'), 'r', t);
    expect(body.error.rule).toBe('BR-PROJ-004');
    expect(body.error.message).toBe('t:rules.BR-PROJ-004');
  });

  it('beklenmeyen hatada iç ayrıntı vermez', () => {
    const { status, body } = internalError('r', t);
    expect(status).toBe(500);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'message', 'requestId']);
  });
});
