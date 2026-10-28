import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signUp } from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

async function addTask(page: Page, title: string) {
  await page.getByLabel('Hızlı ekle').fill(title);
  await page.getByLabel('Hızlı ekle').press('Enter');
  await expect(page.getByRole('listitem').filter({ hasText: title })).toBeVisible();
}

test.describe('Inbox ve hızlı ekleme', () => {
  test('BR-INBOX-001: hızlı ekleme Inbox’a ekler; tarih ve öncelik kaydedilir; sayaç güncellenir', async ({
    page,
  }) => {
    await signUp(page);
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Inbox boş')).toBeVisible();

    await page.getByLabel('Hızlı ekle').fill('Diş hekimi randevusu al');
    await page.getByRole('button', { name: 'Öncelik' }).click();
    await page.getByRole('radio', { name: '⚑ Yüksek' }).click();
    await page.getByRole('button', { name: 'Tarih', exact: true }).click();
    await page.getByRole('button', { name: 'Yarın' }).click();
    await page.getByRole('button', { name: 'Uygula' }).click();
    await page.getByRole('button', { name: 'Görev ekle' }).last().click();

    const row = page.getByRole('listitem').filter({ hasText: 'Diş hekimi randevusu al' });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/Inbox · \d+ \S+ · ⚑ Yüksek/);
    await expect(page.getByText('1 açık görev.')).toBeVisible();
    await expect(page.getByLabel('Hızlı ekle')).toHaveValue('');
    if (!isMobile()) {
      await expect(
        page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: /Inbox/ }),
      ).toContainText('1');
    }

    // Kalıcı: yeniden yüklemede de var
    await page.reload();
    await expect(row).toBeVisible();
  });

  test('BR-TASK-001: boş başlık eklenmez; Esc alanı temizler', async ({ page }) => {
    await signUp(page);
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Hızlı ekle').fill('   ');
    await page.getByLabel('Hızlı ekle').press('Enter');
    await expect(page.getByText('Bu alan zorunlu.')).toBeVisible();
    await page.getByLabel('Hızlı ekle').fill('Silinecek metin');
    await page.getByLabel('Hızlı ekle').press('Escape');
    await expect(page.getByLabel('Hızlı ekle')).toHaveValue('');
  });

  test('BR-TASK-004: tamamlanan görev listeden çıkar, "Geri al" geri getirir', async ({ page }) => {
    await signUp(page);
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await addTask(page, 'Garanti belgesini bul');

    await page.getByRole('button', { name: 'Tamamla: Garanti belgesini bul' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Garanti belgesini bul' }),
    ).toHaveCount(0);
    await expect(page.getByText('Görev tamamlandı.')).toBeVisible();
    await page.getByRole('button', { name: 'Geri al' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Garanti belgesini bul' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Garanti belgesini bul' }),
    ).toBeVisible();
  });

  test('BR-TASK-007: kayıt hatasında metin korunur; "Tekrar dene" tek görev oluşturur', async ({
    page,
  }) => {
    await signUp(page);
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    // İlk gönderim sunucuya ulaşır ama yanıt kaybolur (ağ kesintisi); ikinci gönderim aynı anahtarla gider.
    let first = true;
    await page.route('**/api/v1/workspaces/*/tasks', async (route) => {
      if (route.request().method() === 'POST' && first) {
        first = false;
        await route.fetch(); // istek sunucuda işlenir
        await route.abort('connectionreset');
      } else await route.continue();
    });
    await page.getByLabel('Hızlı ekle').fill('Çalışma lambası araştır');
    await page.getByLabel('Hızlı ekle').press('Enter');
    await expect(page.getByText('Kaydedilemedi. Metnin burada', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Hızlı ekle')).toHaveValue('Çalışma lambası araştır');

    await page.getByRole('button', { name: 'Tekrar dene' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Çalışma lambası araştır' }),
    ).toHaveCount(1);
    await page.reload();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Çalışma lambası araştır' }),
    ).toHaveCount(1);
  });

  test('Görev ekle / Ekle hızlı eklemeyi açar; Bugün sayfasından eklenen görev Inbox’a düşer', async ({
    page,
  }) => {
    await signUp(page);
    if (isMobile()) {
      await page
        .getByRole('navigation', { name: 'Alt menü' })
        .getByRole('link', { name: 'Ekle' })
        .click();
    } else {
      await page.getByRole('link', { name: 'Görev ekle' }).click();
    }
    await expect(page).toHaveURL('/inbox?add=1');
    await expect(page.getByLabel('Hızlı ekle')).toBeFocused();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Hızlı ekle').fill('Bugünden eklendi');
    await page.getByLabel('Hızlı ekle').press('Enter');
    await expect(page.getByText('Görev Inbox’a eklendi.')).toBeVisible();
    await page.goto('/inbox');
    await expect(page.getByRole('listitem').filter({ hasText: 'Bugünden eklendi' })).toBeVisible();
  });

  test('/inbox erişilebilirlik taraması, tarih seçici açıkken (AC-11)', async ({ page }) => {
    await signUp(page);
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    await addTask(page, 'Erişilebilirlik görevi');
    await page.getByRole('button', { name: 'Tarih', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Uygula' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
