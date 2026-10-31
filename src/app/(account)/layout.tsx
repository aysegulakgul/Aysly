import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getViewer } from '../viewer';

/**
 * Silme talebi süren hesabın tek ekranı (D-092). Düzen onboarding ve giriş ekranlarıyla aynıdır (D-065, D-069).
 * Talep yoksa uygulamaya, oturum yoksa giriş sayfasına dönülür.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (!viewer.user.deletionRequestedAt) redirect('/');
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <p className="text-center text-xl font-semibold text-text">aysly</p>
        {children}
      </div>
    </main>
  );
}
