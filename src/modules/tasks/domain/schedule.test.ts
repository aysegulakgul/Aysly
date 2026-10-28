import { describe, expect, it } from 'vitest';
import { dueGroup, endOfWeek, todayIn } from './schedule';

// 2026-10-28 Çarşamba, İstanbul 12:00
const ctx = { today: '2026-10-28', now: new Date('2026-10-28T09:00:00Z'), weekStart: 1 };
const allDay = (date: string) => ({ date, time: null, timezone: null, at: null });

describe('BR-DATE-003: Görevlerim grupları', () => {
  it('tüm gün görev: dünden önceki gecikmiş, bugün gecikmiş değil', () => {
    expect(dueGroup(allDay('2026-10-27'), ctx)).toBe('overdue');
    expect(dueGroup(allDay('2026-10-28'), ctx)).toBe('today');
    expect(dueGroup(allDay('2026-10-29'), ctx)).toBe('tomorrow');
    expect(dueGroup(allDay('2026-11-01'), ctx)).toBe('thisWeek'); // Pazar, hafta pazartesi başlıyor
    expect(dueGroup(allDay('2026-11-02'), ctx)).toBe('later');
  });

  it('saatli görev: mutlak an geçtiyse bugün olsa da gecikmiş', () => {
    const past = {
      date: '2026-10-28',
      time: '10:00',
      timezone: 'Europe/Istanbul',
      at: new Date('2026-10-28T07:00:00Z'),
    };
    const future = { ...past, time: '14:00', at: new Date('2026-10-28T11:00:00Z') };
    expect(dueGroup(past, ctx)).toBe('overdue');
    expect(dueGroup(future, ctx)).toBe('today');
  });

  it('BR-DATE-004: tarihsiz görev ayrı grupta', () => {
    expect(dueGroup(null, ctx)).toBe('none');
  });

  it('hafta sonu hafta başlangıcına göre', () => {
    expect(endOfWeek('2026-10-28', 1)).toBe('2026-11-01');
    expect(endOfWeek('2026-10-28', 0)).toBe('2026-10-31');
    expect(endOfWeek('2026-11-01', 1)).toBe('2026-11-01');
  });
});

describe('AC-09: saat dilimi sınırı (TESTING_STRATEGY §6)', () => {
  const due = { date: '2026-10-15', time: null, timezone: null, at: null };
  it('İstanbul 15 Ekim 23:30’da tüm gün görev "Bugün", 16 Ekim 00:01’de "Geciken"dir', () => {
    const at2330 = new Date('2026-10-15T20:30:00Z'); // İstanbul 23:30
    const at0001 = new Date('2026-10-15T21:01:00Z'); // İstanbul 16 Ekim 00:01
    const ctx = (now: Date) => ({ today: todayIn('Europe/Istanbul', now), now, weekStart: 1 });
    expect(dueGroup(due, ctx(at2330))).toBe('today');
    expect(dueGroup(due, ctx(at0001))).toBe('overdue');
  });
});
