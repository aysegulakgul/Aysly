import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

const origin = { origin: E2E_BASE_URL };
let seq = 0;
const key = () => `ui-${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 8)}`;

/** Onboarding'deki örnek projelerle (Ev, İş) kullanıcı ve API ile görev oluşturma. */
async function setupUser(page: Page) {
  await signUp(page, undefined, undefined, { keepOnboarding: true });
  await page.request.post('/api/v1/me/onboarding', {
    data: { intents: ['personal', 'work'], createSamples: true },
    headers: origin,
  });
  const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
  const projects = (await (await page.request.get(`/api/v1/workspaces/${ws}/projects`)).json())
    .data as { id: string; name: string; kind: string }[];
  const create = async (body: Record<string, unknown>) =>
    (
      await (
        await page.request.post(`/api/v1/workspaces/${ws}/tasks`, {
          data: body,
          headers: { ...origin, 'idempotency-key': key() },
        })
      ).json()
    ).data as { id: string; version: number };
  return { ws, projects, create };
}

const row = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title });

test.describe('Görevlerim ve görev detayı', () => {
  test('BR-INBOX-004 / BR-DATE-003: Görevlerim son tarihe göre gruplu; geciken tehlike renginde', async ({
    page,
  }) => {
    const { projects, create } = await setupUser(page);
    const ev = projects.find((p) => p.name === 'Ev')!;
    await create({
      title: 'Elektrik faturasını öde',
      projectId: ev.id,
      due: { date: '2026-01-05' },
      priority: 3,
    });
    await create({ title: 'Mobil görünüm testleri' });
    await page.goto('/my-tasks?group=date');
    await expect(page.getByRole('heading', { level: 2, name: /Geciken/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /Tarihsiz/ })).toBeVisible();
    // D-100: sütunlu satır — proje, tarih (gecikmişte tehlike renginde), öncelik rozeti.
    const overdue = row(page, 'Elektrik faturasını öde');
    await expect(overdue).toContainText('Ev');
    await expect(overdue).toContainText('5 Oca');
    await expect(overdue).toContainText('Yüksek');
    await expect(
      overdue.locator('.text-danger:visible', { hasText: '5 Oca' }).first(),
    ).toBeVisible();
    await expect(row(page, 'Mobil görünüm testleri')).toContainText('Projesiz');

    await page.getByRole('button', { name: 'Geciken grubunu daralt' }).click();
    await expect(row(page, 'Elektrik faturasını öde')).toHaveCount(0);
  });

  test('detay paneli: başlık, öncelik, etiketler ve alt görevler anında kaydedilir', async ({
    page,
  }) => {
    const { create } = await setupUser(page);
    const task = await create({ title: 'Ana sayfa tasarımı' });
    await page.goto(`/my-tasks?task=${task.id}`);
    const panel = page.getByRole('complementary', { name: 'Görev detayı' });
    await expect(panel).toBeVisible();

    await panel.getByLabel('Başlık').fill('Ana sayfa tasarımı v2');
    await panel.getByLabel('Başlık').press('Tab');
    await expect(page.getByText('Kaydedildi', { exact: false })).toBeVisible();
    await panel.getByLabel('Öncelik').selectOption('3');
    await expect(row(page, 'Ana sayfa tasarımı v2')).toContainText('Yüksek');

    await panel.getByRole('textbox', { name: 'Etiketler' }).fill('tasarım');
    await panel.getByRole('textbox', { name: 'Etiketler' }).press('Enter');
    await expect(panel.getByRole('button', { name: 'tasarım etiketini kaldır' })).toBeVisible();

    for (const title of ['İçerik hiyerarşisi', 'Mobil düzen']) {
      await panel.getByLabel('Alt görev ekle').fill(title);
      await panel.getByLabel('Alt görev ekle').press('Enter');
      await expect(panel.getByRole('link', { name: title })).toBeVisible();
    }
    await expect(row(page, 'Ana sayfa tasarımı v2')).toContainText('0/2 ⑂');

    // Kalıcı
    await page.reload();
    await expect(panel.getByLabel('Başlık')).toHaveValue('Ana sayfa tasarımı v2');
    await expect(panel.getByRole('button', { name: 'tasarım etiketini kaldır' })).toBeVisible();
  });

  test('BR-SUB-003: açık alt görevli görevi tamamlarken seçim sunulur', async ({ page }) => {
    const { create } = await setupUser(page);
    const parent = await create({ title: 'Ana görev' });
    await create({ title: 'Alt 1', parentTaskId: parent.id });
    await create({ title: 'Alt 2', parentTaskId: parent.id });
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Tamamla: Ana görev' }).click();
    const dialog = page.getByRole('dialog', { name: 'Alt görevler de tamamlansın mı?' });
    await expect(dialog).toContainText('2 alt görevin 0 tanesi tamamlandı');
    await dialog.getByRole('button', { name: 'Alt görevleri de tamamla' }).click();
    await expect(page.getByText('Görev tamamlandı.')).toBeVisible(); // sunucu yanıtı geldi
    // D-106: tamamlanan görev listede kalır.
    await expect(page.getByRole('button', { name: 'Yeniden aç: Ana görev' })).toBeVisible();

    await page.goto(`/my-tasks?task=${parent.id}`);
    const panel = page.getByRole('complementary', { name: 'Görev detayı' });
    await expect(panel.getByRole('button', { name: 'Yeniden aç' }).first()).toBeVisible();
    await expect(panel.getByText('2/2')).toBeVisible();
  });

  test('BR-INBOX-002: projesiz görev projeye taşınır; tarih ve öncelik korunur', async ({
    page,
  }) => {
    const { create } = await setupUser(page);
    await create({ title: 'Garanti belgesini bul', priority: 2, due: { date: '2026-12-01' } });
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');
    const target = row(page, 'Garanti belgesini bul');
    await target
      .getByRole('button', { name: /^Proje: / })
      .first()
      .click();
    await page.getByRole('button', { name: 'Ev', exact: true }).click();
    await expect(target).not.toContainText('Projesiz');
    await page.reload();
    await expect(target).toContainText('Ev');
    await expect(target).toContainText('1 Ara');
    await expect(target).toContainText('Orta');
  });

  test('D-106 / D-103: satır içi düzenleme, alt görev ekleme ve sütun filtresi anında kaydedilir', async ({
    page,
  }) => {
    const { create } = await setupUser(page);
    await create({ title: 'Raporu hazırla' });
    await create({ title: 'Toplantı ayarla', priority: 1 });
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');
    const target = row(page, 'Raporu hazırla');

    // Öncelik ve statü detay açmadan değişir.
    await target.getByRole('button', { name: 'Öncelik: Raporu hazırla' }).click();
    await page.getByRole('button', { name: 'Yüksek', exact: true }).click();
    await expect(target).toContainText('Yüksek');
    await target.getByRole('button', { name: 'Statü: Raporu hazırla' }).click();
    await page.getByRole('button', { name: 'Devam ediyor', exact: true }).click();
    await expect(target).toContainText('Devam ediyor');

    // Ad satır içinde düzenlenir.
    await target.getByRole('button', { name: 'Adı düzenle: Raporu hazırla' }).click();
    await page.getByLabel('Görev adı').fill('Raporu hazırla v2');
    await page.getByLabel('Görev adı').press('Enter');
    const renamed = row(page, 'Raporu hazırla v2');
    await expect(renamed).toBeVisible();

    // Alt görevler satır içinde eklenir.
    await renamed.getByRole('button', { name: 'Alt görevler: Raporu hazırla v2' }).click();
    const subInput = page.getByLabel('Raporu hazırla v2 için alt görev ekle');
    for (const title of ['Veri topla', 'Grafikleri çiz']) {
      await subInput.fill(title);
      await subInput.press('Enter');
      await expect(page.getByLabel(`Alt görev adı: ${title}`)).toBeVisible();
    }

    // Kalıcı: yeniden yüklemede de var.
    await page.reload();
    await expect(row(page, 'Raporu hazırla v2')).toContainText('Yüksek');
    await expect(row(page, 'Raporu hazırla v2')).toContainText('Devam ediyor');
    await expect(row(page, 'Raporu hazırla v2')).toContainText('0/2 ⑂');

    // D-107: statü bölümleri; Beklemede statüsü ve Notlar sütunu.
    await expect(page.getByRole('heading', { level: 2, name: /Devam ediyor/ })).toBeVisible();
    const meeting = row(page, 'Toplantı ayarla');
    await meeting.getByRole('button', { name: 'Notlar: Toplantı ayarla' }).click();
    await page.getByLabel('Görev notu').fill('Salı 14:00 uygun');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(meeting).toContainText('Salı 14:00 uygun');
    await meeting.getByRole('button', { name: 'Statü: Toplantı ayarla' }).click();
    await page.getByRole('button', { name: 'Beklemede', exact: true }).click();
    await expect(
      page
        .locator('section')
        .filter({ has: page.getByRole('heading', { level: 2, name: /Beklemede/ }) }),
    ).toContainText('Toplantı ayarla');
    await page.goto('/my-tasks');
    await expect(row(page, 'Toplantı ayarla')).toContainText('Salı 14:00 uygun');

    // Statü filtresi yalnızca eşleşenleri gösterir.
    await page.getByLabel('Statüye göre filtrele').selectOption('in_progress');
    await expect(row(page, 'Raporu hazırla v2')).toBeVisible();
    await expect(row(page, 'Toplantı ayarla')).toHaveCount(0);
  });

  test('/my-tasks ve açık detay paneli erişilebilirlik taraması (AC-11)', async ({ page }) => {
    const { create } = await setupUser(page);
    const task = await create({ title: 'Erişilebilirlik' });
    await create({ title: 'Alt', parentTaskId: task.id });
    await page.goto(`/my-tasks?task=${task.id}`);
    await expect(page.getByRole('complementary', { name: 'Görev detayı' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
