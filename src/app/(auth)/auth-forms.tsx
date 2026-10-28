'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { apiPost } from '@/client/api';
import { authClient } from '@/client/auth-client';
import { Button } from '@/ui/components/button';
import { Banner } from '@/ui/components/feedback';
import { Input } from '@/ui/components/input';
import { Panel, SectionHeading } from '@/ui/components/panel';

type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

function useReasons() {
  const t = useTranslations('auth.reasons');
  return (reason: string) => (t.has(reason) ? t(reason) : t('invalid'));
}

function formValue(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? '');
}

/** Yalnızca uygulama içi göreli yola yönlendirir (SECURITY §5: açık yönlendirme önlemi). */
function safeNext(next: string | null): '/' {
  return (next && next.startsWith('/') && !next.startsWith('//') ? next : '/') as '/';
}

export function SignInForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = event.currentTarget;
    const { error: failure } = await authClient.signIn.email({
      email: formValue(form, 'email'),
      password: formValue(form, 'password'),
    });
    setPending(false);
    if (failure) {
      // SECURITY §4.3: hangi alanın yanlış olduğu söylenmez. §4.4: hız sınırı aşıldıysa bekleme mesajı.
      setError(failure.status === 429 ? tErrors('rateLimited') : t('signIn.invalid'));
      return;
    }
    router.replace(safeNext(params.get('next')));
    router.refresh();
  }

  return (
    <Panel>
      <SectionHeading as="h1">{t('signIn.title')}</SectionHeading>
      {error ? <Banner>{error}</Banner> : null}
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Input label={t('fields.email')} name="email" type="email" autoComplete="email" required />
        <Input
          label={t('fields.password')}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" variant="primary" loading={pending}>
          {t('signIn.submit')}
        </Button>
      </form>
      <div className="flex flex-col gap-2 text-sm text-text-secondary">
        <Link href="/forgot-password" className="text-primary underline underline-offset-2">
          {t('signIn.forgot')}
        </Link>
        <p>
          {t('signIn.noAccount')}{' '}
          <Link href="/sign-up" className="text-primary underline underline-offset-2">
            {t('signIn.toSignUp')}
          </Link>
        </p>
      </div>
    </Panel>
  );
}

export function SignUpForm() {
  const t = useTranslations('auth');
  const reason = useReasons();
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setFieldErrors({});
    const form = event.currentTarget;
    const result = await apiPost<{ user: { id: string } }>('/api/v1/auth/sign-up', {
      name: formValue(form, 'name'),
      email: formValue(form, 'email'),
      password: formValue(form, 'password'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setPending(false);
    if (result.ok) {
      router.replace('/');
      router.refresh();
      return;
    }
    if (result.status === 0) return setError(t('network'));
    if (result.error.details?.length) {
      const next: FieldErrors = {};
      for (const d of result.error.details) {
        if (d.field === 'name' || d.field === 'email' || d.field === 'password')
          next[d.field] = reason(d.reason);
      }
      setFieldErrors(next);
      return;
    }
    setError(result.error.message);
  }

  return (
    <Panel>
      <SectionHeading as="h1">{t('signUp.title')}</SectionHeading>
      {error ? <Banner>{error}</Banner> : null}
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Input
          label={t('fields.name')}
          name="name"
          autoComplete="name"
          error={fieldErrors.name}
          required
        />
        <Input
          label={t('fields.email')}
          name="email"
          type="email"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />
        <Input
          label={t('fields.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password ?? undefined}
          placeholder={t('signUp.passwordHint')}
          required
        />
        <Button type="submit" variant="primary" loading={pending}>
          {t('signUp.submit')}
        </Button>
      </form>
      <p className="text-sm text-text-secondary">
        {t('signUp.hasAccount')}{' '}
        <Link href="/sign-in" className="text-primary underline underline-offset-2">
          {t('signUp.toSignIn')}
        </Link>
      </p>
    </Panel>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    // BR-ACC-003: yanıt her zaman aynı; e-postanın kayıtlı olup olmadığı söylenmez.
    await authClient.requestPasswordReset({
      email: formValue(event.currentTarget, 'email'),
      redirectTo: '/reset-password',
    });
    setPending(false);
    setSent(true);
  }

  return (
    <Panel>
      <SectionHeading as="h1">{t('forgot.title')}</SectionHeading>
      {sent ? (
        <Banner>{t('forgot.sent')}</Banner>
      ) : (
        <>
          <p className="text-base text-text-secondary">{t('forgot.description')}</p>
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <Input
              label={t('fields.email')}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <Button type="submit" variant="primary" loading={pending}>
              {t('forgot.submit')}
            </Button>
          </form>
        </>
      )}
      <Link href="/sign-in" className="text-sm text-primary underline underline-offset-2">
        {t('forgot.back')}
      </Link>
    </Panel>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const reason = useReasons();
  const params = useSearchParams();
  const token = params.get('token');
  const linkError = params.get('error');
  const [state, setState] = useState<'form' | 'done' | 'invalid'>(
    token && !linkError ? 'form' : 'invalid',
  );
  const [fieldError, setFieldError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newPassword = formValue(event.currentTarget, 'password');
    if (newPassword.length < 10) return setFieldError(reason('too_short')); // BR-ACC-002 (sunucu da doğrular)
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword, token: token ?? '' });
    setPending(false);
    if (error) {
      if (error.status === 400 && /password/i.test(error.message ?? ''))
        return setFieldError(reason('too_short'));
      return setState('invalid');
    }
    setState('done');
  }

  return (
    <Panel>
      <SectionHeading as="h1">{t('reset.title')}</SectionHeading>
      {state === 'done' ? <Banner>{t('reset.done')}</Banner> : null}
      {state === 'invalid' ? (
        <>
          <Banner>{t('reset.invalidLink')}</Banner>
          <Link
            href="/forgot-password"
            className="text-sm text-primary underline underline-offset-2"
          >
            {t('reset.requestNew')}
          </Link>
        </>
      ) : null}
      {state === 'form' ? (
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Input
            label={t('fields.newPassword')}
            name="password"
            type="password"
            autoComplete="new-password"
            error={fieldError}
            placeholder={t('signUp.passwordHint')}
            required
          />
          <Button type="submit" variant="primary" loading={pending}>
            {t('reset.submit')}
          </Button>
        </form>
      ) : null}
      {state === 'done' ? (
        <Link href="/sign-in" className="text-sm text-primary underline underline-offset-2">
          {t('forgot.back')}
        </Link>
      ) : null}
    </Panel>
  );
}
