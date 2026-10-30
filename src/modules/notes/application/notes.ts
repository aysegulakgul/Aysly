import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { Clock } from '@/shared/kernel/clock';
import { businessRule, notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import {
  LINKS_PER_NOTE,
  checkNote,
  isEmptyNote,
  normalizeNoteTitle,
  type Note,
} from '../domain/note';

export type NoteChanges = Partial<{
  title: string | null;
  body: string;
  pinnedAt: Date | null;
  archivedAt: Date | null;
}>;

export type NoteListFilter = {
  q?: string | undefined;
  tagId?: string | undefined;
  includeArchived?: boolean | undefined;
  linkedTaskId?: string | undefined;
  linkedProjectId?: string | undefined;
};

export type NoteLinks = { taskIds: string[]; projectIds: string[] };

/** Not deposu; her metot `WorkspaceScope` ister. Çöpteki notlar yalnızca `findAny`/`listTrashed` ile. */
export type NoteRepository = {
  insert(
    scope: WorkspaceScope,
    n: { id: string; title: string | null; body: string; now: Date },
  ): Promise<Note>;
  findById(scope: WorkspaceScope, id: string): Promise<Note | null>;
  findAny(scope: WorkspaceScope, id: string): Promise<Note | null>;
  update(
    scope: WorkspaceScope,
    id: string,
    expectedVersion: number | null,
    changes: NoteChanges,
    now: Date,
  ): Promise<Note | null>;
  list(scope: WorkspaceScope, filter: NoteListFilter): Promise<Note[]>;
  trash(scope: WorkspaceScope, id: string, batchId: string, now: Date): Promise<boolean>;
  restore(scope: WorkspaceScope, id: string, now: Date): Promise<boolean>;
  listTrashed(scope: WorkspaceScope): Promise<Note[]>;
  /** BR-DEL-005; `id` verilmezse tüm çöp. */
  purge(scope: WorkspaceScope, id: string | null): Promise<number>;
  hardDelete(scope: WorkspaceScope, id: string): Promise<void>;
  links(scope: WorkspaceScope, noteIds: readonly string[]): Promise<Map<string, NoteLinks>>;
  setLinks(scope: WorkspaceScope, noteId: string, links: NoteLinks, now: Date): Promise<void>;
};

export type NoteDeps = {
  notes: NoteRepository;
  tags: {
    replace(scope: WorkspaceScope, noteId: string, names: readonly string[]): Promise<void>;
  };
  /** BR-WS-002: bağlanacak görev ve projeler aynı alanda, çöpte değil. */
  targets: {
    validTasks(scope: WorkspaceScope, ids: readonly string[]): Promise<Set<string>>;
    validProjects(scope: WorkspaceScope, ids: readonly string[]): Promise<Set<string>>;
  };
  clock: Clock;
  newId: () => string;
};

/** BR-DEL-002: arşivlenmiş not salt okunurdur. */
const guard = (note: Note) => (note.archivedAt ? businessRule('BR-DEL-002') : null);

/** FR-NOTE-01, BR-NOTE-004: boş not oluşturulmaz. */
export async function createNote(
  deps: NoteDeps,
  scope: WorkspaceScope,
  command: {
    title?: string | null | undefined;
    body?: string | undefined;
    tagNames?: readonly string[] | undefined;
    links?: NoteLinks | undefined;
  },
): Promise<Result<Note, DomainError>> {
  const allowed = authorize(scope, 'note.create');
  if (!allowed.ok) return allowed;
  const title = normalizeNoteTitle(command.title);
  const body = command.body ?? '';
  const issues = checkNote(title, body);
  if (isEmptyNote(title, body)) issues.push({ field: 'body', reason: 'required' });
  if (issues.length) return err(validationError(issues));
  const now = deps.clock.now();
  const note = await deps.notes.insert(scope, { id: deps.newId(), title, body, now });
  if (command.tagNames?.length) await deps.tags.replace(scope, note.id, command.tagNames);
  if (command.links) {
    const linked = await applyLinks(deps, scope, note.id, command.links);
    if (!linked.ok) return linked;
  }
  return ok(note);
}

export type NoteUpdateOutcome =
  | { kind: 'saved'; note: Note }
  /** BR-NOTE-004: boş bırakılan not kalıcı silindi. */
  | { kind: 'deleted' }
  /** BR-NOTE-002: çatışmada kullanıcının sürümü yeni not olarak kaydedildi. */
  | { kind: 'conflict_copy'; note: Note; current: Note };

/**
 * Otomatik kayıt (BR-NOTE-001/002/004). Sürüm uyuşmazsa kullanıcının içeriği kaybolmaz: "Başlık (çatışma kopyası –
 * <zaman>)" adıyla yeni not oluşturulur. Başlık ve gövde boşalırsa not kalıcı silinir.
 */
export async function updateNote(
  deps: NoteDeps,
  scope: WorkspaceScope,
  id: string,
  command: {
    version: number;
    title?: string | null | undefined;
    body?: string | undefined;
    tagNames?: readonly string[] | undefined;
    /** Çatışma kopyasının başlık eki (kullanıcının dili ve saat diliminde). */
    conflictLabel: string;
    fallbackTitle: string;
  },
): Promise<Result<NoteUpdateOutcome, DomainError>> {
  const allowed = authorize(scope, 'note.update');
  if (!allowed.ok) return allowed;
  const current = await deps.notes.findById(scope, id);
  if (!current) return err(notFound());
  const blocked = guard(current);
  if (blocked) return err(blocked);

  const title = command.title !== undefined ? normalizeNoteTitle(command.title) : current.title;
  const body = command.body ?? current.body;
  const issues = checkNote(title, body);
  if (issues.length) return err(validationError(issues));
  const now = deps.clock.now();

  if (current.version !== command.version) {
    const base = title ?? command.fallbackTitle;
    const copyTitle = `${base} (${command.conflictLabel})`.slice(0, 200);
    if (isEmptyNote(title, body)) return ok({ kind: 'saved', note: current });
    const copy = await deps.notes.insert(scope, {
      id: deps.newId(),
      title: copyTitle,
      body,
      now,
    });
    return ok({ kind: 'conflict_copy', note: copy, current });
  }
  if (isEmptyNote(title, body)) {
    await deps.notes.hardDelete(scope, id);
    return ok({ kind: 'deleted' });
  }
  const saved = await deps.notes.update(scope, id, command.version, { title, body }, now);
  if (!saved) return err({ kind: 'version_conflict', current });
  if (command.tagNames !== undefined) await deps.tags.replace(scope, id, command.tagNames);
  return ok({ kind: 'saved', note: saved });
}

async function applyLinks(
  deps: NoteDeps,
  scope: WorkspaceScope,
  noteId: string,
  links: NoteLinks,
): Promise<Result<null, DomainError>> {
  const taskIds = [...new Set(links.taskIds)];
  const projectIds = [...new Set(links.projectIds)];
  if (taskIds.length + projectIds.length > LINKS_PER_NOTE) {
    return err(validationError([{ field: 'links', reason: 'too_many' }]));
  }
  const [tasks, projects] = await Promise.all([
    deps.targets.validTasks(scope, taskIds),
    deps.targets.validProjects(scope, projectIds),
  ]);
  if (tasks.size < taskIds.length || projects.size < projectIds.length) return err(notFound());
  await deps.notes.setLinks(scope, noteId, { taskIds, projectIds }, deps.clock.now());
  return ok(null);
}

/** FR-NOTE-04, BR-NOTE-003: notun görev ve proje bağlantılarını değiştirir. */
export async function setNoteLinks(
  deps: NoteDeps,
  scope: WorkspaceScope,
  id: string,
  links: NoteLinks,
): Promise<Result<null, DomainError>> {
  const allowed = authorize(scope, 'note.update');
  if (!allowed.ok) return allowed;
  const note = await deps.notes.findById(scope, id);
  if (!note) return err(notFound());
  const blocked = guard(note);
  if (blocked) return err(blocked);
  return applyLinks(deps, scope, id, links);
}

/** FR-NOTE-05: sabitleme, arşivleme (sürüm kontrolsüz; içerik değişmez). */
export async function setNoteFlags(
  deps: NoteDeps,
  scope: WorkspaceScope,
  id: string,
  flags: { pinned?: boolean | undefined; archived?: boolean | undefined },
): Promise<Result<Note, DomainError>> {
  const allowed = authorize(scope, flags.archived === undefined ? 'note.update' : 'note.archive');
  if (!allowed.ok) return allowed;
  const note = await deps.notes.findById(scope, id);
  if (!note) return err(notFound());
  const now = deps.clock.now();
  const changes: NoteChanges = {};
  if (flags.pinned !== undefined) {
    if (note.archivedAt) return err(businessRule('BR-DEL-002'));
    changes.pinnedAt = flags.pinned ? now : null;
  }
  if (flags.archived !== undefined) changes.archivedAt = flags.archived ? now : null;
  return ok((await deps.notes.update(scope, id, null, changes, now))!);
}

/** BR-DEL-001/006: not çöpe tek başına bir grup olarak gider; bağlantıları korunur, kayıt gizlenir. */
export async function deleteNote(
  deps: NoteDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<{ batchId: string }, DomainError>> {
  const allowed = authorize(scope, 'note.delete');
  if (!allowed.ok) return allowed;
  const batchId = deps.newId();
  return (await deps.notes.trash(scope, id, batchId, deps.clock.now()))
    ? ok({ batchId })
    : err(notFound());
}

export async function restoreNote(
  deps: NoteDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<null, DomainError>> {
  const allowed = authorize(scope, 'note.delete');
  if (!allowed.ok) return allowed;
  return (await deps.notes.restore(scope, id, deps.clock.now())) ? ok(null) : err(notFound());
}

export async function getNote(
  deps: NoteDeps,
  scope: WorkspaceScope,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Result<Note, DomainError>> {
  const allowed = authorize(scope, 'note.read');
  if (!allowed.ok) return allowed;
  const note = options.includeDeleted
    ? await deps.notes.findAny(scope, id)
    : await deps.notes.findById(scope, id);
  return note ? ok(note) : err(notFound());
}

/** Not listesi: sabitlenenler üstte, sonra son düzenleme (USER_FLOWS §2.10). */
export async function listNotes(
  deps: NoteDeps,
  scope: WorkspaceScope,
  filter: NoteListFilter,
): Promise<Result<Note[], DomainError>> {
  const allowed = authorize(scope, 'note.read');
  if (!allowed.ok) return allowed;
  return ok(await deps.notes.list(scope, filter));
}
