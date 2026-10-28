import { expect, type Page } from '@playwright/test';
import { E2E_BASE_URL, MAILPIT_API } from './e2e-env';

export const PASSWORD = 'ayisigi gece 2026';
export const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ornek.test`;

/**
 * Arayüzden kayıt olur; kullanıcı hemen uygulamaya girer (D-040) ve onboarding açılır (ONBOARDING §2).
 * Varsayılan olarak onboarding API üzerinden amaç seçilmeden tamamlanır ve ana sayfaya gidilir;
 * onboarding testleri `keepOnboarding` ile rehberde kalır.
 */
export async function signUp(
  page: Page,
  email = uniqueEmail(),
  name = 'E2E Kullanıcı',
  options: { keepOnboarding?: boolean } = {},
) {
  await page.goto('/sign-up');
  await page.getByLabel('Ad').fill(name);
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(PASSWORD);
  await page.getByRole('button', { name: 'Kayıt ol' }).click();
  await expect(page).toHaveURL('/onboarding');
  if (options.keepOnboarding) return email;
  const done = await page.request.post('/api/v1/me/onboarding', {
    data: { intents: [], createSamples: false },
    headers: { origin: E2E_BASE_URL },
  });
  expect(done.ok()).toBe(true);
  await page.goto('/');
  await expect(page).toHaveURL('/');
  return email;
}

type MailSummary = { ID: string; Subject: string; To: { Address: string }[] };

/** Mailpit'te belirli alıcıya giden, konusu eşleşen e-postayı bekler ve metnini döner. */
export async function waitForEmail(to: string, subject: RegExp): Promise<string> {
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

/** Mailpit e-postasındaki ilk bağlantı. */
export const firstLink = (body: string) => body.match(/https?:\/\/\S+/)?.[0] ?? '';

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-in');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL('/');
}
