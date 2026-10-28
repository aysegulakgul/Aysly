'use client';

/** API hata gövdesi (API_CONTRACTS §2.4). */
export type ApiError = {
  code: string;
  message: string;
  rule?: string;
  details?: { field: string; reason: string }[];
  current?: unknown;
  requestId?: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

type ApiPath = `/api/v1/${string}`;

/** Kendi REST uç noktalarımıza (/api/v1) giden ince, tipli istemci. */
async function apiRequest<T>(method: string, path: ApiPath, body?: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK', message: '' } };
  }
  if (response.status === 204) return { ok: true, data: undefined as T };
  const json = (await response.json().catch(() => null)) as { data?: T; error?: ApiError } | null;
  if (response.ok && json && 'data' in json) return { ok: true, data: json.data as T };
  return {
    ok: false,
    status: response.status,
    error: json?.error ?? { code: 'INTERNAL_ERROR', message: '' },
  };
}

export const apiPost = <T>(path: ApiPath, body: unknown) => apiRequest<T>('POST', path, body);
export const apiPatch = <T>(path: ApiPath, body: unknown) => apiRequest<T>('PATCH', path, body);
export const apiDelete = (path: ApiPath) => apiRequest<void>('DELETE', path);
