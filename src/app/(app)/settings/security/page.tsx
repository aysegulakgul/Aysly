import { getLocale, getTranslations } from 'next-intl/server';
import { findActiveSessions, getCurrentActor } from '@/modules/identity';
import { getViewer } from '../../../viewer';
import { describeDevice } from './device';
import { PasswordForm, SessionList } from './security-forms';

/** Ayarlar · Güvenlik (D-065: Figma'da yok; Görünüm ekranının düzeni ve Figma bileşenleriyle). FR-AUTH-06/07. */
export default async function SecuritySettingsPage() {
  const [viewer, actor, locale, t] = await Promise.all([
    getViewer(),
    getCurrentActor(),
    getLocale(),
    getTranslations('settings'),
  ]);
  if (!viewer || !actor) return null;
  const { timezone, timeFormat } = viewer.preferences;
  const format = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: timeFormat === '12h' ? 'h12' : 'h23', // BR-PREF-003: yalnızca sunum
    timeZone: timezone,
  });
  const sessions = (await findActiveSessions(actor)).map((s) => ({
    id: s.id,
    current: s.current,
    device: describeDevice(s.userAgent) ?? t('sessions.unknownDevice'),
    lastSeen: format.format(s.lastSeenAt),
  }));
  return (
    <>
      <h2 className="text-xl font-semibold text-text lg:sr-only">{t('security')}</h2>
      <PasswordForm />
      <SessionList sessions={sessions} />
    </>
  );
}
