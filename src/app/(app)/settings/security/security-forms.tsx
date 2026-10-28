'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiDelete, apiPost } from '@/client/api';
import { Button } from '@/ui/components/button';
import { Chip } from '@/ui/components/chip';
import { Banner } from '@/ui/components/feedback';
import { Input } from '@/ui/components/input';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { useFormFeedback } from '../form-feedback';

type Feedback = { fields: Record<string, string>; message?: string | undefined };

/** BR-ACC-002 + BR-ACC-006: mevcut şifreyle şifre değiştirme; diğer oturumlar kapanır. */
export function PasswordForm() {
  const t = useTranslations('settings.password');
  const router = useRouter();
  const toFeedback = useFormFeedback();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ fields: {} });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setDone(false);
    const result = await apiPost('/api/v1/me/password', {
      currentPassword: String(data.get('currentPassword') ?? ''),
      newPassword: String(data.get('newPassword') ?? ''),
    });
    setPending(false);
    if (!result.ok) return setFeedback(toFeedback(result));
    setFeedback({ fields: {} });
    setDone(true);
    form.reset();
    router.refresh(); // oturum listesi güncellenir
  }

  return (
    <Panel>
      <SectionHeading>{t('title')}</SectionHeading>
      {feedback.message ? <Banner>{feedback.message}</Banner> : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          name="currentPassword"
          type="password"
          label={t('current')}
          autoComplete="current-password"
          error={feedback.fields.currentPassword}
        />
        <Input
          name="newPassword"
          type="password"
          label={t('new')}
          autoComplete="new-password"
          error={feedback.fields.newPassword}
        />
        {feedback.fields.newPassword ? null : (
          <p className="-mt-2 text-sm text-text-secondary">{t('hint')}</p>
        )}
        <div className="flex flex-col items-start gap-3">
          <Button type="submit" variant="primary" loading={pending}>
            {t('submit')}
          </Button>
          {done ? (
            <p role="status" className="text-sm text-success">
              <span aria-hidden="true">✓ </span>
              {t('done')}
            </p>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

export type SessionRow = { id: string; current: boolean; device: string; lastSeen: string };

/** FR-AUTH-06 / BR-ACC-006: açık oturumlar; bu cihaz dışındakiler tek tek veya topluca kapatılabilir. */
export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const t = useTranslations('settings.sessions');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const others = sessions.filter((s) => !s.current);

  async function revoke(path: `/api/v1/${string}`, key: string) {
    setBusy(key);
    setFailed(false);
    const result = await apiDelete(path);
    setBusy(null);
    if (!result.ok) setFailed(true);
    router.refresh();
  }

  return (
    <Panel>
      <SectionHeading>{t('title')}</SectionHeading>
      <p className="text-sm text-text-secondary">{t('description')}</p>
      {failed ? <Banner>{t('failed')}</Banner> : null}
      <ul className="flex flex-col">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex min-h-row flex-wrap items-center gap-3 border-b border-border py-2"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="flex flex-wrap items-center gap-2 text-base text-text">
                {s.device}
                {s.current ? <Chip tone="progress">{t('thisDevice')}</Chip> : null}
              </p>
              <p className="text-xs text-text-secondary">{t('lastSeen', { date: s.lastSeen })}</p>
            </div>
            {s.current ? null : (
              <Button
                variant="ghost"
                loading={busy === s.id}
                onClick={() => revoke(`/api/v1/me/sessions/${s.id}`, s.id)}
                aria-label={`${t('revoke')}: ${s.device}, ${s.lastSeen}`}
              >
                {t('revoke')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <div>
          <Button
            loading={busy === 'others'}
            onClick={() => revoke('/api/v1/me/sessions?others=true', 'others')}
          >
            {t('revokeOthers')}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">{t('onlyThis')}</p>
      )}
    </Panel>
  );
}
