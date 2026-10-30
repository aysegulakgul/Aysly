'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { apiGet, apiPost } from '@/client/api';
import type { SearchHit, SearchType } from '@/modules/search';
import { cn } from '@/ui/cn';

const RECENT_KEY = 'aysly:recent-searches';
const ORDER: SearchType[] = ['task', 'project', 'note', 'goal'];
const GLYPH: Record<SearchType, string> = { task: '○', project: '▭', note: '≡', goal: '◎' };

const PaletteContext = createContext<{ open: () => void }>({ open: () => {} });
export const useSearchPalette = () => useContext(PaletteContext);

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  try {
    const next = [q, ...readRecent().filter((x) => x !== q)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Yerel depolama kapalıysa son aramalar tutulmaz.
  }
}

export function hrefFor(hit: Pick<SearchHit, 'type' | 'id'>): Route {
  switch (hit.type) {
    case 'task':
      return `/my-tasks?task=${hit.id}` as Route;
    case 'project':
      return `/projects/${hit.id}` as Route;
    case 'note':
      return `/notes?note=${hit.id}` as Route;
    case 'goal':
      return `/goals?goal=${hit.id}` as Route;
  }
}

/**
 * Global arama / komut paleti (Figma 4:69442; FR-SRCH-01..04, BR-SRCH-001/002). `Ctrl/⌘+K` ile açılır; türe göre
 * gruplu sonuçlar, ↑/↓ ile gezinme, Enter ile açma, "Arşivi dahil et", son aramalar (yerel) ve hızlı komutlar.
 * Boş sonuçta öneriler ve "Bu başlıkla görev oluştur" (FR-SRCH-03).
 */
export function SearchPaletteProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const t = useTranslations('search');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const request = useRef(0);

  const show = useCallback(() => {
    setRecent(readRecent());
    setOpen(true);
  }, []);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return;
    const id = ++request.current;
    const timer = setTimeout(async () => {
      const result = await apiGet<SearchHit[]>(
        `/api/v1/search?q=${encodeURIComponent(text)}${includeArchived ? '&includeArchived=true' : ''}`,
      );
      if (id !== request.current) return;
      setHits(result.ok ? result.data : []);
      setActive(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, includeArchived]);

  // Kısa sorguda sonuç gösterilmez (BR-SRCH-002: en az 2 karakter).
  const shownHits = q.trim().length < 2 ? null : hits;
  const ordered = (shownHits ?? [])
    .slice()
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const go = (href: Route) => {
    if (q.trim().length >= 2) pushRecent(q.trim());
    setOpen(false);
    setQ('');
    router.push(href);
  };
  async function createTask() {
    const result = await apiPost<{ id: string }>(
      `/api/v1/workspaces/${workspaceId}/tasks`,
      { title: q.trim() },
      { 'idempotency-key': crypto.randomUUID() },
    );
    if (result.ok) go(`/inbox?task=${result.data.id}` as Route);
  }
  function onKeyDown(e: KeyboardEvent) {
    if (!ordered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % ordered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + ordered.length) % ordered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = ordered[active];
      if (hit) go(hrefFor(hit));
    }
  }

  const option = 'flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-sm';
  return (
    <PaletteContext.Provider value={{ open: show }}>
      {children}
      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <RadixDialog.Content
            data-search-palette
            className="fixed top-[10vh] left-1/2 z-50 flex max-h-[80vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-3 overflow-y-auto rounded-md border border-border bg-surface p-5 text-text"
          >
            <RadixDialog.Title className="text-lg font-semibold">{t('title')}</RadixDialog.Title>
            <RadixDialog.Description className="text-sm text-text-secondary">
              {t('description')}
            </RadixDialog.Description>
            <label className="flex flex-col gap-2 text-sm text-text-secondary">
              {t('label')}
              <input
                autoFocus
                role="combobox"
                aria-expanded={ordered.length > 0}
                aria-controls="search-results"
                aria-activedescendant={ordered[active] ? `hit-${ordered[active]!.id}` : undefined}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={200}
                className="min-h-11 rounded-sm border border-border bg-page p-3 text-base text-text"
              />
            </label>
            <button
              type="button"
              aria-pressed={includeArchived}
              onClick={() => setIncludeArchived((v) => !v)}
              className="self-start rounded-sm border border-border bg-surface-muted px-2 py-1 text-xs text-text-secondary"
            >
              {t(includeArchived ? 'archivedOn' : 'archivedOff')}
            </button>
            <div id="search-results" role="listbox" aria-label={t('results')}>
              {shownHits !== null && ordered.length === 0 ? (
                <div className="flex flex-col gap-2 py-2" data-search-empty>
                  <p className="text-sm text-text">{t('empty', { q: q.trim() })}</p>
                  <ul className="list-disc pl-5 text-sm text-text-secondary">
                    <li>{t('tipSpelling')}</li>
                    {includeArchived ? null : <li>{t('tipArchive')}</li>}
                  </ul>
                  <button
                    type="button"
                    className={cn(option, 'text-primary')}
                    onClick={() => void createTask()}
                  >
                    + {t('createTask', { title: q.trim() })}
                  </button>
                </div>
              ) : null}
              {ORDER.map((type) => {
                const group = ordered.filter((h) => h.type === type);
                if (!group.length) return null;
                return (
                  <div
                    key={type}
                    role="group"
                    aria-label={t(`types.${type}`)}
                    className="flex flex-col gap-1 py-1"
                  >
                    <p className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                      {t(`types.${type}`)}
                    </p>
                    {group.map((hit) => {
                      const index = ordered.indexOf(hit);
                      return (
                        <button
                          key={hit.id}
                          id={`hit-${hit.id}`}
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(hrefFor(hit))}
                          className={cn(
                            option,
                            index === active ? 'bg-support-1 text-primary' : 'text-text',
                          )}
                        >
                          <span aria-hidden="true">{GLYPH[type]}</span>
                          <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                          {hit.archived ? (
                            <span className="text-xs text-text-secondary">{t('archived')}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {recent.length ? (
                <p className="text-xs text-text-secondary">
                  {t('recent')} ·{' '}
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="mr-2 underline"
                      onClick={() => setQ(r)}
                    >
                      {r}
                    </button>
                  ))}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(option, 'w-auto')}
                  onClick={() => go('/inbox?add=1' as Route)}
                >
                  {t('addTask')}
                </button>
                <button
                  type="button"
                  className={cn(option, 'w-auto')}
                  onClick={() => go('/settings' as Route)}
                >
                  {t('settings')}
                </button>
              </div>
              <p className="text-xs text-text-secondary">{t('footer')}</p>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </PaletteContext.Provider>
  );
}

/** Kenar çubuğundaki "Ara · Ctrl K" düğmesi (Figma 4:66491). */
export function SearchButton({ className }: { className?: string }) {
  const t = useTranslations('search');
  const { open } = useSearchPalette();
  return (
    <button
      type="button"
      onClick={open}
      data-search-button
      className={cn(
        'flex min-h-11 w-full items-center gap-2 rounded-md border border-border px-3 text-sm text-text-secondary',
        className,
      )}
    >
      <span aria-hidden="true">⌕</span>
      <span className="flex-1 text-left">{t('button')}</span>
      <kbd className="text-xs">Ctrl K</kbd>
    </button>
  );
}
