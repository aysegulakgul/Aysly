import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'ayisigi gece 2026';
export const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ornek.test`;

/** Arayüzden kayıt olur; kullanıcı hemen uygulamaya girer (D-040). */
export async function signUp(page: Page, email = uniqueEmail(), name = 'E2E Kullanıcı') {
  await page.goto('/sign-up');
  await page.getByLabel('Ad').fill(name);
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(PASSWORD);
  await page.getByRole('button', { name: 'Kayıt ol' }).click();
  await expect(page).toHaveURL('/');
  return email;
}
