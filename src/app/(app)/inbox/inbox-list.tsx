'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { apiPost } from '@/client/api';
import type { TaskView } from '@/modules/tasks';
import { Banner, EmptyState, Toast } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { TaskRow, useTaskMeta } from '../tasks/task-row';
import type { TaskUiContext } from '../tasks/task-context';

const UNDO_MS = 5000; // BR-TASK-004: 5 sn'lik "Geri al"

/**
 * Inbox listesi (Figma "Capture list" 4:66707): "İşlenecekler" grubu. Tamamlanan görev listeden hemen çıkar;
 * 5 saniye boyunca "Geri al" ile yeniden açılabilir (BR-TASK-004).
 */
export function InboxList({ tasks, context }: { tasks: TaskView[]; context: TaskUiContext }) {
  const t = useTranslations('tasks');
  const tUi = useTranslations('ui');
  const router = useRouter();
  const meta = useTaskMeta(context);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ id: string; version: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const base = `/api/v1/workspaces/${context.workspaceId}/tasks` as const;
  const visible = tasks.filter((task) => !hidden.has(task.id));

  async function complete(task: TaskView) {
    setFailed(false);
    setHidden((set) => new Set(set).add(task.id));
    const result = await apiPost<TaskView>(`${base}/${task.id}/complete`, {
      version: task.version,
    });
    if (!result.ok) {
      setHidden((set) => {
        const next = new Set(set);
        next.delete(task.id);
        return next;
      });
      setFailed(true);
      return;
    }
    setUndo({ id: task.id, version: result.data.version });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
    router.refresh(); // Inbox sayacı güncellenir
  }

  async function revert() {
    if (!undo) return;
    clearTimeout(timer.current);
    const { id, version } = undo;
    setUndo(null);
    const result = await apiPost(`${base}/${id}/reopen`, { version });
    if (result.ok) {
      setHidden((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    } else setFailed(true);
    router.refresh();
  }

  return (
    <>
      {failed ? <Banner>{t('completeFailed')}</Banner> : null}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Icon name="inbox" />}
          title={t('inbox.emptyTitle')}
          description={t('inbox.emptyDescription')}
        />
      ) : (
        <section aria-labelledby="inbox-group" className="flex w-full flex-col gap-1">
          <div className="flex min-h-9 items-center gap-2">
            <h2 id="inbox-group" className="flex-1 text-base font-medium text-text">
              {t('inbox.group')}
            </h2>
            <p className="text-sm text-text-secondary">{visible.length}</p>
          </div>
          <ul className="flex flex-col">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                meta={meta(task, t('quickAdd.target'))}
                onComplete={() => void complete(task)}
              />
            ))}
          </ul>
        </section>
      )}
      {undo ? (
        <div className="fixed inset-x-4 bottom-[100px] z-20 mx-auto max-w-[420px] lg:right-auto lg:bottom-6 lg:left-[264px] lg:mx-0 lg:w-[420px]">
          <Toast
            icon={<Icon name="check" />}
            message={t('completed')}
            actionLabel={tUi('undo')}
            onAction={() => void revert()}
          />
        </div>
      ) : null}
    </>
  );
}
