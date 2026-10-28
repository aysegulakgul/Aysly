// TESTING_STRATEGY §5: src/app/api/v1 altındaki her rota ve HTTP yöntemi yetki matrisinde (tests/authorization-matrix.json)
// yer almalıdır; matriste olup kodda olmayan satır da hatadır. Matris satırları tests/e2e/authorization.spec.ts'te sınanır.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = 'src/app/api/v1';
const found = new Set();
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'route.ts') {
      const path = '/api/v1/' + relative(root, dir).split(sep).join('/');
      const source = readFileSync(full, 'utf8');
      for (const m of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g))
        found.add(`${m[1]} ${path}`);
    }
  }
}
walk(root);

const matrix = JSON.parse(readFileSync('tests/authorization-matrix.json', 'utf8'));
const listed = new Set(matrix.routes.map((r) => `${r.method} ${r.path}`));
const missing = [...found].filter((r) => !listed.has(r));
const stale = [...listed].filter((r) => !found.has(r));

if (missing.length || stale.length) {
  for (const r of missing) console.error(`✖ Yetki matrisinde yok: ${r}`);
  for (const r of stale) console.error(`✖ Matriste var ama kodda yok: ${r}`);
  process.exit(1);
}
console.log(`✔ ${found.size} uç nokta yetki matrisinde.`);
