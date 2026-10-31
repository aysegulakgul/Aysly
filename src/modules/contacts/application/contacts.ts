import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { Clock } from '@/shared/kernel/clock';
import {
  notFound,
  validationError,
  type DomainError,
  type FieldIssue,
} from '@/shared/kernel/errors';
import { isUuid } from '@/shared/kernel/id';
import { err, ok, type Result } from '@/shared/kernel/result';
import {
  normalizeContactEmail,
  normalizeContactName,
  type Contact,
  type ContactColor,
} from '../domain/contact';

/** BR-CONTACT-001: çalışma alanında en çok 200 kişi. */
export const CONTACTS_PER_WORKSPACE = 200;

export type ContactStore = {
  list(scope: WorkspaceScope): Promise<Contact[]>;
  count(scope: WorkspaceScope): Promise<number>;
  insert(
    scope: WorkspaceScope,
    contact: { id: string; name: string; email: string | null; color: ContactColor; now: Date },
  ): Promise<Contact>;
  update(
    scope: WorkspaceScope,
    id: string,
    changes: Partial<{ name: string; email: string | null; color: ContactColor }>,
    now: Date,
  ): Promise<Contact | null>;
  remove(scope: WorkspaceScope, id: string): Promise<boolean>;
};

export type ContactDeps = { contacts: ContactStore; clock: Clock; newId: () => string };

export async function listContacts(
  deps: ContactDeps,
  scope: WorkspaceScope,
): Promise<Result<Contact[], DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  return ok(await deps.contacts.list(scope));
}

/** D-097 / BR-CONTACT-001: ad zorunlu, e-posta isteğe bağlı. */
export async function createContact(
  deps: ContactDeps,
  scope: WorkspaceScope,
  command: { name: string; email?: string | null | undefined; color?: ContactColor | undefined },
): Promise<Result<Contact, DomainError>> {
  const allowed = authorize(scope, 'contact.manage');
  if (!allowed.ok) return allowed;
  const name = normalizeContactName(command.name);
  const email = normalizeContactEmail(command.email);
  const issues: FieldIssue[] = [];
  if (!name.ok) issues.push(name.error);
  if (!email.ok) issues.push(email.error);
  if (!name.ok || !email.ok) return err(validationError(issues));
  if ((await deps.contacts.count(scope)) >= CONTACTS_PER_WORKSPACE) {
    return err(validationError([{ field: 'name', reason: 'limit_reached' }]));
  }
  return ok(
    await deps.contacts.insert(scope, {
      id: deps.newId(),
      name: name.value,
      email: email.value,
      color: command.color ?? 'blue',
      now: deps.clock.now(),
    }),
  );
}

export async function updateContact(
  deps: ContactDeps,
  scope: WorkspaceScope,
  id: string,
  command: {
    name?: string | undefined;
    email?: string | null | undefined;
    color?: ContactColor | undefined;
  },
): Promise<Result<Contact, DomainError>> {
  const allowed = authorize(scope, 'contact.manage');
  if (!allowed.ok) return allowed;
  if (!isUuid(id)) return err(notFound());
  const changes: Partial<{ name: string; email: string | null; color: ContactColor }> = {};
  const issues: FieldIssue[] = [];
  if (command.name !== undefined) {
    const name = normalizeContactName(command.name);
    if (name.ok) changes.name = name.value;
    else issues.push(name.error);
  }
  if (command.email !== undefined) {
    const email = normalizeContactEmail(command.email);
    if (email.ok) changes.email = email.value;
    else issues.push(email.error);
  }
  if (command.color !== undefined) changes.color = command.color;
  if (issues.length) return err(validationError(issues));
  const updated = await deps.contacts.update(scope, id, changes, deps.clock.now());
  return updated ? ok(updated) : err(notFound());
}

/** D-097: kişi silinince atandığı görevlerde atama boşalır (veritabanında ON DELETE SET NULL). */
export async function deleteContact(
  deps: ContactDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<void, DomainError>> {
  const allowed = authorize(scope, 'contact.manage');
  if (!allowed.ok) return allowed;
  if (!isUuid(id)) return err(notFound());
  return (await deps.contacts.remove(scope, id)) ? ok(undefined) : err(notFound());
}
