import { describe, expect, it } from 'vitest';
import {
  parseOnboarding,
  recordSkip,
  restartOnboarding,
  sampleProjects,
  shouldOfferOnboarding,
  starterLayout,
} from './onboarding';

const t0 = new Date('2026-10-28T09:00:00Z');
const later = new Date('2026-10-29T09:00:00Z');

describe('onboarding durumu (ONBOARDING §2)', () => {
  it('kayıttaki { v: 1 } ve bozuk değerler varsayılanla okunur', () => {
    expect(parseOnboarding({ v: 1 })).toEqual({
      v: 1,
      status: 'pending',
      intents: [],
      skips: 0,
      samplesCreated: false,
      checklist: { dismissed: false, shortcutsSeen: false },
    });
    expect(parseOnboarding('bozuk').status).toBe('pending');
  });

  it('tamamlanmadıysa önerilir; tamamlandıysa önerilmez', () => {
    const state = parseOnboarding({ v: 1 });
    expect(shouldOfferOnboarding(state, t0)).toBe(true);
    expect(shouldOfferOnboarding({ ...state, status: 'completed' }, t0)).toBe(false);
  });

  it('bir kez atlanınca aynı oturumda değil, sonraki girişte bir kez daha önerilir; ikinci atlamadan sonra hiç', () => {
    const once = recordSkip(parseOnboarding({ v: 1 }), t0);
    expect(shouldOfferOnboarding(once, new Date('2026-10-28T08:00:00Z'))).toBe(false); // aynı oturum
    expect(shouldOfferOnboarding(once, later)).toBe(true); // yeni giriş
    const twice = recordSkip(once, later);
    expect(shouldOfferOnboarding(twice, new Date('2026-11-01T00:00:00Z'))).toBe(false);
  });

  it('yeniden başlatma atlamaları sıfırlar, örnek projelerin oluşturulduğu bilgisini korur', () => {
    const state = {
      ...recordSkip(parseOnboarding({ v: 1 }), t0),
      samplesCreated: true,
      checklist: { dismissed: true, shortcutsSeen: true },
    };
    expect(restartOnboarding(state)).toEqual({
      v: 1,
      status: 'pending',
      intents: [],
      skips: 0,
      samplesCreated: true,
      checklist: { dismissed: true, shortcutsSeen: true }, // yeniden başlatma listeyi sıfırlamaz
    });
  });
});

describe('amaca göre başlangıç düzeni (ONBOARDING §3)', () => {
  const visible = (intents: ('personal' | 'work')[]) =>
    starterLayout(intents)
      .widgets.filter((w) => w.visible)
      .map((w) => w.id);

  it('widget sırası seçime göre; gizlenenler sona eklenir', () => {
    expect(visible(['personal'])).toEqual(['today', 'overdue', 'upcoming', 'goals']);
    expect(visible(['work'])).toEqual(['today', 'overdue', 'priority', 'projects', 'upcoming']);
    expect(visible(['personal', 'work'])).toEqual([
      'today',
      'overdue',
      'upcoming',
      'projects',
      'goals',
    ]);
    expect(visible([])).toEqual(['today', 'overdue', 'upcoming', 'priority', 'projects', 'goals']);
    expect(starterLayout(['personal']).widgets).toHaveLength(6);
  });

  it('örnek projeler kullanıcının dilinde; örnek görev yok', () => {
    expect(sampleProjects(['personal'], 'tr').map((p) => p.name)).toEqual([
      'Ev',
      'Sağlık',
      'Kişisel gelişim',
    ]);
    expect(sampleProjects(['work'], 'tr')).toEqual([
      { name: 'İş', description: 'Her müşteri/iş için ayrı proje oluşturabilirsin.' },
    ]);
    expect(sampleProjects(['work', 'personal'], 'en').map((p) => p.name)).toEqual(['Home', 'Work']);
    expect(sampleProjects([], 'tr')).toEqual([]);
  });
});
