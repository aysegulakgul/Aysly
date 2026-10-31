'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiDownload, apiPost } from '@/client/api';
import { Button } from '@/ui/components/button';
import { Dialog } from '@/ui/components/dialog';
import { Banner } from '@/ui/components/feedback';
import { Input } from '@/ui/components/input';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { useFormFeedback } from '../form-feedback';

type Feedback = { fields: Record<string, string>; message?: string | undefined };

/** FR-AUTH-09 / D-046 / D-055 / D-059: şifreyle yeniden doğrulayıp çalışma alanını JSON olarak indirir. */
export function ExportForm() {
  const t = useTranslations('settings.export');
  const toFeedback = useFormFeedback();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ fields: {} });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setDone(false);
    const result = await apiDownload('/api/v1/me/export', {
      currentPassword: String(new FormData(form).get('currentPassword') ?? ''),
    });
    setPending(false);
    if (!result.ok) return setFeedback(toFeedback(result));
    const url = URL.createObjectURL(result.data.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.data.filename;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback({ fields: {} });
    setDone(true);
    form.reset();
  }

  return (
    <Panel>
      <SectionHeading>{t('title')}</SectionHeading>
      <p className="text-sm text-text-secondary">{t('description')}</p>
      {feedback.message ? <Banner>{feedback.message}</Banner> : null}
      {done ? <Banner>{t('done')}</Banner> : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          name="currentPassword"
          type="password"
          label={t('password')}
          autoComplete="current-password"
          error={feedback.fields.currentPassword}
        />
        <Button type="submit" variant="primary" className="self-start" disabled={pending}>
          {pending ? t('pending') : t('submit')}
        </Button>
      </form>
    </Panel>
  );
}

/** BR-ACC-005 / D-036 / D-055 / USER_FLOWS §3.10: açıklama → şifre → onay → oturum kapanır. */
export function DeleteAccountForm({ due }: { due: string }) {
  const t = useTranslations('settings.deleteAccount');
  const router = useRouter();
  const toFeedback = useFormFeedback();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ fields: {} });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await apiPost('/api/v1/me/deletion', {
      currentPassword: String(new FormData(event.currentTarget).get('currentPassword') ?? ''),
    });
    if (!result.ok) {
      setPending(false);
      return setFeedback(toFeedback(result));
    }
    // Tüm oturumlar kapandı (BR-ACC-005); giriş sayfasına dönülür.
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <Panel>
      <SectionHeading>{t('title')}</SectionHeading>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-secondary">
        <li>{t('whatIsDeleted')}</li>
        <li>{t('grace')}</li>
        <li>{t('exportFirst')}</li>
      </ul>
      <Button variant="danger" className="self-start" onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setFeedback({ fields: {} });
        }}
        title={t('confirmTitle')}
        description={t('confirmBody', { date: due })}
      >
        {feedback.message ? <Banner>{feedback.message}</Banner> : null}
        <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-4">
          <Input
            name="currentPassword"
            type="password"
            label={t('password')}
            autoComplete="current-password"
            error={feedback.fields.currentPassword}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={pending}>
              {t('confirm')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Dialog>
    </Panel>
  );
}
