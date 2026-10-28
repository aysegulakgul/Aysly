'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { authClient } from '@/client/auth-client';
import { NavButton } from '@/ui/components/nav';

/** Çıkış (FR-AUTH-06, BR-ACC-006): oturum sunucuda silinir, giriş sayfasına dönülür. */
export function SignOutButton() {
  const t = useTranslations('shell');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <NavButton glyph="⇥" onClick={signOut} disabled={pending} aria-busy={pending || undefined}>
      {t('signOut')}
    </NavButton>
  );
}
