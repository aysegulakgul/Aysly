import { describe, expect, it } from 'vitest';
import { dayPart, firstName, longDate, timeZoneCity } from './time-display';

describe('ekran zamanı (kullanıcının saat dilimi)', () => {
  it('günün bölümü kullanıcının saat dilimine göre hesaplanır', () => {
    const utc0630 = new Date('2026-10-28T06:30:00Z');
    expect(dayPart(utc0630, 'Europe/Istanbul')).toBe('morning'); // 09:30
    expect(dayPart(utc0630, 'America/New_York')).toBe('night'); // 02:30
    expect(dayPart(new Date('2026-10-28T12:00:00Z'), 'Europe/Istanbul')).toBe('day'); // 15:00
    expect(dayPart(new Date('2026-10-28T16:00:00Z'), 'Europe/Istanbul')).toBe('evening'); // 19:00
  });

  it('gece yarısına yakın saatte tarih kullanıcının gününe göre yazılır', () => {
    const utc2230 = new Date('2026-10-28T22:30:00Z'); // İstanbul'da 29 Ekim 01:30
    expect(longDate(utc2230, 'tr', 'Europe/Istanbul')).toBe('29 Ekim 2026');
    expect(longDate(utc2230, 'tr', 'Europe/Istanbul', true)).toBe('29 Ekim 2026 Perşembe');
    expect(longDate(utc2230, 'en', 'UTC')).toBe('October 28, 2026');
  });

  it('şehir adı ve ilk ad', () => {
    expect(timeZoneCity('Europe/Istanbul')).toBe('Istanbul');
    expect(timeZoneCity('America/New_York')).toBe('New York');
    expect(firstName('  Elif Yılmaz ')).toBe('Elif');
  });
});
