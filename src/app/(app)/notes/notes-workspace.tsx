'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import type { NoteView } from '@/modules/notes';
import { Button } from '@/ui/components/button';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { cn } from '@/ui/cn';
import { updatedWhen } from '../projects/when';
import { NotePane } from './note-pane';
import type { NoteProjectOption } from './note-types';

/** Not listesi + editör (Figma 4:67588). Mobilde açık not tam ekran, liste gizli (Figma 4:68829 / 4:68882). */
export function NotesWorkspace({
  notes,
  current,
  isNew,
  q,
  workspaceId,
  timezone,
  timeFormat,
  projects,
}: {
  notes: NoteView[];
  current: NoteView | null;
  isNew: boolean;
  q: string;
  workspaceId: string;
  timezone: string;
  timeFormat: '24h' | '12h';
  projects: NoteProjectOption[];
}) {
  const t = useTranslations('notes');
  const tProjects = useTranslations('projects');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);
  // Yeni not ilk kaydında kimlik kazanınca aynı düzenleyici yaşamaya devam eder; yeniden takılırsa
  // sunucudan gelen eski sürümle yazmayı sürdürür ve sahte çatışma kopyası oluşur (BR-NOTE-003).
  const [fresh, setFresh] = useState<{ n: number; id: string | null }>({ n: 0, id: null });
  // Başka bir nota geçilince ya da düzenleyici kapanınca sıradaki yeni not temiz bir düzenleyiciyle açılır.
  if (fresh.id && ((current && current.id !== fresh.id) || (!isNew && !current))) {
    setFresh({ n: fresh.n + 1, id: null });
  }
  const paneKey = current && current.id !== fresh.id ? current.id : `new-${fresh.n}`;
  const open = isNew || current !== null;
  const pinned = notes.filter((n) => n.pinned);
  const others = notes.filter((n) => !n.pinned);
  const when = (iso: string) =>
    updatedWhen(iso, {
      locale,
      timezone,
      timeFormat,
      today: (time) => tProjects('when.today', { time }),
      yesterday: (time) => tProjects('when.yesterday', { time }),
    });

  const card = (note: NoteView) => (
    <li key={note.id}>
      <Link
        href={`${pathname}?note=${note.id}` as Route}
        scroll={false}
        data-note-card
        aria-current={current?.id === note.id ? 'true' : undefined}
        className={cn(
          'flex flex-col gap-2 rounded-md border bg-surface p-3',
          current?.id === note.id ? 'border-primary bg-support-1/30' : 'border-border',
        )}
      >
        <span className="truncate text-base font-medium text-text">
          {note.pinned ? <span aria-hidden="true">⌖ </span> : null}
          {note.displayTitle}
        </span>
        {note.preview ? (
          <span className="truncate text-sm text-text-secondary">{note.preview}</span>
        ) : null}
        <span className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          {note.tags.slice(0, 3).map((tag) => (
            <span key={tag.id} className="rounded-sm border border-border px-1.5 py-0.5">
              #{tag.name}
            </span>
          ))}
          {when(note.updatedAt)}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className={cn('flex w-full items-start gap-4', open && 'hidden lg:flex')}>
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <Button
          variant="primary"
          icon={<Icon name="plus" />}
          onClick={() => {
            setFresh((f) => ({ n: f.n + 1, id: null }));
            router.push(`${pathname}?note=new` as Route, { scroll: false });
          }}
        >
          {t('create')}
        </Button>
      </div>
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
        <section
          aria-label={t('list')}
          className={cn(
            'flex w-full flex-col gap-3 lg:w-[280px] lg:shrink-0',
            open && 'hidden lg:flex',
          )}
        >
          <form
            role="search"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const params = new URLSearchParams();
              if (search.trim()) params.set('q', search.trim());
              router.push(`${pathname}?${params.toString()}` as Route);
            }}
          >
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text-secondary">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">{t('search')}</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                className="min-w-0 flex-1 bg-transparent text-text placeholder:text-text-secondary"
              />
            </label>
          </form>
          {notes.length === 0 ? (
            <EmptyState
              icon={<Icon name="inbox" />}
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          ) : (
            <>
              {pinned.length ? (
                <>
                  <h2 className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                    {t('pinned')}
                  </h2>
                  <ul className="flex flex-col gap-3">{pinned.map(card)}</ul>
                </>
              ) : null}
              {others.length ? (
                <>
                  {pinned.length ? (
                    <h2 className="text-xs font-medium tracking-wide text-text-secondary uppercase">
                      {t('others')}
                    </h2>
                  ) : null}
                  <ul className="flex flex-col gap-3">{others.map(card)}</ul>
                </>
              ) : null}
            </>
          )}
        </section>
        {open ? (
          <NotePane
            key={paneKey}
            note={current}
            onCreated={(id) => setFresh((f) => ({ ...f, id }))}
            workspaceId={workspaceId}
            timezone={timezone}
            timeFormat={timeFormat}
            projects={projects}
          />
        ) : (
          <p className="hidden flex-1 text-sm text-text-secondary lg:block">{t('pick')}</p>
        )}
      </div>
    </div>
  );
}
