import type { Clock } from '@/shared/kernel/clock';
import { validationError, type DomainError, type FieldIssue } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { defaultPreferences, type Locale, type PreferenceDefaults } from '@/modules/preferences';
import { validateEmail, validateName, validatePassword } from '../domain/credentials';

/** Kayıt sırasında tek işlemde yazılan her şey (BR-WS-001, BR-PREF-001, D-030). */
export type NewPersonalAccount = {
  userId: string;
  accountId: string;
  workspaceId: string;
  membershipId: string;
  inboxProjectId: string;
  auditEventId: string;
  name: string;
  email: string;
  passwordHash: string;
  workspaceName: string;
  preferences: PreferenceDefaults;
  now: Date;
};

export interface RegistrationStore {
  /** Hepsini tek veritabanı işleminde yazar; e-posta zaten varsa hiçbir şey yazmaz. */
  createPersonalAccount(account: NewPersonalAccount): Promise<'created' | 'email_taken'>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export type RegisterUserDeps = {
  store: RegistrationStore;
  hasher: PasswordHasher;
  clock: Clock;
  newId: () => string;
};

export type RegisterUserCommand = {
  name: string;
  email: string;
  password: string;
  locale: Locale;
  timezone?: string | undefined;
};

export type RegisterUserResult = { userId: string; workspaceId: string; email: string };

const PERSONAL_WORKSPACE_NAME: Record<Locale, string> = { tr: 'Kişisel', en: 'Personal' };

export async function registerUser(
  deps: RegisterUserDeps,
  command: RegisterUserCommand,
): Promise<Result<RegisterUserResult, DomainError>> {
  const issues: FieldIssue[] = [];
  const name = validateName(command.name);
  const email = validateEmail(command.email); // BR-ACC-001
  const password = validatePassword(command.password); // BR-ACC-002
  for (const r of [name, email, password]) if (!r.ok) issues.push(r.error);
  if (!name.ok || !email.ok || !password.ok) return err(validationError(issues));

  const account: NewPersonalAccount = {
    userId: deps.newId(),
    accountId: deps.newId(),
    workspaceId: deps.newId(),
    membershipId: deps.newId(),
    inboxProjectId: deps.newId(),
    auditEventId: deps.newId(),
    name: name.value,
    email: email.value,
    passwordHash: await deps.hasher.hash(password.value),
    workspaceName: PERSONAL_WORKSPACE_NAME[command.locale],
    preferences: defaultPreferences({ locale: command.locale, timezone: command.timezone }), // BR-PREF-001
    now: deps.clock.now(),
  };

  // BR-WS-001: kullanıcı, kişisel çalışma alanı, sahip üyeliği, Inbox ve tercihler tek işlemde.
  const outcome = await deps.store.createPersonalAccount(account);
  if (outcome === 'email_taken') {
    // BR-ACC-001: aynı e-postayla ikinci hesap oluşturulmaz.
    return err({ kind: 'business_rule', rule: 'BR-ACC-001' });
  }
  return ok({ userId: account.userId, workspaceId: account.workspaceId, email: account.email });
}
