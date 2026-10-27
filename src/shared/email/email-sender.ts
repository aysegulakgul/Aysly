/**
 * E-posta portu (ARCHITECTURE §3.9). MVP'de yalnızca güvenlik e-postaları gönderilir: doğrulama, şifre sıfırlama,
 * "şifren değişti" (D-055, D-062). Yerelde e-postalar dışarı çıkmaz; Mailpit'te görüntülenir (D-056).
 */
export type EmailMessage = { to: string; subject: string; text: string; html?: string };

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Testler için bellek içi adaptör. */
export function createMemoryEmailSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}
