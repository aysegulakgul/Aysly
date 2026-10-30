'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/client/api';
import type { NoteView } from '@/modules/notes';
import type { SearchHit } from '@/modules/search';
import { Button } from '@/ui/components/button';
import { Chip } from '@/ui/components/chip';
import { Banner } from '@/ui/components/feedback';
import { Popover, PopoverClose } from '@/ui/components/popover';
import { SafeMarkdown } from '@/ui/components/safe-markdown';
import { cn } from '@/ui/cn';
import { NoteEditor } from './note-editor';
import type { NoteProjectOption } from './note-types';

type Save = 'idle' | 'saving' | 'saved' | 'local' | 'failed';
const DEBOUNCE_MS = 1000; // BR-NOTE-001
const draftKey = (id: string | null) => `aysly:note-draft:${id ?? 'new'}`;
const noopSubscribe = () => () => {};
const stamped = (draft: Omit<Draft, 'at'>): Draft => ({ ...draft, at: Date.now() });

type Draft = { title: string; body: string; at: number };
function readDraft(id: string | null): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(id: string | null, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(id));
  } catch {
    // Tarayıcı depolaması kapalıysa yerel taslak tutulamaz; sunucu kaydı yine çalışır.
  }
}

/**
 * Not düzenleme paneli (Figma 4:67588 sağ panel). BR-NOTE-001: yazma durunca 1 sn sonra ve editörden çıkışta
 * kaydedilir; sunucu onayına kadar yerel taslak tutulur; kaydedilmemiş değişiklik varken sayfadan çıkışta uyarı.
 * BR-NOTE-002: başka yerde değiştirilmişse kullanıcının sürümü çatışma kopyası olur. BR-NOTE-004: boş not
 * oluşturulmaz; boşaltılan not silinir. Ağ yokken "Kaydedilemedi, yerel olarak saklandı"; bağlantı gelince
 * yeniden gönderilir (AC-08).
 */
export function NotePane({
  note,
  workspaceId,
  timezone,
  timeFormat,
  projects,
  onCreated,
}: {
  note: NoteView | null;
  workspaceId: string;
  timezone: string;
  timeFormat: '24h' | '12h';
  projects: NoteProjectOption[];
  onCreated: (id: string) => void;
}) {
  const t = useTranslations('notes');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const base = `/api/v1/workspaces/${workspaceId}/notes` as const;
  const [id, setId] = useState<string | null>(note?.id ?? null);
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [status, setStatus] = useState<Save>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(note?.updatedAt ?? null);
  const [conflict, setConflict] = useState(false);
  const [restored, setRestored] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [tags, setTags] = useState(() => note?.tags.map((tag) => tag.name) ?? []);
  const [tagInput, setTagInput] = useState('');
  const dirty = useRef(false);
  const idRef = useRef<string | null>(note?.id ?? null);
  const versionRef = useRef(note?.version ?? 0);
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const idempotency = useRef(crypto.randomUUID());
  const latest = useRef({ title, body });
  const archived = note?.archivedAt != null;
  const deleted = note?.deletedAt != null;

  // BR-NOTE-001: sunucudakinden yeni, kaydedilmemiş yerel taslak varsa kullanıcıya geri getirmesi önerilir.
  const pendingDraft = useSyncExternalStore(
    noopSubscribe,
    () => {
      const draft = readDraft(note?.id ?? null);
      if (!draft) return null;
      const serverAt = note ? Date.parse(note.updatedAt) : 0;
      const differs = draft.title !== (note?.title ?? '') || draft.body !== (note?.body ?? '');
      return draft.at > serverAt && differs ? JSON.stringify(draft) : null;
    },
    () => null,
  );
  function restoreDraft() {
    if (!pendingDraft) return;
    const draft = JSON.parse(pendingDraft) as Draft;
    latest.current = { title: draft.title, body: draft.body };
    setTitle(draft.title);
    setBody(draft.body);
    dirty.current = true;
    setIsDirty(true);
    setRestored(true);
    setEditorKey((k) => k + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
  }

  async function persist() {
    const id = idRef.current;
    const { title: t0, body: b0 } = latest.current;
    if (!id && !t0.trim() && !b0.trim()) return; // BR-NOTE-004
    setStatus('saving');
    const conflictLabel = `${t('conflictCopy')} – ${new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date())}`;
    const result = id
      ? await apiPatch<NoteView | null>(`${base}/${id}`, {
          version: versionRef.current,
          title: t0.trim() ? t0 : null,
          body: b0,
          conflictLabel,
        })
      : await apiPost<NoteView>(
          base,
          { title: t0.trim() ? t0 : null, body: b0 },
          {
            'Idempotency-Key': idempotency.current,
          },
        );
    if (!result.ok) {
      setStatus(result.status === 0 ? 'local' : 'failed');
      return;
    }
    const meta = result.meta as { outcome?: string } | undefined;
    dirty.current = latest.current.title !== t0 || latest.current.body !== b0;
    setIsDirty(dirty.current);
    writeDraft(id, dirty.current ? stamped(latest.current) : null);
    if (result.data === null) {
      // BR-NOTE-004: boşaltılan not silindi.
      router.replace(pathname as Route);
      router.refresh();
      return;
    }
    if (meta?.outcome === 'conflict_copy') setConflict(true);
    idRef.current = result.data.id;
    versionRef.current = result.data.version;
    setId(result.data.id);
    setSavedAt(result.data.updatedAt);
    setStatus(dirty.current ? 'idle' : 'saved');
    if (!id) onCreated(result.data.id);
    if (!id || meta?.outcome === 'conflict_copy') {
      router.replace(`${pathname}?note=${result.data.id}` as Route, { scroll: false });
    }
    router.refresh();
  }

  // Kayıtlar sırayla gider ve güncel kimlik/sürümü ref'lerden okur; aksi hâlde kullanıcının kendi
  // ardışık kayıtları aynı sürümle gidip sahte bir çatışma kopyası üretir (BR-NOTE-003).
  async function save() {
    clearTimeout(timer.current);
    while (saving.current) await saving.current;
    if (!dirty.current) return;
    const run = persist();
    saving.current = run;
    try {
      await run;
    } finally {
      saving.current = null;
    }
  }
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  async function saveTags(names: string[]) {
    const previous = tags;
    setTags(names);
    await save();
    while (saving.current) await saving.current;
    const id = idRef.current;
    if (!id) return;
    setStatus('saving');
    const run = apiPatch<NoteView>(`${base}/${id}`, {
      version: versionRef.current,
      tagNames: names,
    }).then((result) => {
      if (result.ok && result.data) {
        versionRef.current = result.data.version;
        setTags(result.data.tags.map((tag) => tag.name));
        setSavedAt(result.data.updatedAt);
        setStatus('saved');
      } else {
        setTags(previous);
        setStatus('failed');
      }
      router.refresh();
    });
    saving.current = run;
    try {
      await run;
    } finally {
      saving.current = null;
    }
  }

  function onTagKey(event: KeyboardEvent<HTMLInputElement>) {
    const name = tagInput.trim();
    if (event.key !== 'Enter' || !name) return;
    event.preventDefault();
    setTagInput('');
    if (!tags.includes(name)) void saveTags([...tags, name]);
  }

  function change(next: { title?: string; body?: string }) {
    // Düzenleyici açılışta içeriği değiştirmeden güncelleme bildirebilir; bu bir düzenleme değildir.
    const merged = { ...latest.current, ...next };
    if (merged.title === latest.current.title && merged.body === latest.current.body) return;
    latest.current = merged;
    if (next.title !== undefined) setTitle(next.title);
    if (next.body !== undefined) setBody(next.body);
    dirty.current = true;
    setIsDirty(true);
    writeDraft(id, stamped(latest.current));
    setStatus('idle');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
  }

  // Ağ geri gelince bekleyen değişiklik gönderilir; kaydedilmemişken çıkışta uyarı (BR-NOTE-001).
  useEffect(() => {
    const online = () => dirty.current && void saveRef.current();
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('beforeunload', leave);
    };
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function flag(path: 'archive' | 'unarchive') {
    await save();
    if (id) await apiPost(`${base}/${id}/${path}`, {});
    router.refresh();
  }
  async function pin(pinned: boolean) {
    if (!id) return;
    await save();
    const result = await apiPatch<NoteView>(`${base}/${id}`, {
      version: versionRef.current,
      pinned,
    });
    if (result.ok && result.data) versionRef.current = result.data.version;
    router.refresh();
  }
  async function remove() {
    if (!id) return;
    writeDraft(id, null);
    dirty.current = false;
    await apiDelete(`${base}/${id}`);
    router.replace(pathname as Route);
    router.refresh();
  }

  const time = savedAt
    ? new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: timeFormat === '12h' ? 'h12' : 'h23',
        timeZone: timezone,
      }).format(new Date(savedAt))
    : '';
  const statusText =
    status === 'saving'
      ? t('saving')
      : status === 'local'
        ? t('savedLocally')
        : status === 'failed'
          ? t('saveFailed')
          : savedAt && !isDirty
            ? t('savedAt', { time })
            : '';

  return (
    <section
      aria-label={t('editor')}
      className="flex min-w-0 flex-1 flex-col gap-4 rounded-md border border-border bg-surface p-5"
    >
      <div className="flex items-center gap-2">
        <Link href={pathname as Route} className="text-sm text-primary lg:hidden">
          ‹ {t('title')}
        </Link>
        <p
          role="status"
          aria-live="polite"
          data-save-status
          className={cn(
            'flex-1 text-xs',
            status === 'local' || status === 'failed' ? 'text-danger' : 'text-success',
          )}
        >
          {statusText ? `${status === 'saved' || status === 'idle' ? '✓ ' : ''}${statusText}` : ''}
        </p>
        {id && !deleted ? (
          <Popover
            label={t('more')}
            trigger={
              <button
                type="button"
                aria-label={t('more')}
                className="flex size-11 items-center justify-center rounded-md text-xl text-text-secondary"
              >
                ⋯
              </button>
            }
          >
            {archived ? (
              <PopoverClose asChild>
                <Button
                  variant="ghost"
                  className="justify-start px-2 text-sm"
                  onClick={() => void flag('unarchive')}
                >
                  {t('unarchive')}
                </Button>
              </PopoverClose>
            ) : (
              <>
                <PopoverClose asChild>
                  <Button
                    variant="ghost"
                    className="justify-start px-2 text-sm"
                    onClick={() => void pin(!note?.pinned)}
                  >
                    {note?.pinned ? t('unpin') : t('pin')}
                  </Button>
                </PopoverClose>
                <PopoverClose asChild>
                  <Button
                    variant="ghost"
                    className="justify-start px-2 text-sm"
                    onClick={() => void flag('archive')}
                  >
                    {t('archive')}
                  </Button>
                </PopoverClose>
              </>
            )}
            <PopoverClose asChild>
              <Button
                variant="ghost"
                className="justify-start px-2 text-sm text-danger"
                onClick={() => void remove()}
              >
                {t('delete')}
              </Button>
            </PopoverClose>
          </Popover>
        ) : null}
      </div>
      {restored ? <Banner>{t('draftRestored')}</Banner> : null}
      {pendingDraft && !isDirty && !restored && !archived && !deleted ? (
        <Banner>
          <span className="flex flex-wrap items-center gap-3">
            {t('draftFound')}
            <Button variant="secondary" onClick={restoreDraft}>
              {t('restoreDraft')}
            </Button>
          </span>
        </Banner>
      ) : null}
      {conflict ? <Banner>{t('conflictBanner')}</Banner> : null}
      {archived ? <Banner>{t('archivedBand')}</Banner> : null}
      {deleted ? <Banner>{t('deletedBand')}</Banner> : null}
      <input
        aria-label={t('noteTitle')}
        value={title}
        placeholder={t('titlePlaceholder')}
        maxLength={200}
        readOnly={archived || deleted}
        onChange={(e) => change({ title: e.target.value })}
        onBlur={() => void save()}
        className="w-full bg-transparent text-2xl font-semibold text-text placeholder:text-text-secondary focus:outline-none"
      />
      {note ? (
        <div className="flex flex-wrap items-center gap-2">
          {note.pinned ? <Chip tone="progress">{t('pinnedChip')}</Chip> : null}
          {archived || deleted ? (
            note.tags.map((tag) => <Chip key={tag.id}>#{tag.name}</Chip>)
          ) : (
            // FR-NOTE-05: etiketler görev detayındaki gibi düzenlenir.
            <>
              {tags.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-label={t('removeTag', { tag: name })}
                  onClick={() => void saveTags(tags.filter((x) => x !== name))}
                >
                  <Chip>{`#${name} ×`}</Chip>
                </button>
              ))}
              <input
                aria-label={t('tags')}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKey}
                placeholder={t('tagsPlaceholder')}
                className="min-h-9 min-w-[140px] flex-1 bg-transparent text-sm text-text placeholder:text-text-secondary"
              />
            </>
          )}
        </div>
      ) : null}
      <div className="border-t border-border pt-4">
        {archived || deleted ? (
          // BR-DEL-002: arşivdeki/çöpteki not salt okunur; içerik güvenli Markdown görüntüleyiciyle (SECURITY §5).
          <SafeMarkdown>{body}</SafeMarkdown>
        ) : (
          <NoteEditor
            key={editorKey}
            markdown={body}
            label={t('body')}
            onChange={(markdown) => change({ body: markdown })}
            onBlur={() => void save()}
          />
        )}
      </div>
      {id && note ? (
        <NoteLinks
          note={note}
          workspaceId={workspaceId}
          projects={projects}
          readOnly={archived || deleted}
        />
      ) : null}
    </section>
  );
}

/** BR-NOTE-003 / FR-NOTE-04: "Bağlı kayıtlar" (Figma 4:67588). Görev arama ile, proje listeden seçilir. */
function NoteLinks({
  note,
  workspaceId,
  projects,
  readOnly,
}: {
  note: NoteView;
  workspaceId: string;
  projects: NoteProjectOption[];
  readOnly: boolean;
}) {
  const t = useTranslations('notes');
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [failed, setFailed] = useState(false);
  const url = `/api/v1/workspaces/${workspaceId}/notes/${note.id}/links` as const;
  const current = {
    taskIds: note.links.tasks.map((x) => x.id),
    projectIds: note.links.projects.map((x) => x.id),
  };

  async function put(next: { taskIds: string[]; projectIds: string[] }) {
    setFailed(false);
    const result = await apiPut(url, next);
    if (!result.ok) setFailed(true);
    router.refresh();
  }
  async function find(value: string) {
    setQ(value);
    if (value.trim().length < 2) return setHits([]);
    const result = await apiGet<SearchHit[]>(
      `/api/v1/search?types=task&q=${encodeURIComponent(value.trim())}`,
    );
    setHits(result.ok ? result.data : []);
  }

  return (
    <section
      aria-labelledby="note-links"
      className="flex flex-col gap-2 border-t border-border pt-4"
    >
      <h3
        id="note-links"
        className="text-xs font-medium tracking-wide text-text-secondary uppercase"
      >
        {t('links')}
      </h3>
      {failed ? <Banner>{t('linkFailed')}</Banner> : null}
      <ul className="flex flex-col gap-1">
        {note.links.projects.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <Link href={`/projects/${p.id}` as Route} className="flex-1 text-primary">
              ▭ {p.name}
            </Link>
            {readOnly ? null : (
              <Button
                variant="ghost"
                className="px-2 text-sm"
                aria-label={t('unlink', { name: p.name })}
                onClick={() =>
                  void put({ ...current, projectIds: current.projectIds.filter((x) => x !== p.id) })
                }
              >
                ✕
              </Button>
            )}
          </li>
        ))}
        {note.links.tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 text-sm">
            <Link href={`/my-tasks?task=${task.id}` as Route} className="flex-1 text-primary">
              {task.status === 'done' ? '✓' : task.status === 'in_progress' ? '◐' : '○'}{' '}
              {task.title}
            </Link>
            {readOnly ? null : (
              <Button
                variant="ghost"
                className="px-2 text-sm"
                aria-label={t('unlink', { name: task.title })}
                onClick={() =>
                  void put({ ...current, taskIds: current.taskIds.filter((x) => x !== task.id) })
                }
              >
                ✕
              </Button>
            )}
          </li>
        ))}
      </ul>
      {readOnly ? null : (
        <Popover
          label={t('addLink')}
          className="w-[min(340px,calc(100vw-32px))]"
          trigger={
            <Button variant="ghost" className="self-start" data-add-link>
              + {t('addLink')}
            </Button>
          }
        >
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            {t('linkTask')}
            <input
              value={q}
              onChange={(e) => void find(e.target.value)}
              onKeyDown={(e: KeyboardEvent) => e.key === 'Escape' && setQ('')}
              className="min-h-11 rounded-sm border border-border bg-page px-3 text-base text-text"
            />
          </label>
          <ul className="flex flex-col">
            {hits
              .filter((h) => !current.taskIds.includes(h.id))
              .map((h) => (
                <li key={h.id}>
                  <PopoverClose asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-2 text-sm"
                      onClick={() => void put({ ...current, taskIds: [...current.taskIds, h.id] })}
                    >
                      ○ {h.title}
                      {h.context ? (
                        <span className="text-xs text-text-secondary"> · {h.context}</span>
                      ) : null}
                    </Button>
                  </PopoverClose>
                </li>
              ))}
          </ul>
          <p className="text-sm text-text-secondary">{t('linkProject')}</p>
          <ul className="flex flex-col">
            {projects
              .filter((p) => p.kind === 'standard' && !current.projectIds.includes(p.id))
              .map((p) => (
                <li key={p.id}>
                  <PopoverClose asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-2 text-sm"
                      onClick={() =>
                        void put({ ...current, projectIds: [...current.projectIds, p.id] })
                      }
                    >
                      ▭ {p.name}
                    </Button>
                  </PopoverClose>
                </li>
              ))}
          </ul>
        </Popover>
      )}
    </section>
  );
}
