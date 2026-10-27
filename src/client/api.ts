'use client';

/** API hata gövdesi (API_CONTRACTS §2.4). */
export type ApiError = {
  code: string;
  message: string;
  rule?: string;
  details?: { field: string; reason: string }[];
  requestId?: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

/** Kendi REST uç noktalarımıza (/api/v1) giden ince, tipli istemci. */
export async function apiPost<T>(path: `/api/v1/${string}`, body: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK', message: '' } };
  }
  const json = (await response.json().catch(() => null)) as { data?: T; error?: ApiError } | null;
  if (response.ok && json && 'data' in json) return { ok: true, data: json.data as T };
  return {
    ok: false,
    status: response.status,
    error: json?.error ?? { code: 'INTERNAL_ERROR', message: '' },
  };
}
