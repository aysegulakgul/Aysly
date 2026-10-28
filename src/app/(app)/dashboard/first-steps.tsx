'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiPatch } from '@/client/api';
import { Panel, SectionHeading } from '@/ui/components/panel';
import { Progress } from '@/ui/components/progress';
import { cn } from '@/ui/cn';

export type FirstStep = {
  key: 'firstTask' | 'moveToProject' | 'setDate' | 'shortcuts';
  done: boolean;
};

/**
 * "İlk adımlar" (ONBOARDING §4, Figma'da yok — D-065): katlanabilir kart; maddeler verilerden otomatik
 * işaretlenir; tümü bitince veya kapatılınca kaybolur. Hatırlatıcı, tekrar, pano ve hedef maddeleri ilgili
 * fazlarda eklenir (D-080).
 */
export function FirstSteps({ steps }: { steps: FirstStep[] }) {
  const t = useTranslations('firstSteps');
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const done = steps.filter((s) => s.done).length;

  async function dismiss() {
    await apiPatch('/api/v1/me/onboarding/checklist', { dismissed: true });
    router.refresh();
  }

  return (
    <Panel>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SectionHeading>{t('title')}</SectionHeading>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="min-h-11 px-3 text-sm text-text-secondary"
        >
          {open ? t('collapse') : t('expand')}
        </button>
        <button
          type="button"
          aria-label={t('close')}
          onClick={() => void dismiss()}
          className="flex size-11 items-center justify-center text-xl text-text-secondary"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <Progress
        done={done}
        total={steps.length}
        label={t('progress', { done, total: steps.length })}
      />
      {open ? (
        <ul className="flex flex-col">
          {steps.map((step) => (
            <li key={step.key} className="flex min-h-11 items-center gap-3 px-2">
              <span
                aria-hidden="true"
                className={step.done ? 'text-success' : 'text-text-secondary'}
              >
                {step.done ? '✓' : '○'}
              </span>
              <span
                className={cn(
                  'text-base',
                  step.done ? 'text-text-secondary line-through' : 'text-text',
                )}
              >
                {t(`items.${step.key}`)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
