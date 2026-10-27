import pino from 'pino';
import { env } from '@/shared/config/env';

/**
 * Yapılandırılmış JSON log (ARCHITECTURE §11). Şifre, token, çerez, içerik ve e-posta loglanmaz (SECURITY §7).
 * redact listesi, yanlışlıkla nesne içinde geçen hassas alanları maskeler.
 */
export const REDACT_PATHS = [
  'password',
  '*.password',
  'currentPassword',
  '*.currentPassword',
  'newPassword',
  '*.newPassword',
  'token',
  '*.token',
  'email',
  '*.email',
  'cookie',
  'headers.cookie',
  'headers.authorization',
  'title',
  '*.title',
  'body',
  '*.body',
  'description',
  '*.description',
];

let instance: pino.Logger | undefined;

export function logger(): pino.Logger {
  instance ??= pino({
    level: env().LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[gizlendi]' },
    base: { app: 'aysly' },
  });
  return instance;
}
