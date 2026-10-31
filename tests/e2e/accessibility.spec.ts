import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

/** AC-11 / NFR-04 / D-093: tüm uygulama sayfalarında otomatik tarama ve yalnızca klavyeyle temel görev akışı. */
const origin = { origin: E2E_BASE_URL };
let seq = 0;
const key = () => `a11y-${Date.now()}-${++seq}`;
const isMobile = () => test.info().project.name === 'mobile';

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(path, {
    data,
    headers: { ...origin, 'idempotency-key': key() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data as { id: string };
}

async function expectNoSeriousViolations(page: Page, path: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${path} → ${v.id}: ${v.nodes.length}`);
  expect(serious).toEqual([]);
}

test.describe('Erişilebilirlik (AC-11)', () => {
  test('tüm uygulama sayfalarında kritik veya ciddi ihlal yok', async ({ page }) => {
    test.setTimeout(120_000);
    await signUp(page);
    const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
    const project = await post(page, `/api/v1/workspaces/${ws}/projects`, {
      name: 'Erişilebilir proje',
      color: 'blue',
    });
    const task = await post(page, `/api/v1/workspaces/${ws}/tasks`, {
      title: 'Erişilebilir görev',
      due: { date: '2026-12-01' },
    });
    const pages = [
      '/',
      '/inbox',
      `/inbox?task=${task.id}`,
      '/my-tasks',
      '/upcoming',
      '/calendar',
      '/projects',
      `/projects/${project.id}`,
      '/views/new',
      '/notes',
      '/notes?note=new',
      '/goals',
      '/notifications',
      '/archive',
      '/trash',
      '/settings/profile',
      '/settings/appearance',
      '/settings/date-time',
      '/settings/notifications',
      '/settings/security',
      '/settings/data-privacy',
      '/settings/tags',
      ...(isMobile() ? ['/menu'] : []),
    ];
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoSeriousViolations(page, path);
    }
  });

  test('yalnızca klavyeyle görev eklenir, tamamlanır, taşınır ve silinir', async ({ page }) => {
    test.skip(
      isMobile(),
      'Klavye kısayolları masaüstü içindir; mobil dokunmatik akışlar ayrı testlerde.',
    );
    await signUp(page);
    const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
    await post(page, `/api/v1/workspaces/${ws}/projects`, { name: 'Ev', color: 'green' });

    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    for (const title of ['Birinci', 'İkinci', 'Üçüncü']) {
      await page.keyboard.press('q');
      await expect(page.getByLabel('Hızlı ekle')).toBeFocused();
      await page.keyboard.type(title);
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-task-row]').filter({ hasText: title })).toHaveCount(1);
      await page.keyboard.press('Escape');
      await page.locator('body').click({ position: { x: 5, y: 5 } });
    }
    const rows = page.locator('[data-task-row]');
    await expect(rows).toHaveCount(3);
    const focusRow = async () => {
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('j');
      await expect(rows.first().locator('[data-task-link]')).toBeFocused();
    };

    // Tamamla: J ile ilk satıra odaklan, Ctrl/⌘ + Enter.
    await focusRow();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(rows).toHaveCount(2);

    // Taşı: M görev detayında proje alanını odaklar; ok tuşuyla proje seçilir.
    await focusRow();
    await page.keyboard.press('m');
    const projectField = page.locator('#detail-project');
    await expect(projectField).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(projectField.locator('option:checked')).toHaveText('Ev');
    await page.goto('/inbox');
    await expect(rows).toHaveCount(1);

    // Sil: J ile odaklan, Delete.
    await focusRow();
    const last = (await rows.first().getAttribute('data-task-id'))!;
    await page.keyboard.press('Delete');
    await expect(rows).toHaveCount(0);
    const trashed = await page.request.get(`/api/v1/workspaces/${ws}/trash`);
    expect(JSON.stringify(await trashed.json())).toContain(last);
  });
});
