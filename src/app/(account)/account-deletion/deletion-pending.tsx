'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiDelete } from '@/client/api';
import { authClient } from '@/client/auth-client';
import { Button } from '@/ui/components/button';
import { Banner } from '@/ui/components/feedback';
import { Panel } from '@/ui/components/panel';

export function DeletionPending({ due }: { due: string }) {
  const t = useTranslations('accountDeletion');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function cancel() {
    setPending(true);
    setFailed(false);
    const result = await apiDelete('/api/v1/me/deletion');
    if (!result.ok) {
      setPending(false);
      setFailed(true);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <Panel>
      <h1 className="text-xl font-semibold text-text">{t('pendingTitle')}</h1>
      <p className="text-sm text-text-secondary">{t('pendingBody', { date: due })}</p>
      {failed ? <Banner>{t('cancelFailed')}</Banner> : null}
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={cancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button variant="secondary" onClick={signOut} disabled={pending}>
          {t('signOut')}
        </Button>
      </div>
    </Panel>
  );
}
