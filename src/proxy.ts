import { NextResponse, type NextRequest } from 'next/server';

/**
 * İçerik Güvenlik Politikası (SECURITY §5): istek başına nonce'lu `script-src`; Next.js kendi script'lerine nonce'u
 * istek başlığındaki CSP'den okuyarak ekler. Üçüncü taraf kaynak yok. Stiller için `'unsafe-inline'` gerekir: React
 * `style` öznitelikleri, Radix konumlandırması ve editör satır içi stil kullanır (script çalıştırmaz).
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === 'development';
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', policy);
  return response;
}

export const config = {
  // Sayfalar; API yanıtları ve statik dosyalar hariç. Önceden getirme istekleri nonce'suz önbelleğe girmesin diye atlanır.
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
