/** Tarayıcı testlerinin ayrı ortamı: ayrı veritabanı, ayrı port, ayrı derleme klasörü. */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE = 'aysly_e2e';
export const ADMIN_DATABASE_URL = 'postgres://aysly:aysly_local_dev@127.0.0.1:5433/aysly';
export const E2E_DATABASE_URL = `postgres://aysly:aysly_local_dev@127.0.0.1:5433/${E2E_DATABASE}`;
export const MAILPIT_API = 'http://127.0.0.1:8025/api/v1';

export const E2E_SERVER_ENV = {
  DATABASE_URL: E2E_DATABASE_URL,
  APP_BASE_URL: E2E_BASE_URL,
  AUTH_SECRET: 'e2e-only-secret-not-used-anywhere-else-000',
  EMAIL_TRANSPORT: 'smtp',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SCHEDULER_ENABLED: 'false',
  // Testler aynı yerel IP'den çok sayıda kayıt/giriş yapar; sınırın kendisi entegrasyon testinde kanıtlanır.
  AUTH_RATE_LIMIT_ENABLED: 'false',
  LOG_LEVEL: 'warn',
  NEXT_DIST_DIR: '.next-e2e',
};
