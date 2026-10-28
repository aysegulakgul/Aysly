import { describe, expect, it } from 'vitest';
import {
  addDays,
  monthGrid,
  nextWeekStart,
  offsetLabel,
  shortDate,
  shortTime,
  todayIn,
  weekdayNames,
} from './dates';

describe('görev tarih yardımcıları', () => {
  it('BR-DATE-003: bugün kullanıcının saat dilimine göre', () => {
    const utc2230 = new Date('2026-10-28T22:30:00Z');
    expect(todayIn('Europe/Istanbul', utc2230)).toBe('2026-10-29');
    expect(todayIn('America/New_York', utc2230)).toBe('2026-10-28');
  });

  it('gün ekleme ay ve yıl sınırını aşar', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('gelecek hafta: hafta başlangıcına göre sonraki haftanın ilk günü', () => {
    // 2026-10-28 Çarşamba
    expect(nextWeekStart('2026-10-28', 1)).toBe('2026-11-02'); // Pazartesi
    expect(nextWeekStart('2026-10-28', 0)).toBe('2026-11-01'); // Pazar
    expect(nextWeekStart('2026-11-02', 1)).toBe('2026-11-09'); // bugün pazartesiyse bir sonraki
  });

  it('ay ızgarası hafta başlangıcına göre hizalanır', () => {
    const grid = monthGrid(2026, 9, 1); // Ekim 2026, 1 Ekim Perşembe
    expect(grid.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(grid.length % 7).toBe(0);
    expect(grid.filter(Boolean)).toHaveLength(31);
    expect(monthGrid(2026, 9, 0)[4]).toBe('2026-10-01');
  });

  it('kısa tarih, saat ve gün adları dile göre', () => {
    expect(shortDate('2026-10-19', 'tr')).toBe('19 Eki');
    expect(shortDate('2026-10-19', 'en')).toBe('Oct 19');
    expect(shortTime('14:05', 'tr', '24h')).toBe('14:05');
    expect(shortTime('14:05', 'en', '12h')).toMatch(/02:05\sPM/);
    expect(weekdayNames('tr', 1)[0]).toBe('Pzt');
    expect(offsetLabel('Europe/Istanbul', new Date('2026-10-28T00:00:00Z'))).toBe('UTC+3');
  });
});
