import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import { validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';

export const SEARCH_TYPES = ['task', 'project', 'note', 'goal'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export const RESULTS_PER_TYPE = 20; // BR-SRCH-002

export type SearchHit = {
  type: SearchType;
  id: string;
  title: string;
  /** Görev: proje adı; not: önizleme; hedef/proje: durum. */
  context: string | null;
  archived: boolean;
};

export type SearchIndex = {
  search(
    scope: WorkspaceScope,
    query: { text: string; prefix: string; types: readonly SearchType[]; includeArchived: boolean },
  ): Promise<SearchHit[]>;
};

/**
 * Önek eşleşmeli `tsquery` metni (D-022): yalnızca harf ve rakamlar; her sözcük `sözcük:*`, sözcükler VE ile
 * bağlanır. Veritabanında `aysly_search_text` normalleştirmesinden geçer (FR-SRCH-02).
 */
export function toPrefixQuery(q: string): string | null {
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(' & ') : null;
}

/**
 * Global arama (FR-SRCH-01..04). BR-SRCH-001: yalnızca aktörün alanı; çöpteki kayıtlar hiç dönmez, arşivliler
 * yalnızca istenirse; başlık (yüksek ağırlık), açıklama/gövde ve etiket adı eşleşir; Türkçe harf/aksan duyarsız.
 * BR-SRCH-002: sorgu 2–200 karakter; türe göre en fazla 20 sonuç, alaka ve yakınlık sırasıyla.
 */
export async function searchEverything(
  index: SearchIndex,
  scope: WorkspaceScope,
  input: {
    q: string;
    types?: readonly SearchType[] | undefined;
    includeArchived?: boolean | undefined;
  },
): Promise<Result<SearchHit[], DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const text = input.q.trim();
  if (text.length < 2) return err(validationError([{ field: 'q', reason: 'too_short' }]));
  if (text.length > 200) return err(validationError([{ field: 'q', reason: 'too_long' }]));
  const prefix = toPrefixQuery(text);
  if (!prefix) return ok([]);
  return ok(
    await index.search(scope, {
      text,
      prefix,
      types: input.types?.length ? input.types : SEARCH_TYPES,
      includeArchived: input.includeArchived ?? false,
    }),
  );
}
