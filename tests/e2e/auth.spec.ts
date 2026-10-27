import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MAILPIT_API } from './e2e-env';

const PASSWORD = 'ayisigi gece 2026';
const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ornek.test`;

type MailSummary = { ID: string; Subject: string; To: { Address: string }[] };

/** Mailpit'te belirli alıcıya giden, konusu eşleşen e-postayı bekler ve metnini döner. */
async function waitForEmail(to: string, subject: RegExp): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const list = (await (
      await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`)
    ).json()) as {
      messages: MailSummary[];
    };
    const match = list.messages.find((m) => subject.test(m.Subject));
    if (match) {
      const detail = (await (await fetch(`${MAILPIT_API}/message/${match.ID}`)).json()) as {
        Text: string;
      };
      return detail.Text;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`E-posta gelmedi: ${to} ${subject}`);
}

async function signUp(page: Page, email: string) {
  await page.goto('/sign-up');
  await page.getByLabel('Ad').fill('E2E Kullanıcı');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(PASSWORD);
  await page.getByRole('button', { name: 'Kayıt ol' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Kimlik doğrulama', () => {
  test('korumalı sayfa oturumsuz kullanıcıyı girişe yönlendirir (BR-PERM-001)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Giriş yap' })).toBeVisible();
  });

  test('BR-ACC-004: kayıt olan kullanıcı hemen uygulamaya girer ve doğrulama e-postası alır (D-040, D-055)', async ({
    page,
  }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    await expect(page.getByText('Aysly geliştiriliyor')).toBeVisible();
    const body = await waitForEmail(email, /e-posta adresini doğrula/);
    expect(body).toContain('/api/auth/verify-email?token=');
  });

  test('BR-ACC-006: oturum çerezi HttpOnly, SameSite=Lax, 30 gün geçerli; çıkışta oturum sunucuda geçersiz olur', async ({
    page,
    context,
  }) => {
    await signUp(page, uniqueEmail());
    const cookie = (await context.cookies()).find((c) => c.name === 'aysly.session_token');
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Lax');
    const days = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);

    // Çıkış: oturum sunucuda silinir; aynı çerez değeri artık geçerli değildir.
    const oldCookie = `aysly.session_token=${cookie!.value}`;
    const status = await page.evaluate(() =>
      fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }).then((r) => r.status),
    );
    expect(status).toBe(200);
    const session = await page.request.get('/api/auth/get-session', {
      headers: { cookie: oldCookie },
    });
    expect(await session.json()).toBeNull();
  });

  test('geçersiz kayıt alanları alan bazında gösterilir (BR-ACC-002)', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel('E-posta').fill('gecersiz');
    await page.getByLabel('Şifre').fill('kisa');
    await page.getByRole('button', { name: 'Kayıt ol' }).click();
    await expect(page.getByText('Bu alan zorunlu.')).toBeVisible();
    await expect(page.getByText('Geçerli bir e-posta adresi yaz.')).toBeVisible();
    await expect(page.getByText('Şifre en az 10 karakter olmalı.')).toBeVisible();
  });

  test('aynı e-postayla ikinci kayıt reddedilir (BR-ACC-001)', async ({ page, browser }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    const other = await browser.newContext({ locale: 'tr-TR' });
    const second = await other.newPage();
    await second.goto('/sign-up');
    await second.getByLabel('Ad').fill('Başka');
    await second.getByLabel('E-posta').fill(email.toUpperCase());
    await second.getByLabel('Şifre').fill('baska bir sifre 99');
    await second.getByRole('button', { name: 'Kayıt ol' }).click();
    await expect(
      second.getByText('Bu e-posta adresiyle yeni hesap açılamıyor', { exact: false }),
    ).toBeVisible();
    await other.close();
  });

  test('hatalı girişte hangi alanın yanlış olduğu söylenmez; doğru girişte uygulama açılır', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    const fresh = await browser.newContext({ locale: 'tr-TR' });
    const p = await fresh.newPage();
    await p.goto('/sign-in');
    await p.getByLabel('E-posta').fill(email);
    await p.getByLabel('Şifre').fill('yanlis sifre 123');
    await p.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(p.getByText('E-posta veya şifre hatalı.')).toBeVisible();
    await p.getByLabel('Şifre').fill(PASSWORD);
    await p.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(p).toHaveURL('/');
    await fresh.close();
  });

  test('şifre sıfırlama: aynı yanıt, e-posta bağlantısı, tüm oturumlar kapanır, yeni şifreyle giriş (BR-ACC-003)', async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    const email = uniqueEmail();
    await signUp(page, email); // bu sekmede açık bir oturum var

    const other = await browser.newContext({ locale: 'tr-TR' });
    const p = await other.newPage();
    await p.goto('/forgot-password');
    await p.getByLabel('E-posta').fill(email);
    await p.getByRole('button', { name: 'Bağlantı gönder' }).click();
    await expect(p.getByText('E-posta adresin kayıtlıysa', { exact: false })).toBeVisible();

    const body = await waitForEmail(email, /şifre sıfırlama/);
    const link = body.match(/https?:\/\/\S+/)?.[0];
    expect(link).toBeTruthy();
    await p.goto(link!);
    await expect(p).toHaveURL(/\/reset-password\?token=/);
    await p.getByLabel('Yeni şifre').fill('yeni ve uzun sifre 2026');
    await p.getByRole('button', { name: 'Şifreyi değiştir' }).click();
    await expect(p.getByText('Şifren değişti', { exact: false })).toBeVisible();
    await waitForEmail(email, /şifren değişti/); // D-055

    // İlk sekmedeki eski oturum artık geçersiz.
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in$/);

    // Kullanılmış bağlantı tekrar kullanılamaz: form gösterilmez, geçersiz bağlantı mesajı gösterilir.
    await p.goto(link!);
    await expect(
      p.getByText('Bu bağlantı geçersiz veya süresi dolmuş', { exact: false }),
    ).toBeVisible();
    await expect(p.getByLabel('Yeni şifre')).toHaveCount(0);
    await other.close();
  });

  test('kayıtlı olmayan e-postaya sıfırlama isteği de aynı yanıtı verir (SECURITY §4.3)', async ({
    page,
  }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('E-posta').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Bağlantı gönder' }).click();
    await expect(page.getByText('E-posta adresin kayıtlıysa', { exact: false })).toBeVisible();
  });

  for (const path of ['/sign-in', '/sign-up', '/forgot-password']) {
    test(`${path} erişilebilirlik taraması (AC-11)`, async ({ page }) => {
      await page.goto(path);
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
