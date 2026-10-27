import { defineConfig, devices } from '@playwright/test';

/**
 * Uçtan uca testler (TESTING_STRATEGY §2). `pnpm verify` duman setini Chromium'da çalıştırır;
 * faz kapanışında Firefox ve WebKit de eklenir.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
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
    command: 'pnpm dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
