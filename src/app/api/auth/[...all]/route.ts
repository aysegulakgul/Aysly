import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/modules/identity';

// Better Auth uç noktaları: giriş, çıkış, oturumlar, şifre sıfırlama, e-posta doğrulama (API_CONTRACTS §3).
// Kayıt bu yoldan yapılamaz (disableSignUp); kayıt: POST /api/v1/auth/sign-up.
const handler = () => toNextJsHandler(auth());
export const GET = (request: Request) => handler().GET(request);
export const POST = (request: Request) => handler().POST(request);
