import { describe, expect, it } from 'vitest';
import { formatRule, nextOccurrence, parseRule, type RecurrenceRule } from './recurrence';

const rule = (text: string): RecurrenceRule => {
  const r = parseRule(text);
  if (!r.ok) throw new Error(`geçersiz: ${text}`);
  return r.value;
};
const next = (
  text: string,
  anchor: string,
  today = anchor,
  index = 1,
  mode: 'fixed_schedule' | 'after_completion' = 'fixed_schedule',
) => nextOccurrence(rule(text), mode, { anchor, index, today });

describe('tekrar kuralı (BR-REC-002/003/005)', () => {
  it('BR-REC-003: desteklenen kalıplar ayrıştırılır, kanonik biçime döner; desteklenmeyenler reddedilir', () => {
    expect(formatRule(rule('freq=weekly;byday=we,mo;interval=2'))).toBe(
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE',
    );
    expect(formatRule(rule('FREQ=MONTHLY;BYDAY=-1FR;COUNT=5'))).toBe(
      'FREQ=MONTHLY;BYDAY=-1FR;COUNT=5',
    );
    for (const bad of [
      'FREQ=HOURLY',
      'FREQ=DAILY;BYHOUR=9',
      'FREQ=DAILY;INTERVAL=0',
      'FREQ=WEEKLY;BYDAY=XX',
      'FREQ=DAILY;UNTIL=20261301',
      'FREQ=DAILY;UNTIL=20261231;COUNT=3',
      'FREQ=MONTHLY;BYMONTHDAY=32',
      'FREQ=DAILY;BYMONTHDAY=3',
    ]) {
      expect(parseRule(bad).ok, bad).toBe(false);
    }
  });

  it('BR-REC-002 kabul: her pazartesi, 2026-10-12 planlı görev 2026-10-15’te tamamlanınca 2026-10-19', () => {
    expect(next('FREQ=WEEKLY;BYDAY=MO', '2026-10-12', '2026-10-15')).toBe('2026-10-19');
  });

  it('BR-REC-002: fixed_schedule geçmişte kalan tarihleri atlar; bugün de seçilebilir', () => {
    expect(next('FREQ=DAILY', '2026-10-01', '2026-10-20')).toBe('2026-10-20');
    expect(next('FREQ=WEEKLY;BYDAY=MO', '2026-09-07', '2026-10-15')).toBe('2026-10-19');
  });

  it('AC-04: after_completion — tamamlandıktan 3 gün sonra (15 Ekim → 18 Ekim)', () => {
    expect(next('FREQ=DAILY;INTERVAL=3', '2026-10-10', '2026-10-15', 1, 'after_completion')).toBe(
      '2026-10-18',
    );
  });

  it('haftalık birden çok gün ve 2 haftada bir', () => {
    expect(next('FREQ=WEEKLY;BYDAY=MO,WE', '2026-10-12')).toBe('2026-10-14');
    expect(next('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', '2026-10-14')).toBe('2026-10-26');
  });

  it('BR-REC-005: ay sonu taşması ve 29 Şubat', () => {
    expect(next('FREQ=MONTHLY;BYMONTHDAY=31', '2026-01-31')).toBe('2026-02-28');
    expect(next('FREQ=MONTHLY;BYMONTHDAY=31', '2026-02-28')).toBe('2026-03-31');
    expect(next('FREQ=YEARLY', '2028-02-29')).toBe('2029-02-28');
  });

  it('aylık n. hafta günü: ayın son cuması, her ayın 2. salısı', () => {
    expect(next('FREQ=MONTHLY;BYDAY=-1FR', '2026-10-30')).toBe('2026-11-27');
    expect(next('FREQ=MONTHLY;BYDAY=2TU', '2026-10-13')).toBe('2026-11-10');
  });

  it('bitiş: UNTIL sonrası ve COUNT dolunca örnek üretilmez', () => {
    expect(next('FREQ=DAILY;UNTIL=20261020', '2026-10-20')).toBeNull();
    expect(next('FREQ=DAILY;UNTIL=20261021', '2026-10-20')).toBe('2026-10-21');
    expect(next('FREQ=DAILY;COUNT=3', '2026-10-20', '2026-10-20', 3)).toBeNull();
    expect(next('FREQ=DAILY;COUNT=3', '2026-10-20', '2026-10-20', 2)).toBe('2026-10-21');
  });
});
