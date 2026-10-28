'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiPatch, apiPost } from '@/client/api';
import { authClient } from '@/client/auth-client';
import { Button } from '@/ui/components/button';
import { Chip } from '@/ui/components/chip';
import { Banner } from '@/ui/components/feedback';
import { Input } from '@/ui/components/input';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { useFormFeedback } from '../form-feedback';

type Feedback = { fields: Record<string, string>; message?: string | undefined };

function formValue(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? '');
}

function SuccessText({ children }: { children: string }) {
  return (
    <p role="status" className="text-sm text-success">
      <span aria-hidden="true">✓ </span>
      {children}
    </p>
  );
}

/** FR-AUTH-07: ad değiştirme. */
export function ProfileForm({ initialName }: { initialName: string }) {
  const t = useTranslations('settings.profileForm');
  const router = useRouter();
  const toFeedback = useFormFeedback();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ fields: {} });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    const result = await apiPatch('/api/v1/me', { name: formValue(event.currentTarget, 'name') });
    setPending(false);
    if (!result.ok) return setFeedback(toFeedback(result));
    setFeedback({ fields: {} });
    setSaved(true);
    router.refresh(); // kenar çubuğu ve selamlama yeni adı gösterir
  }

  return (
    <Panel>
      <SectionHeading>{t('title')}</SectionHeading>
      {feedback.message ? <Banner>{feedback.message}</Banner> : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          name="name"
          label={t('name')}
          defaultValue={initialName}
          autoComplete="name"
          maxLength={100}
          error={feedback.fields.name}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="primary" loading={pending}>
            {t('save')}
          </Button>
          {saved ? <SuccessText>{t('saved')}</SuccessText> : null}
        </div>
      </form>
    </Panel>
  );
}

/** BR-ACC-004: e-posta durumu, doğrulama e-postasını yeniden gönderme ve e-posta değiştirme. */
export function EmailPanel({
  email,
  verified,
  justVerified,
}: {
  email: string;
  verified: boolean;
  justVerified: boolean;
}) {
  const t = useTranslations('settings.email');
  const tErrors = useTranslations('errors');
  const toFeedback = useFormFeedback();
  const [resent, setResent] = useState<'idle' | 'sent' | 'failed'>('idle');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ fields: {} });

  async function resend() {
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: '/settings/profile?email=verified',
    });
    setResent(error ? 'failed' : 'sent');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setSent(false);
    const result = await apiPost('/api/v1/me/email', {
      newEmail: formValue(form, 'newEmail'),
      currentPassword: formValue(form, 'currentPassword'),
    });
    setPending(false);
    if (!result.ok) return setFeedback(toFeedback(result));
    setFeedback({ fields: {} });
    setSent(true);
    form.reset();
  }

  return (
    <Panel>
      <SectionHeading>{t('title')}</SectionHeading>
      {justVerified ? <SuccessText>{t('changed')}</SuccessText> : null}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-secondary">{t('label')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-base break-all text-text">{email}</p>
          <Chip tone={verified ? 'success' : 'warning'}>
            {verified ? t('verified') : t('unverified')}
          </Chip>
        </div>
      </div>
      {verified ? null : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-text-secondary">{t('unverifiedHint')}</p>
          <Button onClick={resend} disabled={resent === 'sent'}>
            {t('resend')}
          </Button>
          {resent === 'sent' ? <SuccessText>{t('resent')}</SuccessText> : null}
          {resent === 'failed' ? <Banner>{tErrors('rateLimited')}</Banner> : null}
        </div>
      )}
      <div className="h-px w-full bg-border" />
      <h3 className="text-base font-medium text-text">{t('changeTitle')}</h3>
      {verified ? (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {feedback.message ? <Banner>{feedback.message}</Banner> : null}
          <Input
            name="newEmail"
            type="email"
            label={t('newEmail')}
            autoComplete="email"
            error={feedback.fields.newEmail}
          />
          <Input
            name="currentPassword"
            type="password"
            label={t('currentPassword')}
            autoComplete="current-password"
            error={feedback.fields.currentPassword}
          />
          <div className="flex flex-col items-start gap-3">
            <Button type="submit" variant="primary" loading={pending}>
              {t('submit')}
            </Button>
            {sent ? <SuccessText>{t('sent')}</SuccessText> : null}
          </div>
        </form>
      ) : (
        <p className="text-sm text-text-secondary">{t('needsVerification')}</p>
      )}
    </Panel>
  );
}
