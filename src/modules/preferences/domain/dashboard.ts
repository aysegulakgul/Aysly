import { DEFAULT_WIDGETS } from './defaults';

/** FR-DASH widget türleri (sabit liste, BR-DASH-001). */
export const WIDGETS = DEFAULT_WIDGETS;
export type DashboardLayout = { v: 1; widgets: { id: string; visible: boolean }[] };

/**
 * BR-DASH-001: bilinmeyen widget kimlikleri yok sayılır; listede olmayan (yeni) widget'lar sona gizli eklenir;
 * tekrarlar atılır.
 */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const input =
    raw && typeof raw === 'object' && Array.isArray((raw as DashboardLayout).widgets)
      ? (raw as DashboardLayout).widgets
      : [];
  const seen = new Set<string>();
  const widgets: DashboardLayout['widgets'] = [];
  for (const w of input) {
    if (!w || typeof w.id !== 'string' || !WIDGETS.includes(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    widgets.push({ id: w.id, visible: w.visible === true });
  }
  for (const id of WIDGETS) if (!seen.has(id)) widgets.push({ id, visible: false });
  return { v: 1, widgets };
}
