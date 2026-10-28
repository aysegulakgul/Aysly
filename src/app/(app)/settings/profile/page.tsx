import { getTranslations } from 'next-intl/server';
import { getViewer } from '../../../viewer';
import { EmailPanel, OnboardingPanel, ProfileForm } from './profile-forms';

/** Ayarlar · Profil (D-065: Figma'da yok; Görünüm ekranının düzeni ve Figma UI/Panel, UI/Input, UI/Button ile). */
export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const [viewer, t, query] = await Promise.all([
    getViewer(),
    getTranslations('settings'),
    searchParams,
  ]);
  if (!viewer) return null;
  return (
    <>
      <h2 className="text-xl font-semibold text-text lg:sr-only">{t('profile')}</h2>
      <ProfileForm initialName={viewer.user.name} />
      <EmailPanel
        email={viewer.user.email}
        verified={viewer.user.emailVerified}
        justVerified={query.email === 'verified' && !query.error}
      />
      <OnboardingPanel />
    </>
  );
}
