import { err, ok, type Result } from '@/shared/kernel/result';
import type { FieldIssue } from '@/shared/kernel/errors';
import { COMMON_PASSWORDS } from './common-passwords';

/**
 * BR-ACC-001: E-posta kırpılır ve yerel ayardan bağımsız küçük harfe çevrilir.
 * Türkçe yerel ayarda "I".toLowerCase() → "ı" sorununu önlemek için `toLocaleLowerCase('en-US')` kullanılır.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLocaleLowerCase('en-US');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(raw: string): Result<string, FieldIssue> {
  const email = normalizeEmail(raw);
  if (email.length > 254 || !EMAIL_RE.test(email))
    return err({ field: 'email', reason: 'invalid' });
  return ok(email);
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** BR-ACC-002: 10–128 karakter, karakter türü zorunluluğu yok, sık kullanılan şifreler reddedilir. */
export function validatePassword(password: string): Result<string, FieldIssue> {
  if (password.length < PASSWORD_MIN) return err({ field: 'password', reason: 'too_short' });
  if (password.length > PASSWORD_MAX) return err({ field: 'password', reason: 'too_long' });
  if (COMMON_PASSWORDS.has(password.toLocaleLowerCase('en-US'))) {
    return err({ field: 'password', reason: 'too_common' });
  }
  return ok(password);
}

/** Kullanıcı adı 1–100 karakter (DATA_MODEL §3.1). */
export function validateName(raw: string): Result<string, FieldIssue> {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1) return err({ field: 'name', reason: 'required' });
  if (name.length > 100) return err({ field: 'name', reason: 'too_long' });
  return ok(name);
}
