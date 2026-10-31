'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { apiDelete, apiGet, apiPost } from '@/client/api';
import type { CommentView } from '@/modules/tasks';
import { Button } from '@/ui/components/button';
import { Avatar } from './pills';
import type { TaskUiContext } from './task-context';

/** D-099 / BR-COMMENT-001: görev yorumları; eskiden yeniye, yazan kendi yorumunu siler. */
export function CommentsSection({ taskId, context }: { taskId: string; context: TaskUiContext }) {
  const t = useTranslations('tasks.comments');
  const locale = useLocale();
  const url = `/api/v1/workspaces/${context.workspaceId}/tasks/${taskId}/comments` as const;
  const [items, setItems] = useState<CommentView[] | null>(null);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void apiGet<CommentView[]>(url).then((result) => {
      if (active) setItems(result.ok ? result.data : []);
    });
    return () => {
      active = false;
    };
  }, [url]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    const result = await apiPost<CommentView>(url, { body });
    setPending(false);
    if (!result.ok) return setFailed(true);
    setFailed(false);
    setBody('');
    setItems((list) => [...(list ?? []), result.data]);
  }

  async function remove(id: string) {
    const result = await apiDelete(`${url}/${id}`);
    if (result.ok) setItems((list) => (list ?? []).filter((c) => c.id !== id));
  }

  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: context.timeFormat === '12h' ? 'h12' : 'h23',
      timeZone: context.timezone,
    }).format(new Date(iso));

  return (
    <section
      aria-labelledby="task-comments"
      className="flex flex-col gap-3 border-b border-border pb-4"
    >
      <h3 id="task-comments" className="text-base font-semibold text-text">
        {t('title')}
        {items?.length ? (
          <span className="ml-2 text-sm font-normal text-text-secondary">{items.length}</span>
        ) : null}
      </h3>
      {items === null ? null : items.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar name={c.authorName ?? '?'} color="violet" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="font-medium text-text">{c.authorName ?? t('unknown')}</span>
                  {when(c.createdAt)}
                  {c.mine ? (
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      className="ml-auto text-xs text-text-secondary hover:text-danger"
                    >
                      {t('delete')}
                    </button>
                  ) : null}
                </p>
                <p className="text-sm whitespace-pre-wrap text-text">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          aria-label={t('label')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('placeholder')}
          maxLength={5000}
          rows={2}
          className="w-full resize-y rounded-sm border border-border bg-transparent p-2 text-sm text-text placeholder:text-text-secondary"
        />
        {failed ? <p className="text-xs text-danger">{t('failed')}</p> : null}
        <Button
          type="submit"
          variant="primary"
          className="self-end"
          disabled={pending || !body.trim()}
        >
          {t('send')}
        </Button>
      </form>
    </section>
  );
}
