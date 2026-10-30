'use client';

import { useTranslations } from 'next-intl';
import { useSearchPalette } from './command-palette';

/** Figma mobil başlıktaki arama simgesi (4:68640): komut paletini açar. */
export function MobileSearchButton() {
  const t = useTranslations('search');
  const { open } = useSearchPalette();
  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('button')}
      className="flex size-11 items-center justify-center rounded-md text-lg text-text-secondary"
    >
      <span aria-hidden="true">⌕</span>
    </button>
  );
}
