'use client';

import { useTranslations } from 'next-intl';
import type { SaveStatus } from './use-preferences';

/** Figma "✓ Tercihlerin kaydedildi." (4:67783): başarı rengi, 13 px. Ekran okuyucuya kibarca duyurulur. */
export function SaveStatusText({ status }: { status: SaveStatus }) {
  const t = useTranslations('settings');
  return (
    <p role="status" aria-live="polite" className="min-h-5 text-sm">
      {status === 'saved' ? (
        <span className="text-success">
          <span aria-hidden="true">✓ </span>
          {t('saved')}
        </span>
      ) : status === 'failed' ? (
        <span className="text-danger">{t('saveFailed')}</span>
      ) : status === 'conflict' ? (
        <span className="text-warning">{t('conflict')}</span>
      ) : null}
    </p>
  );
}
