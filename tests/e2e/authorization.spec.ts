import { expect, test } from '@playwright/test';
import matrix from '../authorization-matrix.json' with { type: 'json' };
import { E2E_BASE_URL } from './e2e-env';

/** TESTING_STRATEGY §5: oturum gerektiren her uç nokta oturumsuz istekte 401 döner (BR-PERM-001). */
test.describe('Yetki matrisi', () => {
  for (const route of matrix.routes.filter((r) => r.access !== 'public')) {
    test(`${route.method} ${route.path} oturumsuz → 401`, async ({ request }) => {
      const response = await request.fetch(route.path, {
        method: route.method,
        headers: { origin: E2E_BASE_URL },
        ...('body' in route ? { data: route.body } : {}),
      });
      expect(response.status()).toBe(401);
      expect((await response.json()).error.code).toBe('UNAUTHENTICATED');
    });
  }
});
