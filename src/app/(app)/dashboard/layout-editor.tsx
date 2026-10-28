'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiPatch } from '@/client/api';
import { Button } from '@/ui/components/button';
import { OptionCard } from '@/ui/components/choice';
import { Dialog } from '@/ui/components/dialog';
import { Icon } from '@/ui/components/icon';
import { AVAILABLE_WIDGETS, type WidgetId } from './widget-ids';

type Layout = { v: 1; widgets: { id: string; visible: boolean }[] };

/**
 * Figma "Düzenle" düğmesi (4:66529, ikon `sliders-horizontal`): bölümleri göster/gizle ve sırala (FR-DASH-08,
 * BR-DASH-001). Pencere Figma'da yok (D-065): Figma UI/Dialog görünümü ve seçenek kartlarıyla. Henüz olmayan
 * bölümler (Projeler, Hedefler) listede yer almaz; kayıttaki yerleri korunur.
 */
export function LayoutEditor({ layout, version }: { layout: Layout; version: number }) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const available = (id: string): id is WidgetId =>
    (AVAILABLE_WIDGETS as readonly string[]).includes(id);
  const [items, setItems] = useState(layout.widgets.filter((w) => available(w.id)));

  const swap = (i: number, j: number) =>
    setItems((list) => {
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  async function save() {
    // Henüz gösterilmeyen bölümler listedeki mevcut sıralarıyla sona eklenir.
    const rest = layout.widgets.filter((w) => !available(w.id));
    await apiPatch('/api/v1/me/preferences', {
      version,
      dashboardLayout: { v: 1, widgets: [...items, ...rest] },
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        icon={<Icon name="sliders-horizontal" />}
      >
        {t('edit')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('editTitle')}
        description={t('editDescription')}
      >
        <ul className="flex w-full flex-col gap-2">
          {items.map((w, i) => {
            const name = t(`widgets.${w.id as WidgetId}`);
            return (
              <li key={w.id} className="flex items-center gap-1">
                <div className="flex-1">
                  <OptionCard
                    type="checkbox"
                    name="widgets"
                    checked={w.visible}
                    onChange={(on) =>
                      setItems((list) =>
                        list.map((x) => (x.id === w.id ? { ...x, visible: on } : x)),
                      )
                    }
                  >
                    {name}
                  </OptionCard>
                </div>
                <Button
                  variant="ghost"
                  aria-label={t('moveUp', { widget: name })}
                  disabled={i === 0}
                  onClick={() => swap(i, i - 1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t('moveDown', { widget: name })}
                  disabled={i === items.length - 1}
                  onClick={() => swap(i, i + 1)}
                >
                  ↓
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void save()}>
            {t('save')}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
