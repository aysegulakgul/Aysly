/** Not listesindeki arama kutusu için önek sorgusu (D-022); global aramayla aynı kural (search modülü). */
export function toPrefixQuery(q: string): string | null {
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(' & ') : null;
}
