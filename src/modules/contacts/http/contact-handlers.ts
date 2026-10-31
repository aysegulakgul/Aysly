import { z } from 'zod';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { systemClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
  type ContactDeps,
} from '../application/contacts';
import { CONTACT_COLORS, type Contact } from '../domain/contact';
import { createContactStore } from '../infrastructure/contact-store';

const CreateBody = z.strictObject({
  name: z.string().max(1000),
  email: z.string().max(1000).nullable().optional(),
  color: z.enum(CONTACT_COLORS).optional(),
});
const PatchBody = CreateBody.partial();

const deps = (executor: DbExecutor): ContactDeps => ({
  contacts: createContactStore(executor),
  clock: systemClock,
  newId: uuidv7,
});

const toJson = (c: Contact) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  color: c.color,
  createdAt: c.createdAt.toISOString(),
});

async function withScope(ctx: ApiContext, handle: (scope: WorkspaceScope) => Promise<Response>) {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

/** GET /workspaces/{ws}/contacts (D-097): ada göre sıralı. */
export const getContacts = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await listContacts(deps(db()), scope);
    return result.ok ? ctx.json(200, { data: result.value.map(toJson) }) : ctx.fail(result.error);
  });

/** POST /workspaces/{ws}/contacts (BR-CONTACT-001). */
export const postContact = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CreateBody);
    if (!body.ok) return body.response;
    const result = await createContact(deps(db()), scope, body.data);
    return result.ok ? ctx.json(201, { data: toJson(result.value) }) : ctx.fail(result.error);
  });

/** PATCH /workspaces/{ws}/contacts/{id}. */
export const patchContact = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(PatchBody);
    if (!body.ok) return body.response;
    const result = await updateContact(deps(db()), scope, ctx.params.id ?? '', body.data);
    return result.ok ? ctx.json(200, { data: toJson(result.value) }) : ctx.fail(result.error);
  });

/** DELETE /workspaces/{ws}/contacts/{id}: atandığı görevlerde atama boşalır. */
export const deleteOneContact = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await deleteContact(deps(db()), scope, ctx.params.id ?? '');
    return result.ok ? new Response(null, { status: 204 }) : ctx.fail(result.error);
  });

/** Sayfalar (sunucu bileşeni) için kişi listesi; uç noktayla aynı use case. */
export async function findContacts(scope: WorkspaceScope) {
  const result = await listContacts(deps(db()), scope);
  return result.ok ? result.value.map(toJson) : [];
}
export type ContactView = ReturnType<typeof toJson>;
