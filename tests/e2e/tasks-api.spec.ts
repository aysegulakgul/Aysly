import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

const origin = { origin: E2E_BASE_URL };
let seq = 0;
const key = () => `e2e-${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 8)}`;

async function workspaceOf(api: APIRequestContext): Promise<string> {
  const list = (await (await api.get('/api/v1/workspaces')).json()).data;
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ type: 'personal', role: 'owner' });
  return list[0].id;
}

async function newUserApi(browser: Browser) {
  const context = await browser.newContext({ locale: 'tr-TR' });
  const page = await context.newPage();
  await signUp(page);
  return { context, api: page.request, ws: await workspaceOf(page.request) };
}

test.describe('Görev API (API_CONTRACTS §6)', () => {
  test('oluşturma: Inbox varsayılanı, idempotency, doğrulama', async ({ browser }) => {
    const { context, api, ws } = await newUserApi(browser);
    const url = `/api/v1/workspaces/${ws}/tasks`;

    // BR-TASK-007: anahtar zorunlu
    const noKey = await api.post(url, { data: { title: 'Fatura öde' }, headers: origin });
    expect(noKey.status()).toBe(400);

    const k = key();
    const body = {
      title: 'Fatura öde',
      due: { date: '2026-11-01', time: '10:00', timezone: 'Europe/Istanbul' },
    };
    const first = await api.post(url, { data: body, headers: { ...origin, 'idempotency-key': k } });
    expect(first.status()).toBe(201);
    const task = (await first.json()).data;
    expect(task).toMatchObject({
      title: 'Fatura öde',
      status: 'todo',
      priority: 0,
      due: {
        date: '2026-11-01',
        time: '10:00',
        timezone: 'Europe/Istanbul',
        at: '2026-11-01T07:00:00.000Z',
      },
      version: 1,
    });
    // Aynı anahtarla tekrar → aynı görev, ikinci kayıt yok
    const replay = await api.post(url, {
      data: body,
      headers: { ...origin, 'idempotency-key': k },
    });
    expect((await replay.json()).data.id).toBe(task.id);
    const reused = await api.post(url, {
      data: { title: 'Başka' },
      headers: { ...origin, 'idempotency-key': k },
    });
    expect(reused.status()).toBe(422);
    expect((await reused.json()).error.code).toBe('IDEMPOTENCY_KEY_REUSED');

    // Bilinmeyen alan ve boş başlık
    expect(
      (
        await api.post(url, {
          data: { title: 'x', color: 'red' },
          headers: { ...origin, 'idempotency-key': key() },
        })
      ).status(),
    ).toBe(400);
    const blank = await api.post(url, {
      data: { title: '  ' },
      headers: { ...origin, 'idempotency-key': key() },
    });
    expect((await blank.json()).error.details).toEqual([{ field: 'title', reason: 'required' }]);

    const list = (await (await api.get(url)).json()).data;
    expect(list.map((t: { id: string }) => t.id)).toEqual([task.id]);
    await context.close();
  });

  test('güncelleme, sürüm çakışması, tamamlama ve yeniden açma', async ({ browser }) => {
    const { context, api, ws } = await newUserApi(browser);
    const url = `/api/v1/workspaces/${ws}/tasks`;
    const task = (
      await (
        await api.post(url, {
          data: { title: 'A' },
          headers: { ...origin, 'idempotency-key': key() },
        })
      ).json()
    ).data;

    const patched = await api.patch(`${url}/${task.id}`, {
      data: { version: 1, title: 'B', priority: 3, status: 'in_progress' },
      headers: origin,
    });
    expect((await patched.json()).data).toMatchObject({
      title: 'B',
      priority: 3,
      status: 'in_progress',
      version: 2,
    });

    const stale = await api.patch(`${url}/${task.id}`, {
      data: { version: 1, title: 'C' },
      headers: origin,
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.current).toMatchObject({ title: 'B', version: 2 });

    const done = await api.post(`${url}/${task.id}/complete`, {
      data: { version: 2 },
      headers: origin,
    });
    expect((await done.json()).data).toMatchObject({ status: 'done', version: 3 });
    expect((await done.json()).data.completedAt).not.toBeNull();
    // Varsayılan liste açık görevleri gösterir
    expect((await (await api.get(url)).json()).data).toHaveLength(0);
    expect((await (await api.get(`${url}?status=done`)).json()).data).toHaveLength(1);

    const reopened = await api.post(`${url}/${task.id}/reopen`, {
      data: { version: 3 },
      headers: origin,
    });
    expect((await reopened.json()).data).toMatchObject({ status: 'todo', completedAt: null });
    await context.close();
  });

  test('BR-PERM-001: başka kullanıcının alanı ve görevi 404', async ({ browser }) => {
    const a = await newUserApi(browser);
    const b = await newUserApi(browser);
    const task = (
      await (
        await a.api.post(`/api/v1/workspaces/${a.ws}/tasks`, {
          data: { title: 'Gizli' },
          headers: { ...origin, 'idempotency-key': key() },
        })
      ).json()
    ).data;

    expect((await b.api.get(`/api/v1/workspaces/${a.ws}/tasks`)).status()).toBe(404);
    expect((await b.api.get(`/api/v1/workspaces/${a.ws}/tasks/${task.id}`)).status()).toBe(404);
    // Kendi alan kimliğiyle başkasının görevi de 404
    expect((await b.api.get(`/api/v1/workspaces/${b.ws}/tasks/${task.id}`)).status()).toBe(404);
    const write = await b.api.post(`/api/v1/workspaces/${b.ws}/tasks/${task.id}/complete`, {
      data: { version: 1 },
      headers: origin,
    });
    expect(write.status()).toBe(404);
    const still = (await (await a.api.get(`/api/v1/workspaces/${a.ws}/tasks/${task.id}`)).json())
      .data;
    expect(still).toMatchObject({ status: 'todo', version: 1 });
    await a.context.close();
    await b.context.close();
  });
});
