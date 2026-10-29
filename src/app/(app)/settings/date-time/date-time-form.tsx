'use client';

import { useTranslations } from 'next-intl';
import type { Preferences } from '@/modules/preferences';
import { Select, TabChoice } from '@/ui/components/choice';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { SaveStatusText } from '../save-status';
import { usePreferences } from '../use-preferences';

const DATE_FORMATS = ['DD.MM.YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'] as const;
const WEEK_STARTS = [1, 0, 6] as const;

/** Biçim seçeneğinde örnek: 31 Aralık 2026 (gün ve ayın karışmaması için). */
const DATE_EXAMPLE: Record<(typeof DATE_FORMATS)[number], string> = {
  'DD.MM.YYYY': '31.12.2026',
  'YYYY-MM-DD': '2026-12-31',
  'MM/DD/YYYY': '12/31/2026',
};

/** Ayarlar · Tarih ve saat (BR-PREF-001, BR-PREF-003). Her değişiklik hemen kaydedilir. */
export function DateTimeForm({
  initial,
  timeZones,
}: {
  initial: Preferences;
  timeZones: string[];
}) {
  const t = useTranslations('settings');
  const { preferences, status, save } = usePreferences(initial);
  // Kayıtlı saat dilimi, çalışma ortamının listesinde yoksa (ör. eski bir ad) yine seçili gösterilir.
  const zones = timeZones.includes(preferences.timezone)
    ? timeZones
    : [preferences.timezone, ...timeZones];

  return (
    <>
      <Panel>
        <SectionHeading>{t('timezone.title')}</SectionHeading>
        <Select
          label={t('timezone.label')}
          value={preferences.timezone}
          onChange={(e) => void save({ timezone: e.target.value })}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll('_', ' ')}
            </option>
          ))}
        </Select>
        <p className="text-sm text-text-secondary">{t('timezone.hint')}</p>
      </Panel>
      <Panel>
        <SectionHeading>{t('formats.title')}</SectionHeading>
        <Select
          label={t('formats.dateFormat')}
          value={preferences.dateFormat}
          onChange={(e) => void save({ dateFormat: e.target.value as Preferences['dateFormat'] })}
        >
          {DATE_FORMATS.map((format) => (
            <option key={format} value={format}>
              {`${format} (${DATE_EXAMPLE[format]})`}
            </option>
          ))}
        </Select>
        <p className="text-sm text-text-secondary">{t('formats.timeFormat')}</p>
        <TabChoice
          label={t('formats.timeFormat')}
          value={preferences.timeFormat}
          onChange={(timeFormat) => void save({ timeFormat })}
          options={[
            { value: '24h', label: t('formats.h24') },
            { value: '12h', label: t('formats.h12') },
          ]}
        />
        <Select
          label={t('formats.weekStart')}
          value={String(preferences.weekStart)}
          onChange={(e) =>
            void save({ weekStart: Number(e.target.value) as Preferences['weekStart'] })
          }
        >
          {WEEK_STARTS.map((day) => (
            <option key={day} value={day}>
              {t(`weekdays.${day}`)}
            </option>
          ))}
        </Select>
        {/* BR-REM-001: tüm gün görevlerde göreli hatırlatıcının referans saati. */}
        <label className="flex w-full flex-col gap-2 text-sm text-text-secondary">
          {t('allDayReminderTime')}
          <input
            type="time"
            value={preferences.allDayReminderTime}
            onChange={(e) => e.target.value && void save({ allDayReminderTime: e.target.value })}
            className="min-h-11 w-full rounded-sm border border-border bg-page p-3 text-base text-text"
          />
        </label>
        <p className="text-sm text-text-secondary">{t('formats.hint')}</p>
      </Panel>
      <SaveStatusText status={status} />
    </>
  );
}
