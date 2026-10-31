import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { PASSWORD, signUp } from './helpers';

/** Faz 8 kabul senaryoları: dışa aktarma (D-046, D-059) ve hesap silme (BR-ACC-005, D-092). */
const origin = { origin: E2E_BASE_URL };

async function workspace(page: Page) {
  return (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
}

test.describe('Faz 8 kabul', () => {
  test('D-046 / D-055: şifreyle doğrulanan kullanıcı çalışma alanını JSON olarak indirir', async ({
    page,
  }) => {
    const email = await signUp(page);
    const ws = await workspace(page);
    const created = await page.request.post(`/api/v1/workspaces/${ws}/tasks`, {
      data: { title: 'Dışa aktarılacak görev' },
      headers: { ...origin, 'idempotency-key': `faz8-${Date.now()}` },
    });
    expect(created.status()).toBe(201);

    await page.goto('/settings/data-privacy');
    const panel = page.locator('section').filter({ hasText: 'Verilerini dışa aktar' });
    await panel.getByLabel('Şifren').fill('yanlis sifre 123');
    await panel.getByRole('button', { name: 'JSON olarak indir' }).click();
    await expect(panel.getByText('Mevcut şifre yanlış.')).toBeVisible();

    await panel.getByLabel('Şifren').fill(PASSWORD);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('button', { name: 'JSON olarak indir' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^aysly-export-\d{4}-\d{2}-\d{2}\.json$/);
    const doc = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(doc).toMatchObject({ format: 'aysly-export', version: 1, profile: { email } });
    expect(doc.content.tasks.map((t: { title: string }) => t.title)).toContain(
      'Dışa aktarılacak görev',
    );
    await expect(panel.getByText('Dosya indirildi.')).toBeVisible();
  });

  test('BR-ACC-005 / D-092: silme talebi oturumu kapatır; girişte yalnızca iptal ekranı; iptal edince uygulama açılır', async ({
    page,
  }) => {
    const email = await signUp(page);
    await page.goto('/settings/data-privacy');
    await page.getByRole('button', { name: 'Hesabımı sil' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('kalıcı olarak silinecek');
    await dialog.getByLabel('Şifren').fill(PASSWORD);
    await dialog.getByRole('button', { name: 'Silme talebini onayla' }).click();
    await expect(page).toHaveURL('/sign-in');

    await page.getByLabel('E-posta').fill(email);
    await page.getByLabel('Şifre').fill(PASSWORD);
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page).toHaveURL('/account-deletion');
    await expect(page.getByRole('heading', { name: 'Hesabın silinmek üzere' })).toBeVisible();

    // D-092: iptal etmeden uygulama ve API kullanılamaz.
    await page.goto('/my-tasks');
    await expect(page).toHaveURL('/account-deletion');
    const blocked = await page.request.get('/api/v1/workspaces');
    expect(blocked.status()).toBe(403);
    expect((await blocked.json()).error.code).toBe('ACCOUNT_DELETION_PENDING');

    await page.getByRole('button', { name: 'Silmeyi iptal et' }).click();
    await expect(page).toHaveURL('/');
    expect((await page.request.get('/api/v1/workspaces')).status()).toBe(200);
  });
  test('SECURITY §5: sayfalar nonce tabanlı CSP ile gelir ve hiçbir kaynak engellenmez', async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });
    await signUp(page);
    for (const path of [
      '/',
      '/my-tasks',
      '/calendar',
      '/notes',
      '/goals',
      '/settings/data-privacy',
    ]) {
      const response = await page.goto(path);
      const csp = response?.headers()['content-security-policy'] ?? '';
      expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      await expect(page.locator('main, [role=main]').first()).toBeVisible();
    }
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('[data-search-palette]')).toBeVisible();
    expect(violations).toEqual([]);
  });
});
