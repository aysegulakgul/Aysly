import type { FieldIssue } from '@/shared/kernel/errors';

export const TAG_NAME_MAX = 50;
export const TAGS_PER_RECORD = 20; // BR-TAG-003
export const TAGS_PER_WORKSPACE = 500; // BR-TAG-003

/**
 * BR-TAG-001: etiketler büyük/küçük harf ve Türkçe karakter farkına duyarsız benzersizdir ("İş" = "iş" = "is").
 * Türkçe yerel ayarıyla küçük harf, ardından aksan ve noktasız ı farkı kaldırılır.
 */
export function normalizeTagName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Ad kırpılır, iç boşluklar teke indirilir; tekrarlar (normalleştirilmiş) atılır. */
export function prepareTagNames(raw: readonly string[]): { names: string[]; issues: FieldIssue[] } {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of raw) {
    const name = value.trim().replace(/\s+/g, ' ').replace(/^#/, '');
    if (name.length === 0) continue;
    if (name.length > TAG_NAME_MAX)
      return { names: [], issues: [{ field: 'tagNames', reason: 'too_long' }] };
    const key = normalizeTagName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return { names, issues: [] };
}
