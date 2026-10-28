import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');

/** Bir CSS bloğundaki `--ad: değer` çiftleri. */
function variables(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]),
  );
}

describe('tema token’ları (BR-PREF-001: tema sistem ayarını izleyebilir)', () => {
  it('"system" açık modda, açık temayla birebir aynı değerleri kullanır', () => {
    const light = css.match(/\[data-theme='light'\] \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const systemLight =
      css.match(
        /prefers-color-scheme: light\) \{\s*\[data-theme='system'\] \{([\s\S]*?)\n {2}\}/,
      )?.[1] ?? '';
    expect(Object.keys(variables(light)).length).toBeGreaterThan(10);
    expect(variables(systemLight)).toEqual(variables(light));
  });

  it('"system" varsayılan olarak koyu değerleri alır (iç içe önizlemede de)', () => {
    expect(css).toMatch(/:root,\s*\[data-theme='dark'\],\s*\[data-theme='system'\] \{/);
  });
});
