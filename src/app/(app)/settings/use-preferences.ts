'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiPatch } from '@/client/api';
import type { Preferences } from '@/modules/preferences';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict';

/**
 * Ayar ekranlarında tercih kaydı: değişiklik hemen görünür, sunucuya `version` ile gönderilir (API_CONTRACTS §4).
 * Sürüm çakışmasında sunucudaki güncel hal gösterilir; hatada önceki değere dönülür.
 */
export function usePreferences(initial: Preferences) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');

  async function save(changes: Partial<Omit<Preferences, 'version'>>) {
    const previous = preferences;
    setPreferences({ ...previous, ...changes });
    setStatus('saving');
    const result = await apiPatch<Preferences>('/api/v1/me/preferences', {
      version: previous.version,
      ...changes,
    });
    if (result.ok) {
      setPreferences(result.data);
      setStatus('saved');
    } else if (result.status === 409 && result.error.current) {
      setPreferences(result.error.current as Preferences);
      setStatus('conflict');
    } else {
      setPreferences(previous);
      setStatus('failed');
    }
    // Tema, dil ve saat dilimi sunucuda çizilen düzeni de değiştirir.
    router.refresh();
  }

  return { preferences, status, save };
}
