import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

/**
 * NFR-01 (yerel üretim derlemesi): ana sayfalar dolu bir çalışma alanında hızlı açılır. Tarayıcının gezinme
 * ölçümleri kullanılır: sunucu yanıtı (TTFB) ve DOM hazır olma süresi. LCP yerine DOM hazır süresi yaklaşık
 * olarak alınır; eşik NFR-01'deki 2,5 sn.
 */
const origin = { origin: E2E_BASE_URL };
let seq = 0;
const key = () => `perf-${Date.now()}-${++seq}`;

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(path, {
    data,
    headers: { ...origin, 'idempotency-key': key() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data as { id: string };
}

test.describe('Performans (NFR-01)', () => {
  test('ana sayfalar 120 görevli alanda 2,5 sn içinde hazır; sunucu yanıtı 1 sn altında', async ({
    page,
  }) => {
    test.skip(test.info().project.name === 'mobile', 'Ölçüm masaüstünde bir kez yeterli.');
    test.setTimeout(120_000);
    await signUp(page);
    const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
    const colors = ['indigo', 'green', 'amber'];
    const projects = [];
    for (const [i, name] of ['Mobil', 'Ödeme', 'Analitik'].entries()) {
      projects.push(
        await post(page, `/api/v1/workspaces/${ws}/projects`, { name, color: colors[i] }),
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 120; i++) {
      await post(page, `/api/v1/workspaces/${ws}/tasks`, {
        title: `Görev ${i}`,
        projectId: projects[i % 3]!.id,
        priority: i % 4,
        storyPoints: [1, 2, 3, 5, 8][i % 5],
        ...(i % 3 === 0 ? {} : { due: { date: today } }),
      });
    }

    const results: string[] = [];
    for (const path of ['/', '/my-tasks', '/projects', '/calendar', '/goals', '/notes']) {
      await page.goto(path); // ısınma (derlenmiş sayfa ve bağlantı havuzu)
      await page.goto(path);
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return { ttfb: nav.responseStart, ready: nav.domContentLoadedEventEnd };
      });
      results.push(
        `${path}: TTFB ${timing.ttfb.toFixed(0)} ms, hazır ${timing.ready.toFixed(0)} ms`,
      );
      expect(timing.ttfb, path).toBeLessThan(1000);
      expect(timing.ready, path).toBeLessThan(2500);
    }
    console.info(results.join('\n'));
  });
});
