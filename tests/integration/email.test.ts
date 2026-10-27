import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSmtpEmailSender } from '@/shared/email/smtp-email-sender';

/**
 * E-posta yerelde dışarı çıkmaz; Mailpit'te görüntülenir (D-055, D-056).
 * Geçici bir Mailpit konteyneri açılır; çalışan geliştirme Mailpit'ine dokunulmaz.
 */
let mailpit: StartedTestContainer;
let apiBase: string;

beforeAll(async () => {
  mailpit = await new GenericContainer('axllent/mailpit:latest')
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp('/api/v1/messages', 8025))
    .start();
  apiBase = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}/api/v1`;
});

afterAll(async () => {
  await mailpit?.stop();
});

describe('SMTP e-posta adaptörü', () => {
  it('gönderilen e-posta yerel yakalayıcıda görünür', async () => {
    const sender = createSmtpEmailSender({
      host: mailpit.getHost(),
      port: mailpit.getMappedPort(1025),
      from: 'Aysly <no-reply@aysly.local>',
    });
    await sender.send({
      to: 'deneme@example.test',
      subject: 'Aysly test e-postası',
      text: 'Merhaba, bu bir test e-postasıdır. Türkçe karakterler: ğüşıöç',
    });

    const response = await fetch(`${apiBase}/messages`);
    const body = (await response.json()) as {
      messages: { Subject: string; To: { Address: string }[]; ID: string }[];
    };
    expect(body.messages).toHaveLength(1);
    const [message] = body.messages;
    expect(message?.Subject).toBe('Aysly test e-postası');
    expect(message?.To[0]?.Address).toBe('deneme@example.test');

    const detail = (await (await fetch(`${apiBase}/message/${message?.ID}`)).json()) as {
      Text: string;
    };
    expect(detail.Text).toContain('ğüşıöç');
  });
});
