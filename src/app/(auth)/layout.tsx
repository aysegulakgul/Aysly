import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/modules/identity';

/**
 * Giriş/kayıt ekranları (D-065: Figma'da yok; Figma UI/Panel, UI/Input, UI/Button ile kuruldu, onay bekliyor).
 * Mobilde 16 px kenar boşluğu, masaüstünde ortalanmış 400 px panel.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getCurrentUser()) redirect('/');
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <p className="text-center text-xl font-semibold text-text">Aysly</p>
        {children}
      </div>
    </main>
  );
}
