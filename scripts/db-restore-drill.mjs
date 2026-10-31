// Geri yükleme denemesi: `pnpm db:restore-drill` (SECURITY §8.2, IMPLEMENTATION_PLAN Faz 8).
// Asıl veritabanına dokunmaz: yeni bir yedek alır, onu geçici bir veritabanına geri yükler, iki veritabanındaki
// tablo satır sayılarını karşılaştırır ve geçici veritabanını siler.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const user = process.env.POSTGRES_USER ?? 'aysly';
const database = process.env.POSTGRES_DB ?? 'aysly';
const drill = `${database}_restore_drill`;

const docker = (args, options = {}) =>
  spawnSync('docker', ['compose', 'exec', '-T', 'db', ...args], {
    maxBuffer: 1024 * 1024 * 1024,
    ...options,
  });
const psql = (db, query) => {
  const run = docker(['psql', '-U', user, '-d', db, '-AtX', '-c', query]);
  if (run.status !== 0) throw new Error(run.stderr.toString());
  return run.stdout.toString().trim();
};
const counts = (db) => {
  const tables = psql(
    db,
    "select tablename from pg_tables where schemaname = 'public' and tablename not like '__drizzle%' order by 1",
  )
    .split('\n')
    .filter(Boolean);
  return Object.fromEntries(
    tables.map((t) => [t, Number(psql(db, `select count(*) from "${t}"`))]),
  );
};

const started = Date.now();
const backup = spawnSync('node', ['scripts/db-backup.mjs'], { stdio: 'inherit', env: process.env });
if (backup.status !== 0) process.exit(1);
const latest = readdirSync('backups')
  .filter((name) => /^aysly-.*\.dump$/.test(name))
  .sort()
  .at(-1);
const file = path.join('backups', latest);

docker(['dropdb', '-U', user, '--if-exists', drill]);
if (docker(['createdb', '-U', user, drill]).status !== 0) {
  console.error('Geçici veritabanı oluşturulamadı.');
  process.exit(1);
}
try {
  const restore = docker(
    ['pg_restore', '-U', user, '-d', drill, '--no-owner', '--single-transaction'],
    { input: readFileSync(file) },
  );
  if (restore.status !== 0) throw new Error(restore.stderr.toString());

  const source = counts(database);
  const restored = counts(drill);
  const tables = Object.keys(source);
  const diff = tables.filter((t) => source[t] !== restored[t]);
  const rows = tables.reduce((sum, t) => sum + source[t], 0);
  console.log(`Yedek: ${file}`);
  console.log(
    `Tablo: ${tables.length} · Satır: ${rows} · Süre: ${((Date.now() - started) / 1000).toFixed(1)} sn`,
  );
  if (diff.length || Object.keys(restored).length !== tables.length) {
    for (const t of diff) console.error(`✖ ${t}: asıl ${source[t]}, geri yüklenen ${restored[t]}`);
    throw new Error('Geri yüklenen veritabanı asılla eşleşmiyor.');
  }
  console.log('✔ Geri yüklenen veritabanı tüm tablolarda asılla aynı satır sayısına sahip.');
} catch (error) {
  console.error(`✖ Geri yükleme denemesi başarısız: ${error.message}`);
  process.exitCode = 1;
} finally {
  docker(['dropdb', '-U', user, '--if-exists', drill]);
}
