// Yerel veritabanı yedeği: `pnpm db:backup` (SECURITY §8.2, D-036, D-060).
// Docker'daki PostgreSQL'den pg_dump alır, backups/ klasörüne yazar ve yalnızca son 7 yedeği saklar.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const KEEP = 7;
const dir = path.resolve('backups');
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(dir, `aysly-${stamp}.dump`);

const user = process.env.POSTGRES_USER ?? 'aysly';
const database = process.env.POSTGRES_DB ?? 'aysly';
const result = spawnSync(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'db',
    'pg_dump',
    '-U',
    user,
    '-d',
    database,
    '--format=custom',
    '--no-owner',
  ],
  { maxBuffer: 1024 * 1024 * 1024 },
);
if (result.status !== 0) {
  console.error(
    'Yedek alınamadı. Docker Desktop ve veritabanı konteyneri çalışıyor mu? (docker compose up -d)',
  );
  console.error(result.stderr?.toString() ?? '');
  process.exit(1);
}
writeFileSync(file, result.stdout);

const backups = readdirSync(dir)
  .filter((name) => /^aysly-.*\.dump$/.test(name))
  .sort()
  .reverse();
for (const old of backups.slice(KEEP)) rmSync(path.join(dir, old));

console.log(
  `Yedek alındı: backups/${path.basename(file)} (${result.stdout.length} bayt). Saklanan yedek sayısı: ${Math.min(backups.length, KEEP)}`,
);
