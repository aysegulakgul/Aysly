import { getLocale } from 'next-intl/server';
import { deletionDueAt } from '@/modules/identity';
import { getViewer } from '../../viewer';
import { DeletionPending } from './deletion-pending';

/** BR-ACC-005 / D-092: 14 gün içinde giriş yapan kullanıcı silmeyi iptal eder ya da çıkış yapar. */
export default async function AccountDeletionPage() {
  const [viewer, locale] = await Promise.all([getViewer(), getLocale()]);
  if (!viewer?.user.deletionRequestedAt) return null;
  const due = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: viewer.preferences.timezone,
  }).format(deletionDueAt(viewer.user.deletionRequestedAt));
  return <DeletionPending due={due} />;
}
