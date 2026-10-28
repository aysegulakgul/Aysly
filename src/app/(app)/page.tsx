import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Panel } from '@/ui/components/panel';
import { getViewer } from '../viewer';
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
      <Panel>
        <EmptyState
          icon={<Icon name="inbox" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Link href="/settings" className="text-sm font-medium text-primary underline">
              {t('toSettings')}
            </Link>
          }
        />
      </Panel>
    </PageFrame>
  );
}
