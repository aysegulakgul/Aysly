import { describe, expect, it } from 'vitest';
import { isUuid, uuidv7 } from './id';

describe('uuidv7 (D-015)', () => {
  it('RFC 9562 sürüm 7 ve varyant bitlerini taşır', () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('ilk 48 bit milisaniye zaman damgasıdır, bu yüzden zamana göre sıralanır', () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_000_001);
    expect(earlier < later).toBe(true);
    expect(parseInt(earlier.replace(/-/g, '').slice(0, 12), 16)).toBe(1_700_000_000_000);
  });

  it('aynı milisaniyede üretilen kimlikler farklıdır', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(1_700_000_000_000)));
    expect(ids.size).toBe(1000);
  });

  it('geçersiz biçimleri reddeder', () => {
    expect(isUuid('abc')).toBe(false);
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(false);
  });
});
