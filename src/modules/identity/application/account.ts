import type { Clock } from '@/shared/kernel/clock';
import { businessRule, notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { validateEmail, validateName, validatePassword } from '../domain/credentials';

/** Oturumdaki aktör: kullanıcı ve isteği yapan oturum (ARCHITECTURE §7). */
export type AccountActor = { userId: string; sessionId: string };

export type SessionSummary = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  userAgent: string | null;
  current: boolean;
};

/** Hesap deposu portu. Her işlem aktörün kendi kayıtlarıyla sınırlıdır (BR-PERM-001). */
export type AccountStore = {
  findUser(userId: string): Promise<{ email: string; emailVerified: boolean } | null>;
  updateName(userId: string, name: string, now: Date): Promise<void>;
  listActiveSessions(userId: string, now: Date): Promise<Omit<SessionSummary, 'current'>[]>;
  /** Yalnızca kullanıcının kendi oturumunu siler; silinen yoksa false. */
  deleteSession(userId: string, sessionId: string): Promise<boolean>;
  deleteOtherSessions(userId: string, keepSessionId: string): Promise<number>;
};

/** Kimlik doğrulama kütüphanesinin şifre ve e-posta işlemleri; isteğin oturumuyla çalışır. */
export type Credentials = {
  verifyPassword(password: string): Promise<boolean>;
  /** BR-ACC-006: diğer tüm oturumları kapatarak şifreyi değiştirir. */
  changePassword(current: string, next: string): Promise<'changed' | 'incorrect'>;
  /** BR-ACC-004: yeni adrese doğrulama bağlantısı gönderir; doğrulanana kadar eski adres geçerlidir. */
  requestEmailChange(newEmail: string): Promise<void>;
};

export type AccountDeps = { store: AccountStore; clock: Clock };

/** FR-AUTH-07: ad değiştirme (1–100 karakter). */
export async function updateProfile(
  deps: AccountDeps,
  actor: AccountActor,
  command: { name: string },
): Promise<Result<{ name: string }, DomainError>> {
  const name = validateName(command.name);
  if (!name.ok) return err(validationError([name.error]));
  await deps.store.updateName(actor.userId, name.value, deps.clock.now());
  return ok({ name: name.value });
}

/** BR-ACC-002 + BR-ACC-006: mevcut şifre gerekir; yeni şifre politikaya uyar; diğer oturumlar kapanır. */
export async function changePassword(
  credentials: Credentials,
  command: { currentPassword: string; newPassword: string },
): Promise<Result<void, DomainError>> {
  const next = validatePassword(command.newPassword);
  if (!next.ok) return err(validationError([{ ...next.error, field: 'newPassword' }]));
  const outcome = await credentials.changePassword(command.currentPassword, next.value);
  if (outcome === 'incorrect') {
    return err(validationError([{ field: 'currentPassword', reason: 'incorrect' }]));
  }
  return ok(undefined);
}

/**
 * BR-ACC-004 / D-055: e-posta değiştirme doğrulanmış e-posta ve mevcut şifre ister. Yeni adres başka bir hesaba
 * aitse de aynı yanıt verilir (SECURITY §4.3); kütüphane o durumda e-posta göndermez.
 */
export async function requestEmailChange(
  deps: AccountDeps,
  credentials: Credentials,
  actor: AccountActor,
  command: { newEmail: string; currentPassword: string },
): Promise<Result<void, DomainError>> {
  const user = await deps.store.findUser(actor.userId);
  if (!user) return err(notFound());
  if (!user.emailVerified) return err(businessRule('BR-ACC-004'));

  const email = validateEmail(command.newEmail);
  if (!email.ok) return err(validationError([{ ...email.error, field: 'newEmail' }]));
  if (email.value === user.email) {
    return err(validationError([{ field: 'newEmail', reason: 'same' }]));
  }
  if (!(await credentials.verifyPassword(command.currentPassword))) {
    return err(validationError([{ field: 'currentPassword', reason: 'incorrect' }]));
  }
  await credentials.requestEmailChange(email.value);
  return ok(undefined);
}

/** FR-AUTH-06 / BR-ACC-006: süresi dolmamış oturumlar, en son kullanılan önce; isteği yapan oturum işaretlenir. */
export async function listSessions(
  deps: AccountDeps,
  actor: AccountActor,
): Promise<SessionSummary[]> {
  const sessions = await deps.store.listActiveSessions(actor.userId, deps.clock.now());
  return sessions
    .map((s) => ({ ...s, current: s.id === actor.sessionId }))
    .sort((a, b) => Number(b.current) - Number(a.current) || +b.lastSeenAt - +a.lastSeenAt);
}

/** BR-ACC-006: kullanıcı oturumlarını tek tek kapatabilir. Başka kullanıcının oturumu bulunamadı sayılır (BR-PERM-001). */
export async function revokeSession(
  deps: AccountDeps,
  actor: AccountActor,
  sessionId: string,
): Promise<Result<void, DomainError>> {
  const deleted = await deps.store.deleteSession(actor.userId, sessionId);
  return deleted ? ok(undefined) : err(notFound());
}

export async function revokeOtherSessions(deps: AccountDeps, actor: AccountActor): Promise<void> {
  await deps.store.deleteOtherSessions(actor.userId, actor.sessionId);
}
