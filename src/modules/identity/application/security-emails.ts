import type { EmailMessage } from '@/shared/email/email-sender';

/**
 * MVP'de gönderilen güvenlik e-postaları (D-055): doğrulama, şifre sıfırlama, "şifren değişti".
 * Kayıt denemesi bildirimi ve hesap silme onayı MVP'de yok (D-062).
 */
export type SecurityEmailKind = 'verify' | 'reset' | 'passwordChanged';

export type EmailTextSource = (key: string) => string;

export function buildSecurityEmail(
  kind: SecurityEmailKind,
  text: EmailTextSource,
  recipient: { email: string; name: string },
  url?: string,
): EmailMessage {
  const fill = (template: string) =>
    template.replaceAll('{name}', recipient.name).replaceAll('{url}', url ?? '');
  return {
    to: recipient.email,
    subject: text(`email.${kind}.subject`),
    text: fill(text(`email.${kind}.body`)),
  };
}
