'use client';

/** API hata gövdesi (API_CONTRACTS §2.4). */
export type ApiError = {
  code: string;
  message: string;
  rule?: string;
  details?: { field: string; reason: string }[];
  current?: unknown;
  /** BR-TASK-008: toplu işlemde reddedilen görevler. */
  failures?: { id: string; code: string; rule?: string }[];
  requestId?: string;
};

export type ApiResult<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> | undefined }
  | { ok: false; status: number; error: ApiError };

type ApiPath = `/api/v1/${string}`;

/** Kendi REST uç noktalarımıza (/api/v1) giden ince, tipli istemci. */
async function apiRequest<T>(
  method: string,
  path: ApiPath,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK', message: '' } };
  }
  if (response.status === 204) return { ok: true, data: undefined as T };
  const json = (await response.json().catch(() => null)) as {
    data?: T;
    meta?: Record<string, unknown>;
    error?: ApiError;
  } | null;
  if (response.ok && json && 'data' in json)
    return { ok: true, data: json.data as T, meta: json.meta };
  return {
    ok: false,
    status: response.status,
    error: json?.error ?? { code: 'INTERNAL_ERROR', message: '' },
  };
}

export const apiPost = <T>(path: ApiPath, body: unknown, headers?: Record<string, string>) =>
  apiRequest<T>('POST', path, body, headers);
export const apiPatch = <T>(path: ApiPath, body: unknown) => apiRequest<T>('PATCH', path, body);
export const apiDelete = <T = void>(path: ApiPath, body?: unknown) =>
  apiRequest<T>('DELETE', path, body);
export const apiGet = <T>(path: ApiPath) => apiRequest<T>('GET', path);
export const apiPut = <T>(path: ApiPath, body: unknown) => apiRequest<T>('PUT', path, body);
