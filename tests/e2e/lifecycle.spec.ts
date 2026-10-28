import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

const origin = { origin: E2E_BASE_URL };

async function setup(page: Page) {
  await signUp(page);
  const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
  const create = async (body: Record<string, unknown>) =>
    (
      await (
        await page.request.post(`/api/v1/workspaces/${ws}/tasks`, {
          data: body,
          headers: {
            ...origin,
            'idempotency-key': `lc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          },
        })
      ).json()
    ).data as { id: string; version: number };
  return { ws, create };
}

test.describe('Arşiv ve çöp kutusu', () => {
  test('BR-DEL-002: arşivlenen görev listeden çıkar, salt okunurdur; arşivden çıkarılınca döner', async ({
    page,
  }) => {
    const { create } = await setup(page);
    const task = await create({ title: 'Arşivlenecek görev' });
    await page.goto(`/inbox?task=${task.id}`);
    const panel = page.getByRole('complementary', { name: 'Görev detayı' });
    await panel.getByRole('button', { name: 'Diğer işlemler' }).click();
    await page.getByRole('button', { name: 'Arşivle', exact: true }).click();
    await expect(panel.getByText('Bu görev arşivde', { exact: false })).toBeVisible();
    await expect(panel.getByLabel('Başlık')).toBeDisabled();
    await expect(
      page.getByRole('main').getByRole('listitem').filter({ hasText: 'Arşivlenecek görev' }),
    ).toHaveCount(0);

    await panel.getByRole('button', { name: 'Arşivden çıkar' }).click();
    await expect(panel.getByLabel('Başlık')).toBeEnabled();
    await expect(
      page.getByRole('main').getByRole('listitem').filter({ hasText: 'Arşivlenecek görev' }),
    ).toBeVisible();
  });

  test('BR-DEL-006/007: çöpe taşınan görev ve alt görevi birlikte geri yüklenir', async ({
    page,
  }) => {
    const { ws, create } = await setup(page);
    const parent = await create({ title: 'Silinecek görev' });
    await create({ title: 'Alt görev', parentTaskId: parent.id });
    await page.goto(`/inbox?task=${parent.id}`);
    const panel = page.getByRole('complementary', { name: 'Görev detayı' });
    await panel.getByRole('button', { name: 'Diğer işlemler' }).click();
    await page.getByRole('button', { name: 'Çöpe taşı' }).click();
    await expect(
      panel.getByText('Bu görev çöp kutusunda. 30 gün içinde', { exact: false }),
    ).toBeVisible();

    const trash = (await (await page.request.get(`/api/v1/workspaces/${ws}/trash`)).json()).data;
    expect(trash).toMatchObject([{ root: { title: 'Silinecek görev' }, count: 2, daysLeft: 30 }]);

    await panel.getByRole('button', { name: 'Geri yükle' }).click();
    await expect(panel.getByText('Bu görev çöp kutusunda', { exact: false })).toHaveCount(0);
    await expect(
      page.getByRole('main').getByRole('listitem').filter({ hasText: 'Silinecek görev' }),
    ).toContainText('0/1 alt görev');
  });

  test('BR-DEL-005: kalıcı silme onay ister; çöpteki göreve API ile doğrudan erişim 404', async ({
    page,
  }) => {
    const { ws, create } = await setup(page);
    const task = await create({ title: 'Kalıcı silinecek' });
    const del = await page.request.delete(`/api/v1/workspaces/${ws}/tasks/${task.id}`, {
      headers: origin,
    });
    const { batchId } = (await del.json()).data;
    expect((await page.request.get(`/api/v1/workspaces/${ws}/tasks/${task.id}`)).status()).toBe(
      404,
    );
    expect(
      (
        await page.request.get(`/api/v1/workspaces/${ws}/tasks/${task.id}?includeDeleted=true`)
      ).status(),
    ).toBe(200);

    const noConfirm = await page.request.delete(`/api/v1/workspaces/${ws}/trash/${batchId}`, {
      data: {},
      headers: origin,
    });
    expect(noConfirm.status()).toBe(400);
    const purged = await page.request.delete(`/api/v1/workspaces/${ws}/trash/${batchId}`, {
      data: { confirm: true },
      headers: origin,
    });
    expect((await purged.json()).data).toEqual({ purged: 1 });
    expect(
      (
        await page.request.get(`/api/v1/workspaces/${ws}/tasks/${task.id}?includeDeleted=true`)
      ).status(),
    ).toBe(404);
  });
});
