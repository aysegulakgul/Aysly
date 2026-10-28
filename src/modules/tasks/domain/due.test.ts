import { describe, expect, it } from 'vitest';
import { checkStartBeforeDue, isValidDate, prepareDue, zonedTimeToUtc } from './due';

describe('BR-DATE-001: tarih/saat saklama modeli', () => {
  it('saatli son tarih yerel saatten mutlak ana çevrilir', () => {
    expect(zonedTimeToUtc('2026-11-01', '10:00', 'Europe/Istanbul').toISOString()).toBe(
      '2026-11-01T07:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-07-01', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-07-01T13:00:00.000Z',
    );
  });

  it('tüm gün tarihin saat dilimi ve mutlak anı yoktur (yüzen tarih)', () => {
    expect(prepareDue({ date: '2026-10-15' })).toEqual({
      due: { date: '2026-10-15', time: null, timezone: null, at: null },
      issues: [],
    });
  });

  it('saat varsa geçerli saat dilimi zorunludur; geçersiz tarih ve saat reddedilir', () => {
    expect(prepareDue({ date: '2026-10-15', time: '10:00' }).issues).toEqual([
      { field: 'due.timezone', reason: 'required' },
    ]);
    expect(prepareDue({ date: '2026-10-15', time: '10:00', timezone: 'Mars/Base' }).issues).toEqual(
      [{ field: 'due.timezone', reason: 'invalid' }],
    );
    expect(prepareDue({ date: '2026-02-30' }).issues).toEqual([
      { field: 'due.date', reason: 'invalid' },
    ]);
    expect(
      prepareDue({ date: '2026-10-15', time: '24:00', timezone: 'Europe/Istanbul' }).issues,
    ).toEqual([{ field: 'due.time', reason: 'invalid' }]);
    expect(isValidDate('2028-02-29')).toBe(true);
  });
});

describe('BR-DATE-006: yaz saati geçişleri', () => {
  it('ileri almada var olmayan saat bir sonraki geçerli dakikaya kayar (02:30 → 03:00)', () => {
    expect(zonedTimeToUtc('2026-03-08', '02:30', 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:00:00.000Z', // 03:00 EDT
    );
  });

  it('geri almada iki kez yaşanan saatte ilk gerçekleşme seçilir (01:30 EDT)', () => {
    expect(zonedTimeToUtc('2026-11-01', '01:30', 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('Avrupa geçişleri de doğru hesaplanır', () => {
    expect(zonedTimeToUtc('2026-03-29', '02:30', 'Europe/Berlin').toISOString()).toBe(
      '2026-03-29T01:00:00.000Z', // 03:00 CEST
    );
    expect(zonedTimeToUtc('2026-10-25', '02:30', 'Europe/Berlin').toISOString()).toBe(
      '2026-10-25T00:30:00.000Z', // ilk 02:30 (CEST)
    );
  });
});

describe('BR-DATE-002: başlangıç tarihi son tarihten sonra olamaz', () => {
  const due = { date: '2026-10-15', time: null, timezone: null, at: null };
  it('başlangıç son tarihten sonraysa reddedilir; eşit veya önce kabul edilir', () => {
    expect(checkStartBeforeDue('2026-10-16', due)).toEqual([
      { field: 'startDate', reason: 'after_due_date' },
    ]);
    expect(checkStartBeforeDue('2026-10-15', due)).toEqual([]);
    expect(checkStartBeforeDue('2026-10-20', null)).toEqual([]);
  });
});
