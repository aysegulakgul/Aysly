// İş kuralı izlenebilirlik raporu (TESTING_STRATEGY §3).
// Kodda `// BR-XXX-000` yorumuyla uygulanan her kuralın en az bir testi olmalıdır; yoksa doğrulama başarısız olur.
// Ayrıca hangi ONAYLI kuralların henüz uygulanmadığını bilgi olarak listeler (gelecek fazlar).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const RULE = /BR-[A-Z]+-\d{3}/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...walk('src'), ...walk('tests')];
const isTest = (f) => /\.test\.ts$|\.spec\.ts$/.test(f) || f.startsWith('tests');
const implemented = new Set();
const tested = new Set();
for (const file of files) {
  const ids = readFileSync(file, 'utf8').match(RULE) ?? [];
  for (const id of ids) (isTest(file) ? tested : implemented).add(id);
}

const defined = new Set(
  readFileSync('docs/BUSINESS_RULES.md', 'utf8')
    .match(/^### (BR-[A-Z]+-\d{3})/gm)
    ?.map((l) => l.slice(4)) ?? [],
);
const unknown = [...implemented, ...tested].filter((id) => !defined.has(id));
const untested = [...implemented].filter((id) => !tested.has(id)).sort();

console.log(
  `İş kuralları: ${defined.size} tanımlı · ${implemented.size} kodda uygulanmış · ${tested.size} testli`,
);
if (unknown.length)
  console.error(`BUSINESS_RULES.md'de tanımsız kural kimliği: ${[...new Set(unknown)].join(', ')}`);
if (untested.length) console.error(`Testi olmayan uygulanmış kurallar: ${untested.join(', ')}`);
process.exit(unknown.length || untested.length ? 1 : 0);
