import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getViewer } from '../viewer';

/**
 * Onboarding (D-065: Figma'da yok). Odaklı tek sütun: giriş ekranlarının düzeni (D-069) ve Figma UI/Panel,
 * UI/Button, UI/Input ile. Oturum yoksa giriş sayfası.
 */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  if (!(await getViewer())) redirect('/sign-in');
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[560px] flex-col gap-6">
        <p className="text-center text-xl font-semibold text-text">aysly</p>
        {children}
      </div>
    </main>
  );
}
