import { describe, expect, it } from 'vitest';
import type { WorkspaceScope } from '@/modules/workspaces';
import { searchEverything, toPrefixQuery, type SearchIndex } from './search';

const scope = { userId: 'u', workspaceId: 'w', role: 'owner' } as WorkspaceScope;

describe('arama (BR-SRCH-001/002)', () => {
  it('BR-SRCH-002: sorgu 2–200 karakter; tüm türler varsayılan, arşiv varsayılan dışarıda', async () => {
    let received: Parameters<SearchIndex['search']>[1] | null = null;
    const index: SearchIndex = {
      search: async (_s, q) => {
        received = q;
        return [];
      },
    };
    expect(await searchEverything(index, scope, { q: 'a' })).toMatchObject({ ok: false });
    expect(await searchEverything(index, scope, { q: 'x'.repeat(201) })).toMatchObject({
      ok: false,
    });
    expect(await searchEverything(index, scope, { q: '  ışık  fatura ' })).toMatchObject({
      ok: true,
    });
    expect(received).toEqual({
      text: 'ışık  fatura',
      prefix: 'ışık:* & fatura:*',
      types: ['task', 'project', 'note', 'goal'],
      includeArchived: false,
    });
  });

  it('D-022: önek sorgusu yalnızca harf ve rakam taşır (tsquery işleçleri kaçırılamaz)', () => {
    expect(toPrefixQuery("a & b | !c:* 'd'")).toBe('a:* & b:* & c:* & d:*');
    expect(toPrefixQuery('&& !!')).toBeNull();
  });
});
