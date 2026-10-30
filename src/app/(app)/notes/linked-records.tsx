'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiGet } from '@/client/api';
import type { GoalView } from '@/modules/goals';
import type { NoteView } from '@/modules/notes';

/**
 * Bağlı notlar ve hedefler (USER_FLOWS §2.6–2.7, FR-NOTE-04, FR-GOAL-02; Figma 4:67132 "Bağlı kayıtlar"). Görev
 * detayında ve proje sayfasında kullanılır; çöpteki not ve hedefler listelenmez (BR-NOTE-003, BR-GOAL-004).
 */
export function LinkedRecords({
  workspaceId,
  target,
}: {
  workspaceId: string;
  target: { kind: 'task' | 'project'; id: string };
}) {
  const t = useTranslations('notes');
  const [notes, setNotes] = useState<NoteView[] | null>(null);
  const [goals, setGoals] = useState<GoalView[] | null>(null);
  useEffect(() => {
    const param = `${target.kind === 'task' ? 'linkedTaskId' : 'linkedProjectId'}=${target.id}`;
    let alive = true;
    void Promise.all([
      apiGet<NoteView[]>(`/api/v1/workspaces/${workspaceId}/notes?${param}`),
      apiGet<GoalView[]>(`/api/v1/workspaces/${workspaceId}/goals?${param}`),
    ]).then(([n, g]) => {
      if (!alive) return;
      setNotes(n.ok ? n.data : []);
      setGoals(g.ok ? g.data : []);
    });
    return () => {
      alive = false;
    };
  }, [workspaceId, target.kind, target.id]);

  if (notes === null || goals === null) return null;
  return (
    <section
      aria-labelledby={`linked-${target.id}`}
      className="flex flex-col gap-2"
      data-linked-records
    >
      <h3 id={`linked-${target.id}`} className="text-base font-semibold text-text">
        {t('links')}
      </h3>
      {notes.length === 0 && goals.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('noLinks')}</p>
      ) : null}
      {notes.length ? (
        <>
          <p className="text-xs font-medium tracking-wide text-text-secondary uppercase">
            {t('title')}
          </p>
          <ul className="flex flex-col gap-1">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={`/notes?note=${n.id}` as Route} className="text-sm text-primary">
                  ≡ {n.displayTitle}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {goals.length ? (
        <>
          <p className="text-xs font-medium tracking-wide text-text-secondary uppercase">
            {t('goals')}
          </p>
          <ul className="flex flex-col gap-1">
            {goals.map((g) => (
              <li key={g.id}>
                <Link href={`/goals?goal=${g.id}` as Route} className="text-sm text-primary">
                  ◎ {g.title}
                  {g.progress.percent !== null ? ` · %${g.progress.percent}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
