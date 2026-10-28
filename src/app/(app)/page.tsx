import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Panel } from '@/ui/components/panel';
import { getSessionStartedAt } from '@/modules/identity';
import { findOnboardingOffer } from '@/modules/preferences';
import { getPersonalScope, getViewer } from '../viewer';
import { QuickCapture } from './tasks/quick-capture';
import { buildTaskContext } from './tasks/task-context.server';
import { PageFrame } from './page-frame';
import { dayPart, firstName, longDate } from './time-display';

/**
 * Bugün (Figma 4:66490 / 4:67890). Faz 3: selamlama ve tarih (kullanıcının saat diliminde). Hızlı ekleme ve
 * widget'lar görevlerle birlikte Faz 4'te gelir; o zamana kadar çalışmayan bir öğe gösterilmez.
 */
export default async function TodayPage() {
  const [viewer, locale, tShell, t] = await Promise.all([
    getViewer(),
    getLocale(),
    getTranslations('shell'),
    getTranslations('dashboard'),
  ]);
  if (!viewer) return null; // düzen oturumsuz isteği zaten yönlendirir
  // ONBOARDING §2: kayıttan sonra ve (bir kez atlandıysa) sonraki girişte rehber önerilir.
  const scope = await getPersonalScope();
  const startedAt = await getSessionStartedAt();
  if (startedAt && (await findOnboardingOffer(viewer.user.id, startedAt))) redirect('/onboarding');
  const now = new Date();
  const { timezone } = viewer.preferences;
  return (
    <PageFrame title={tShell('today')}>
      <div className="flex w-full flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text">
          {t(`greeting.${dayPart(now, timezone)}`, { name: firstName(viewer.user.name) })}
        </h1>
        <p className="text-sm text-text-secondary">
          {`${longDate(now, locale, timezone, true)} · ${t('subtitle')}`}
        </p>
      </div>
      {/* BR-INBOX-001: bağlamsız hızlı ekleme Inbox'a ekler (Figma 4:66533). */}
      {scope ? <QuickCapture context={await buildTaskContext(viewer, scope)} /> : null}
      <Panel>
        <EmptyState
          icon={<Icon name="inbox" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Link href="/inbox" className="text-sm font-medium text-primary underline">
              {t('toInbox')}
            </Link>
          }
        />
      </Panel>
    </PageFrame>
  );
}
