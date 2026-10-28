import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { PASSWORD, firstLink, signIn, signUp, uniqueEmail, waitForEmail } from './helpers';

const isMobile = () => test.info().project.name === 'mobile';
const origin = { origin: E2E_BASE_URL };

/** Aynı hesapla ikinci bir cihaz (ayrı tarayıcı bağlamı). */
async function secondDevice(browser: Browser, email: string, password = PASSWORD) {
  const context = await browser.newContext({ locale: 'tr-TR' });
  const page = await context.newPage();
  await signIn(page, email, password);
  return { context, page };
}

test.describe('Ayarlar · Profil', () => {
  test('ad değişir ve kabukta görünür', async ({ page }) => {
    await signUp(page, undefined, 'Elif Yılmaz');
    await page.goto('/settings/profile');
    await page.getByLabel('Ad').fill('Ayşe Kaya');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.getByText('Adın kaydedildi.')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /, Ayşe$/ })).toBeVisible();
    if (!isMobile()) await expect(page.getByText('Ayşe Kaya · Kişisel')).toBeVisible();

    await page.goto('/settings/profile');
    await page.getByLabel('Ad').fill('   ');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.getByText('Bu alan zorunlu.')).toBeVisible();
  });

  test('BR-ACC-004: doğrulanmamış hesap e-posta değiştiremez; doğrulayınca değiştirebilir ve yeni adres doğrulanınca geçerli olur', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const email = await signUp(page);
    await page.goto('/settings/profile');
    await expect(page.getByText('Doğrulanmadı')).toBeVisible();
    await expect(page.getByText('önce mevcut adresini doğrula', { exact: false })).toBeVisible();
    const blocked = await page.request.post('/api/v1/me/email', {
      data: { newEmail: uniqueEmail(), currentPassword: PASSWORD },
      headers: origin,
    });
    expect(blocked.status()).toBe(422);
    expect((await blocked.json()).error.rule).toBe('BR-ACC-004');

    // Kayıtta gelen doğrulama bağlantısı
    await page.goto(firstLink(await waitForEmail(email, /doğrula/)));
    await page.goto('/settings/profile');
    await expect(page.getByText('Doğrulandı', { exact: true })).toBeVisible();

    const newEmail = uniqueEmail();
    await page.getByLabel('Yeni e-posta').fill(newEmail);
    await page.getByLabel('Mevcut şifre').fill('yanlis sifre 123');
    await page.getByRole('button', { name: 'Doğrulama bağlantısı gönder' }).click();
    await expect(page.getByText('Mevcut şifre yanlış.')).toBeVisible();

    await page.getByLabel('Mevcut şifre').fill(PASSWORD);
    await page.getByRole('button', { name: 'Doğrulama bağlantısı gönder' }).click();
    await expect(page.getByText('mevcut adresin geçerli kalır', { exact: false })).toBeVisible();

    // Yeni adres doğrulanana kadar eski adres geçerli
    await page.reload();
    await expect(page.getByText(email)).toBeVisible();

    await page.goto(firstLink(await waitForEmail(newEmail, /doğrula/)));
    await expect(page).toHaveURL(/\/settings\/profile\?email=verified/);
    await expect(page.getByText('E-posta adresin doğrulandı.')).toBeVisible();
    await expect(page.getByText(newEmail)).toBeVisible();
  });
});

test.describe('Ayarlar · Güvenlik', () => {
  test('BR-ACC-002/006: şifre değişince diğer oturumlar kapanır, bu cihaz açık kalır, e-posta gelir', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const email = await signUp(page);
    const other = await secondDevice(browser, email);

    await page.goto('/settings/security');
    await page.getByLabel('Mevcut şifre').fill(PASSWORD);
    await page.getByLabel('Yeni şifre').fill('password123');
    await page.getByRole('button', { name: 'Şifreyi değiştir' }).click();
    await expect(page.getByText('Bu şifre çok yaygın', { exact: false })).toBeVisible();

    await page.getByLabel('Yeni şifre').fill('yeni ve uzun sifre 2026');
    await page.getByRole('button', { name: 'Şifreyi değiştir' }).click();
    await expect(
      page.getByText('Diğer cihazlardaki oturumların kapatıldı', { exact: false }),
    ).toBeVisible();
    await waitForEmail(email, /şifren değişti/); // D-055

    await page.reload();
    await expect(page).toHaveURL('/settings/security'); // bu cihaz hâlâ girişli
    await other.page.goto('/');
    await expect(other.page).toHaveURL(/\/sign-in$/); // diğer cihaz çıkış yaptı
    await signIn(other.page, email, 'yeni ve uzun sifre 2026');
    await other.context.close();
  });

  test('BR-ACC-006: oturumlar listelenir; diğer cihazın oturumu kapatılır', async ({
    page,
    browser,
  }) => {
    const email = await signUp(page);
    test.setTimeout(60_000);
    const other = await secondDevice(browser, email);
    await page.goto('/settings/security');
    await page.waitForLoadState('networkidle'); // düğmeler etkileşime hazır olsun
    const rows = page.getByRole('main').getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByText('Bu cihaz')).toBeVisible();

    await page.getByRole('button', { name: /^Oturumu kapat/ }).click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByText('Başka cihazda açık oturumun yok.')).toBeVisible();
    await other.page.goto('/');
    await expect(other.page).toHaveURL(/\/sign-in$/);
    await other.context.close();
  });

  test('BR-PERM-001: başka kullanıcının oturumu kapatılamaz (404); token hiçbir yanıtta yer almaz', async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    await signUp(page);
    const otherContext = await browser.newContext({ locale: 'tr-TR' });
    const otherPage = await otherContext.newPage();
    await signUp(otherPage);
    const theirs = (await (await otherPage.request.get('/api/v1/me/sessions')).json()).data;
    expect(JSON.stringify(theirs)).not.toMatch(/token/i);

    const attempt = await page.request.delete(`/api/v1/me/sessions/${theirs[0].id}`, {
      headers: origin,
    });
    expect(attempt.status()).toBe(404);
    expect((await (await otherPage.request.get('/api/v1/me/sessions')).json()).data).toHaveLength(
      1,
    );
    await otherContext.close();
  });

  test('kütüphanenin doğrudan hesap uç noktaları dışarıya kapalıdır', async ({ page }) => {
    await signUp(page);
    for (const [method, path] of [
      ['POST', '/api/auth/change-password'],
      ['POST', '/api/auth/update-user'],
      ['POST', '/api/auth/change-email'],
      ['GET', '/api/auth/list-sessions'],
      ['POST', '/api/auth/revoke-other-sessions'],
    ] as const) {
      const response = await page.request.fetch(path, { method, headers: origin, data: {} });
      expect(response.status(), path).toBe(404);
    }
  });

  for (const path of ['/settings/profile', '/settings/security']) {
    test(`${path} erişilebilirlik taraması (AC-11)`, async ({ page }) => {
      await signUp(page);
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});
