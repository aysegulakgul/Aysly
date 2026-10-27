import { uuidv7 } from '@/shared/kernel/id';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Her yanıtta X-Request-Id bulunur (API_CONTRACTS §2.1). Gelen değer yalnızca güvenli biçimdeyse kullanılır. */
export function resolveRequestId(incoming: string | null): string {
  return incoming && /^[0-9a-zA-Z-]{8,64}$/.test(incoming) ? incoming : uuidv7();
}
