import { defineConfig, devices } from '@playwright/test';
import { E2E_BASE_URL, E2E_PORT, E2E_SERVER_ENV } from './tests/e2e/e2e-env';

/**
 * Uçtan uca testler (TESTING_STRATEGY §2). Ayrı veritabanı (`aysly_e2e`) ve ayrı port (3100) kullanır;
 * geliştirme veritabanına dokunmaz. `pnpm verify` duman setini Chromium'da çalıştırır.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  // Geliştirme modunda ilk istekte sayfa/rota derlenir; ilk açılış birkaç saniye sürebilir.
  expect: { timeout: 15_000 },
  use: {
    baseURL: E2E_BASE_URL,
    timezoneId: 'Europe/Istanbul',
    locale: 'tr-TR',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1008 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `pnpm next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    env: E2E_SERVER_ENV,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
