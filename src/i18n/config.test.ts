import { describe, expect, it } from 'vitest';
import { negotiateLocale } from './config';
import en from './messages/en.json';
import tr from './messages/tr.json';

describe('dil seçimi (D-038, BR-PREF-001)', () => {
  it('desteklenen dili tarayıcı tercih sırasına göre seçer', () => {
    expect(negotiateLocale('en-US,en;q=0.9,tr;q=0.8')).toBe('en');
    expect(negotiateLocale('de-DE,tr;q=0.7,en;q=0.5')).toBe('tr');
  });

  it('desteklenmeyen veya eksik dilde Türkçeye düşer', () => {
    expect(negotiateLocale('de-DE,fr;q=0.9')).toBe('tr');
    expect(negotiateLocale(null)).toBe('tr');
  });
});

/** İki dil dosyasının anahtarları birebir aynı olmalı; eksik çeviri sessizce geçmesin (NFR-10). */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('çeviri dosyaları', () => {
  it('tr ve en aynı anahtarlara sahiptir', () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });
});
