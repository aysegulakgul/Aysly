import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';

/**
 * Faz 2 geçici giriş sayfası. Çalışmayan bir özelliği çalışıyormuş gibi göstermez.
 * Faz 3'te giriş/kayıt, Faz 4'te "Bugün" ekranı (Figma 4:66490) bu yolun yerini alır.
 */
export default async function HomePage() {
  const t = await getTranslations('foundation');
  return (
    <main className="mx-auto flex min-h-dvh max-w-[960px] items-center px-4">
      <EmptyState icon={<Icon name="inbox" />} title={t('title')} description={t('description')} />
    </main>
  );
}
