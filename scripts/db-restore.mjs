// Yedekten geri yükleme: `pnpm db:restore backups/<dosya>.dump`
// Önce mevcut veritabanının yedeğini alır, sonra seçilen yedeği geri yükler (SECURITY §8.2).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('Kullanım: pnpm db:restore backups/<dosya>.dump');
  process.exit(1);
}

const pre = spawnSync('node', ['scripts/db-backup.mjs'], { stdio: 'inherit', env: process.env });
if (pre.status !== 0) {
  console.error('Geri yüklemeden önceki güvenlik yedeği alınamadı; işlem durduruldu.');
  process.exit(1);
}

const user = process.env.POSTGRES_USER ?? 'aysly';
const database = process.env.POSTGRES_DB ?? 'aysly';
const result = spawnSync(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'db',
    'pg_restore',
    '-U',
    user,
    '-d',
    database,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--single-transaction',
  ],
  { input: readFileSync(file), maxBuffer: 1024 * 1024 * 64 },
);
if (result.status !== 0) {
  console.error(
    'Geri yükleme başarısız oldu; işlem tek transaction olduğu için veritabanı değiştirilmedi.',
  );
  console.error(result.stderr?.toString() ?? '');
  process.exit(1);
}
console.log(`Geri yüklendi: ${file}`);
