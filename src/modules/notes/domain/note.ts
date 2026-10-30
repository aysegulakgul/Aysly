import type { FieldIssue } from '@/shared/kernel/errors';

export const TITLE_MAX = 200;
export const BODY_MAX = 200_000; // BR-NOTE-004
export const LINKS_PER_NOTE = 50;

export type Note = {
  id: string;
  workspaceId: string;
  title: string | null;
  body: string;
  pinnedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  deletedBatchId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Başlık kırpılır; boşsa yoktur (arayüz gövdeden türetir, FR-NOTE-01). */
export const normalizeNoteTitle = (raw: string | null | undefined) => {
  const title = (raw ?? '').replace(/[\r\n]+/g, ' ').trim();
  return title.length ? title : null;
};

export function checkNote(title: string | null, body: string): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (title !== null && title.length > TITLE_MAX)
    issues.push({ field: 'title', reason: 'too_long' });
  if (body.length > BODY_MAX) issues.push({ field: 'body', reason: 'too_long' });
  return issues;
}

/** BR-NOTE-004: başlığı ve gövdesi boş not saklanmaz. */
export const isEmptyNote = (title: string | null, body: string) =>
  (title ?? '').trim().length === 0 && body.trim().length === 0;

/** FR-NOTE-01: başlık yoksa gövdenin ilk dolu satırı (Markdown işaretleri atılır). */
export function displayTitle(note: Pick<Note, 'title' | 'body'>, fallback: string): string {
  if (note.title) return note.title;
  const line = note.body
    .split('\n')
    .map((l) => l.replace(/^\s*(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+|>\s+)/, '').trim())
    .find((l) => l.length > 0);
  return line ? line.slice(0, 80) : fallback;
}

/** Liste önizlemesi: başlıktan sonraki ilk dolu satır, düz metin. */
export function preview(note: Pick<Note, 'title' | 'body'>): string {
  const lines = note.body
    .split('\n')
    .map((l) =>
      l
        .replace(/[#>*_`\[\]]/g, '')
        .replace(/^\s*[-+]\s*/, '')
        .trim(),
    )
    .filter((l) => l.length > 0);
  const rest = note.title ? lines : lines.slice(1);
  return (rest[0] ?? '').slice(0, 140);
}
