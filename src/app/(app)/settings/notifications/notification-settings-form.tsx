'use client';

import { useTranslations } from 'next-intl';
import type { Preferences } from '@/modules/preferences';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { SaveStatusText } from '../save-status';
import { usePreferences } from '../use-preferences';

/** BR-NOTIF-004: hatırlatıcı bildirimleri varsayılan açık; kapatılınca zamanı gelen hatırlatıcılar atlanır. */
export function NotificationSettingsForm({ initial }: { initial: Preferences }) {
  const t = useTranslations('settings.notificationSettings');
  const { preferences, status, save } = usePreferences(initial);
  const enabled = preferences.notificationSettings.reminder.inApp;
  return (
    <>
      <Panel>
        <SectionHeading>{t('title')}</SectionHeading>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-text">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) =>
              void save({ notificationSettings: { v: 1, reminder: { inApp: e.target.checked } } })
            }
            className="size-5"
          />
          {t('reminders')}
        </label>
        <p className="text-sm text-text-secondary">{t('hint')}</p>
      </Panel>
      <SaveStatusText status={status} />
    </>
  );
}
