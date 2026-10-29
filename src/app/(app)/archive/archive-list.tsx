'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiPost } from '@/client/api';
import type { ArchiveView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Banner } from '@/ui/components/feedback';
import { cn } from '@/ui/cn';
import { ProjectDot } from '../projects/project-color';
import { shortDate, todayIn } from '../tasks/dates';

export function ArchiveList({
  archive,
  type,
  workspaceId,
  timezone,
}: {
  archive: ArchiveView;
  type: 'projects' | 'tasks';
  workspaceId: string;
  timezone: string;
}) {
  const t = useTranslations('archive');
  const locale = useLocale();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const base = `/api/v1/workspaces/${workspaceId}` as const;
  const when = (iso: string | null) =>
    iso ? shortDate(todayIn(timezone, new Date(iso)), locale) : '';

  async function unarchive(path: `/api/v1/${string}`, version: number) {
    setFailed(false);
    const result = await apiPost(path, { version });
    if (!result.ok) setFailed(true);
    router.refresh();
  }

  const row = 'flex min-h-row items-center gap-3 border-b border-border px-2 py-2';
  return (
    <>
      <nav aria-label={t('tabs')} className="flex w-full gap-1 border-b border-border">
        {(['projects', 'tasks'] as const).map((key) => (
          <Link
            key={key}
            href={(key === 'projects' ? '/archive' : '/archive?type=tasks') as Route}
            aria-current={type === key ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-col justify-center p-3 text-sm font-medium',
              type === key ? 'border-b-2 border-primary text-primary' : 'text-text-secondary',
            )}
          >
            {`${t(key)} (${archive[key].length})`}
          </Link>
        ))}
      </nav>
      {failed ? <Banner>{t('failed')}</Banner> : null}
      {type === 'projects' ? (
        archive.projects.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('emptyProjects')}</p>
        ) : (
          <ul className="flex flex-col">
            {archive.projects.map((project) => (
              <li key={project.id} className={row} data-archive-row>
                <ProjectDot color={project.color} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/projects/${project.id}` as Route}
                    className="truncate text-base text-text"
                  >
                    {project.name}
                  </Link>
                  <p className="text-xs text-text-secondary">
                    {t('archivedAt', { when: when(project.archivedAt) })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="text-sm text-primary"
                  onClick={() =>
                    void unarchive(`${base}/projects/${project.id}/unarchive`, project.version)
                  }
                >
                  {t('unarchive')}
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : archive.tasks.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('emptyTasks')}</p>
      ) : (
        <ul className="flex flex-col">
          {archive.tasks.map((task) => (
            <li key={task.id} className={row} data-archive-row>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/my-tasks?task=${task.id}` as Route}
                  className="truncate text-base text-text"
                >
                  {task.title}
                </Link>
                <p className="text-xs text-text-secondary">
                  {`${task.project.name} · ${t('archivedAt', { when: when(task.archivedAt) })}`}
                </p>
              </div>
              <Button
                variant="ghost"
                className="text-sm text-primary"
                onClick={() => void unarchive(`${base}/tasks/${task.id}/unarchive`, task.version)}
              >
                {t('unarchive')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
