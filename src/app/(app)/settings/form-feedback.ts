'use client';

import { useTranslations } from 'next-intl';
import type { ApiResult } from '@/client/api';

/**
 * Ayar formlarında API hatasını kullanıcı metnine çevirir: alan hataları (400) alan altında, diğerleri
 * (422 iş kuralı, 429, ağ) formun genel mesajında gösterilir (ERROR_HANDLING_AND_EDGE_CASES).
 */
export function useFormFeedback() {
  const reasons = useTranslations('auth.reasons');
  const errors = useTranslations('errors');
  const auth = useTranslations('auth');

  return function feedback(result: Extract<ApiResult<unknown>, { ok: false }>): {
    fields: Record<string, string>;
    message?: string;
  } {
    if (result.status === 0) return { fields: {}, message: auth('network') };
    if (result.status === 400 && result.error.details?.length) {
      const fields: Record<string, string> = {};
      for (const { field, reason } of result.error.details) {
        fields[field] ??= reasons.has(reason) ? reasons(reason) : errors('validation');
      }
      return { fields };
    }
    if (result.status === 429) return { fields: {}, message: errors('rateLimited') };
    return { fields: {}, message: result.error.message || errors('internal') };
  };
}
