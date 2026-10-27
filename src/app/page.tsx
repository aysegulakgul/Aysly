import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/modules/identity';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';

/**
 * Oturum yoksa giriş sayfasına yönlendirir (BR-PERM-001). Oturum varsa geçici sayfa gösterilir:
 * uygulama kabuğu ve "Bugün" ekranı (Figma 4:66490) sonraki adımlarda bu yolun yerini alır.
 * Çalışmayan bir özellik gösterilmez.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  const t = await getTranslations('foundation');
  return (
    <main className="mx-auto flex min-h-dvh max-w-[960px] items-center px-4">
      <EmptyState icon={<Icon name="inbox" />} title={t('title')} description={t('description')} />
    </main>
  );
}
