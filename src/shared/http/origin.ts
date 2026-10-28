/**
 * SECURITY §6: Durum değiştiren isteklerde Origin (yoksa Referer) başlığı uygulamanın kendi kökeniyle eşleşmelidir.
 * Eşleşmezse istek reddedilir (403 CSRF_REJECTED).
 */
export function isSameOrigin(headers: Headers, appBaseUrl: string): boolean {
  const expected = new URL(appBaseUrl).origin;
  const origin = headers.get('origin');
  if (origin) return origin === expected;
  const referer = headers.get('referer');
  if (!referer) return false;
  try {
    return new URL(referer).origin === expected;
  } catch {
    return false;
  }
}
