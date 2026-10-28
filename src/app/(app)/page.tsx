import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getSessionStartedAt } from '@/modules/identity';
import { findOnboardingOffer, findOnboardingState } from '@/modules/preferences';
import { findTaskProgress } from '@/modules/tasks';
import { getDashboard, getPersonalScope, getViewer } from '../viewer';
import { FirstSteps, type FirstStep } from './dashboard/first-steps';
import { LayoutEditor } from './dashboard/layout-editor';
import { AVAILABLE_WIDGETS, type WidgetId } from './dashboard/widget-ids';
import { DashboardWidgets } from './dashboard/widgets';
import { PageFrame } from './page-frame';
import { QuickCapture } from './tasks/quick-capture';
import { buildTaskContext } from './tasks/task-context.server';
import { dayPart, firstName, longDate } from './time-display';

/**
 * Bugün (Figma 4:66490 masaüstü, 4:67890 mobil): selamlama, "Düzenle", hızlı ekleme (BR-INBOX-001) ve
 * bölümler (FR-DASH-01..04, 08). Projeler ve Hedefler bölümleri Faz 7'de (D-080).
 */
export default async function TodayPage() {
  const [viewer, scope, locale, tShell, t] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getLocale(),
    getTranslations('shell'),
    getTranslations('dashboard'),
  ]);
  if (!viewer || !scope) return null; // düzen oturumsuz isteği zaten yönlendirir
  // ONBOARDING §2: kayıttan sonra ve (bir kez atlandıysa) sonraki girişte rehber önerilir.
  const startedAt = await getSessionStartedAt();
  if (startedAt && (await findOnboardingOffer(viewer.user.id, startedAt))) redirect('/onboarding');

  const [context, data, onboarding, progress] = await Promise.all([
    buildTaskContext(viewer, scope),
    getDashboard(),
    findOnboardingState(viewer.user.id),
    findTaskProgress(scope),
  ]);
  const { timezone, dashboardLayout, version } = viewer.preferences;
  const now = new Date();
  // BR-DASH-001: görünür ve bu fazda çalışan bölümler, kullanıcının sırasıyla.
  const order = dashboardLayout.widgets
    .filter((w) => w.visible && (AVAILABLE_WIDGETS as readonly string[]).includes(w.id))
    .map((w) => w.id as WidgetId);
  const steps: FirstStep[] = [
    { key: 'firstTask', done: progress.hasTask },
    { key: 'moveToProject', done: progress.hasProjectTask },
    { key: 'setDate', done: progress.hasDatedTask },
    { key: 'shortcuts', done: onboarding?.checklist.shortcutsSeen ?? false },
  ];
  const showSteps = !onboarding?.checklist.dismissed && steps.some((s) => !s.done);

  return (
    <PageFrame title={tShell('today')}>
      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="flex-1 text-2xl font-semibold text-text">
            {t(`greeting.${dayPart(now, timezone)}`, { name: firstName(viewer.user.name) })}
          </h1>
          <LayoutEditor layout={dashboardLayout} version={version} />
        </div>
        <p className="text-sm text-text-secondary">
          {`${longDate(now, locale, timezone, true)} · ${t('subtitle')}`}
        </p>
      </div>
      <QuickCapture context={context} />
      {showSteps ? <FirstSteps steps={steps} /> : null}
      {data ? <DashboardWidgets data={data} order={order} context={context} /> : null}
    </PageFrame>
  );
}
