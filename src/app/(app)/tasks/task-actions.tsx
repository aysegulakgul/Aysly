'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { apiPost } from '@/client/api';
import type { TaskView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner, Toast } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import type { TaskUiContext } from './task-context';

const UNDO_MS = 5000; // BR-TASK-004: 5 sn'lik "Geri al"

type Completable = Pick<TaskView, 'id' | 'title' | 'version' | 'status' | 'subtaskCount'>;

/**
 * Tamamlama akışı (BR-TASK-004, BR-SUB-003): açık alt görev varsa Figma "Görevi tamamla" (4:69469) penceresi
 * sorar; tamamlanan görev listeden hemen gizlenir ve 5 sn "Geri al" sunulur (geri al = yeniden açma).
 */
export function useTaskCompletion(context: TaskUiContext) {
  const t = useTranslations('tasks');
  const tUi = useTranslations('ui');
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<Completable | null>(null);
  const [undo, setUndo] = useState<{ id: string; version: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const base = `/api/v1/workspaces/${context.workspaceId}/tasks` as const;
  const show = (id: string) =>
    setHidden((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });

  async function run(task: Completable, completeSubtasks: boolean) {
    setAsking(null);
    setFailed(false);
    setHidden((set) => new Set(set).add(task.id));
    const result = await apiPost<{ version: number }>(`${base}/${task.id}/complete`, {
      version: task.version,
      ...(completeSubtasks ? { completeSubtasks: true } : {}),
    });
    if (!result.ok) {
      show(task.id);
      setFailed(true);
      return;
    }
    setUndo({ id: task.id, version: result.data.version });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
    router.refresh();
  }

  function complete(task: Completable) {
    const open = task.subtaskCount.total - task.subtaskCount.done;
    if (open > 0) setAsking(task);
    else void run(task, false);
  }

  async function revert() {
    if (!undo) return;
    clearTimeout(timer.current);
    const { id, version } = undo;
    setUndo(null);
    const result = await apiPost(`${base}/${id}/reopen`, { version });
    if (result.ok) show(id);
    else setFailed(true);
    router.refresh();
  }

  const counts = asking?.subtaskCount ?? { total: 0, done: 0 };
  const ui = (
    <>
      {failed ? <Banner>{t('completeFailed')}</Banner> : null}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        context={asking?.title}
        title={t('completeDialog.title')}
        description={t('completeDialog.description', {
          ...counts,
          open: counts.total - counts.done,
        })}
        footnote={t('completeDialog.footnote')}
      >
        <Button variant="primary" onClick={() => asking && void run(asking, true)}>
          {t('completeDialog.all')}
        </Button>
        <Button onClick={() => asking && void run(asking, false)}>
          {t('completeDialog.onlyParent')}
        </Button>
        <Button variant="ghost" onClick={() => setAsking(null)}>
          {t('completeDialog.cancel')}
        </Button>
      </Dialog>
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

  return { hidden, complete, ui };
}
