import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { findProjectOverview, findSidebarCounts } from '@/modules/tasks';
import { findViews } from '@/modules/views';
import { getPersonalScope, getViewer } from '../viewer';
import { KeyboardShortcuts } from './shortcuts';
import { MobileNavigation, Sidebar } from './navigation';
import { NotificationProvider } from './notifications/notification-center';
import { SearchPaletteProvider } from './search/command-palette';

/**
 * Uygulama kabuğu (Figma UI/Sidebar 4:66491, UI/BottomNav 4:69074). Kenar çubuğu `lg` (1024 px) ve üstünde;
 * altında Figma'daki mobil düzen: alt navigasyon ve "Menü" ekranı. Oturum yoksa giriş sayfası (BR-PERM-001).
 * Yalnızca çalışan bölümler gösterilir; diğer menü öğeleri ait oldukları fazda eklenir.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [viewer, scope] = await Promise.all([getViewer(), getPersonalScope()]);
  if (!viewer || !scope) redirect('/sign-in');
  if (viewer.user.deletionRequestedAt) redirect('/account-deletion'); // D-092
  // NFR-01: kenar çubuğu sayıları tek sayım sorgusundan; pano yalnızca Bugün sayfasında hesaplanır.
  const [counts, projects, views] = await Promise.all([
    findSidebarCounts(scope, viewer.preferences),
    findProjectOverview(scope),
    findViews(scope),
  ]);
  return (
    <NotificationProvider>
      <SearchPaletteProvider workspaceId={scope.workspaceId}>
        <div className="flex min-h-dvh">
          <Sidebar
            userName={viewer.user.name}
            counts={counts}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              // BR-PROJ-003: görev yoksa ilerleme gösterilmez.
              percent: p.progress?.total
                ? Math.round((p.progress.done / p.progress.total) * 100)
                : null,
            }))}
            views={views.map((v) => ({ id: v.id, name: v.name }))}
          />
          <div className="flex min-w-0 flex-1 flex-col pb-[84px] lg:pb-0">{children}</div>
          <MobileNavigation />
          <KeyboardShortcuts workspaceId={scope.workspaceId} />
        </div>
      </SearchPaletteProvider>
    </NotificationProvider>
  );
}
