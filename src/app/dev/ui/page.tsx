import { notFound } from 'next/navigation';
import { Button } from '@/ui/components/button';
import { Chip } from '@/ui/components/chip';
import { Banner, EmptyState, SkeletonRows, Toast } from '@/ui/components/feedback';
import { Icon } from '@/ui/components/icon';
import { Input } from '@/ui/components/input';
import { Progress } from '@/ui/components/progress';

/**
 * Yalnızca geliştirme ortamında açılan bileşen karşılaştırma sayfası (UI_UX §12, D-060).
 * İçerik, Figma "Foundations" çerçevesindeki örnek metinlerdir (4:69589, 4:69673) — gerçek veri değildir.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto flex max-w-[1376px] flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Aysly · bileşenler (Figma karşılaştırması)</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">UI/Button, UI/Chip</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Görev ekle</Button>
            <Button variant="secondary">Vazgeç</Button>
            <Button variant="ghost">Düzenle</Button>
            <Button variant="danger">Çöpe taşı</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip>#tasarım</Chip>
            <Chip tone="progress">Devam ediyor</Chip>
            <Chip tone="danger">⚑ Yüksek</Chip>
            <Chip tone="warning">Bugün</Chip>
            <Chip tone="success">Tamamlandı</Chip>
          </div>
          <Progress done={2} total={6} label="2/6 · %33" />
        </section>
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">UI/Input</h2>
          <Input label="Görev başlığı" defaultValue="Ana sayfa tasarımı" />
          <Input label="Görev başlığı" error="Bir başlık yazmalısın." />
          <Input label="Proje" defaultValue="Müşteri A — Web · Arşivde" disabled />
        </section>
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">UI/Banner ve UI/Toast</h2>
          <Banner icon={<Icon name="wifi-off" />}>
            Bağlantı yok. Değişikliklerin kaydedilemeyebilir.
          </Banner>
          <Toast icon={<Icon name="check" />} message="Proje çöp kutusuna taşındı." />
        </section>
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">UI/Skeleton</h2>
          <SkeletonRows label="Yükleniyor" />
        </section>
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">UI/EmptyState</h2>
          <EmptyState
            icon={<Icon name="inbox" />}
            title="Inbox boş."
            description="Aklına gelen her şeyi buraya yaz, sonra düzenle."
            action={
              <Button variant="primary" icon={<Icon name="plus" />}>
                Görev ekle
              </Button>
            }
          />
        </section>
      </div>
    </main>
  );
}
