import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const valid = { DATABASE_URL: 'postgres://u:p@127.0.0.1:5433/aysly' };

describe('ortam değişkenleri (ARCHITECTURE §12.2)', () => {
  it('geçerli değerleri varsayılanlarla tamamlar', () => {
    const env = parseEnv(valid);
    expect(env.APP_BASE_URL).toBe('http://localhost:3000');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SCHEDULER_ENABLED).toBe(true);
  });

  it('DATABASE_URL yoksa başlamaz', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('hata mesajında değerleri değil yalnızca alan adlarını gösterir', () => {
    const secret = 'mysql://gizli-sifre@host/db';
    expect(() => parseEnv({ DATABASE_URL: secret })).toThrow(/DATABASE_URL/);
    try {
      parseEnv({ DATABASE_URL: secret });
    } catch (error) {
      expect((error as Error).message).not.toContain('gizli-sifre');
    }
  });

  it('SCHEDULER_ENABLED=false ile zamanlayıcı kapatılabilir', () => {
    expect(parseEnv({ ...valid, SCHEDULER_ENABLED: 'false' }).SCHEDULER_ENABLED).toBe(false);
  });
});
