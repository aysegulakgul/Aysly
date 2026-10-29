import type { FieldIssue } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';

/** BR-PROJ-002: proje durumu arşivden ayrıdır. */
export const PROJECT_STATUSES = ['active', 'on_hold', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** UI_UX §2.4, D-082: sabit 12 renklik palet; serbest HEX yok. Simge MVP'de seçilmez. */
export const PROJECT_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
  'brown',
] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export type Project = {
  id: string;
  workspaceId: string;
  kind: 'inbox' | 'standard';
  name: string;
  description: string | null;
  color: ProjectColor;
  status: ProjectStatus;
  position: string;
  archivedAt: Date | null;
  deletedAt: Date | null;
  deletedBatchId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export const NAME_MAX = 120;
export const DESCRIPTION_MAX = 5_000;

/** BR-PROJ-001: ad kırpılır, satır sonları boşluğa çevrilir; 1–120 karakter. Aynı adlı projelere izin verilir. */
export function normalizeProjectName(raw: string): Result<string, FieldIssue> {
  const name = raw.replace(/[\r\n]+/g, ' ').trim();
  if (name.length === 0) return err({ field: 'name', reason: 'required' });
  if (name.length > NAME_MAX) return err({ field: 'name', reason: 'too_long' });
  return ok(name);
}

/** BR-PROJ-001: açıklama ≤ 5.000 karakter; boş açıklama kaydedilmez. */
export function normalizeProjectDescription(raw: string | null): Result<string | null, FieldIssue> {
  const description = raw?.trim() ? raw : null;
  if (description !== null && description.length > DESCRIPTION_MAX) {
    return err({ field: 'description', reason: 'too_long' });
  }
  return ok(description);
}

/** BR-PROJ-003: ilerleme sorgu anında hesaplanır; görev yoksa gösterilmez. */
export type Progress = { done: number; total: number };
export const progressPercent = (p: Progress): number | null =>
  p.total === 0 ? null : Math.round((p.done / p.total) * 100);
