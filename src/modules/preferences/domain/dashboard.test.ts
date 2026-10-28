import { describe, expect, it } from 'vitest';
import { normalizeLayout } from './dashboard';

describe('BR-DASH-001: widget düzeni', () => {
  it('bilinmeyen kimlikler ve tekrarlar atılır; eksik widget sona gizli eklenir', () => {
    const layout = normalizeLayout({
      v: 1,
      widgets: [
        { id: 'upcoming', visible: true },
        { id: 'eski-widget', visible: true },
        { id: 'upcoming', visible: false },
        { id: 'today', visible: false },
      ],
    });
    expect(layout.widgets.slice(0, 2)).toEqual([
      { id: 'upcoming', visible: true },
      { id: 'today', visible: false },
    ]);
    expect(layout.widgets).toHaveLength(6);
    expect(layout.widgets.slice(2).every((w) => !w.visible)).toBe(true);
  });

  it('bozuk değer varsayılan sırayla, gizli olarak okunur', () => {
    expect(normalizeLayout('bozuk').widgets.map((w) => w.id)).toEqual([
      'today',
      'overdue',
      'upcoming',
      'priority',
      'projects',
      'goals',
    ]);
  });
});
