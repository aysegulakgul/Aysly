import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { findInboxCount, findMyTasksCount } from '@/modules/tasks';
import { getPersonalScope, getViewer } from '../viewer';
import { MobileNavigation, Sidebar } from './navigation';

/**
 * Uygulama kabuğu (Figma UI/Sidebar 4:66491, UI/BottomNav 4:69074). Kenar çubuğu `lg` (1024 px) ve üstünde;
 * altında Figma'daki mobil düzen: alt navigasyon ve "Menü" ekranı. Oturum yoksa giriş sayfası (BR-PERM-001).
 * Yalnızca çalışan bölümler gösterilir; diğer menü öğeleri ait oldukları fazda eklenir.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [viewer, scope] = await Promise.all([getViewer(), getPersonalScope()]);
  if (!viewer || !scope) redirect('/sign-in');
  const [inboxCount, myTasksCount] = await Promise.all([
    findInboxCount(scope),
    findMyTasksCount(scope),
  ]);
  return (
    <div className="flex min-h-dvh">
      <Sidebar userName={viewer.user.name} inboxCount={inboxCount} myTasksCount={myTasksCount} />
      <div className="flex min-w-0 flex-1 flex-col pb-[84px] lg:pb-0">{children}</div>
      <MobileNavigation />
    </div>
  );
}
