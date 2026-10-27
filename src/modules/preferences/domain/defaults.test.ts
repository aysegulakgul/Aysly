import { describe, expect, it } from 'vitest';
import { defaultPreferences } from './defaults';

describe('BR-PREF-001: varsayılan tercihler', () => {
  it('BR-PREF-001: Türkçede hafta pazartesi, tarih GG.AA.YYYY, saat 24 saat, tema sistem', () => {
    const prefs = defaultPreferences({ locale: 'tr', timezone: 'Europe/Istanbul' });
    expect(prefs).toMatchObject({
      locale: 'tr',
      timezone: 'Europe/Istanbul',
      weekStart: 1,
      dateFormat: 'DD.MM.YYYY',
      timeFormat: '24h',
      theme: 'system',
      defaultTaskView: 'list',
      allDayReminderTime: '09:00',
    });
  });

  it('BR-PREF-001: geçersiz saat dilimi Europe/Istanbul olur', () => {
    expect(defaultPreferences({ locale: 'tr', timezone: 'Mars/Olympus' }).timezone).toBe(
      'Europe/Istanbul',
    );
    expect(defaultPreferences({ locale: 'en', timezone: undefined }).timezone).toBe(
      'Europe/Istanbul',
    );
  });

  it('BR-PREF-001: tarayıcının geçerli saat dilimi korunur', () => {
    expect(defaultPreferences({ locale: 'en', timezone: 'America/New_York' }).timezone).toBe(
      'America/New_York',
    );
  });

  it('D-037: bildirimler yalnızca uygulama içi, hatırlatıcılar açık', () => {
    expect(defaultPreferences({ locale: 'tr', timezone: 'UTC' }).notificationSettings).toEqual({
      v: 1,
      reminder: { inApp: true },
    });
  });
});
