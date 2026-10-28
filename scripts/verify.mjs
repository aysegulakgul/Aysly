// `pnpm verify`: tüm kalite kontrollerini sırayla çalıştırır (D-057, TESTING_STRATEGY §8).
// İlk başarısız adımda durur ve hangi adımın başarısız olduğunu söyler.
// Gereksinim: Docker Desktop çalışıyor olmalı (entegrasyon testleri ve tarayıcı testleri için).
import { spawnSync } from 'node:child_process';

const steps = [
  ['Kilit dosyası', 'pnpm', ['install', '--frozen-lockfile', '--prefer-offline']],
  ['Biçim', 'pnpm', ['format:check']],
  ['Lint', 'pnpm', ['lint']],
  ['Tip kontrolü', 'pnpm', ['typecheck']],
  ['Mimari kurallar', 'pnpm', ['arch']],
  ['İş kuralı izlenebilirliği', 'node', ['scripts/br-coverage.mjs']],
  ['Yetki matrisi', 'node', ['scripts/route-matrix.mjs']],
  ['Birim testleri', 'pnpm', ['test']],
  ['Migration kontrolü', 'pnpm', ['db:check']],
  ['Entegrasyon testleri', 'pnpm', ['test:integration']],
  ['Derleme', 'pnpm', ['build']],
  ['Tarayıcı testleri (duman + erişilebilirlik)', 'pnpm', ['test:e2e']],
  ['Bağımlılık güvenliği', 'pnpm', ['audit:deps']],
];

const results = [];
for (const [label, cmd, args] of steps) {
  const started = Date.now();
  process.stdout.write(`\n▶ ${label}\n`);
  const run = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.push([label, run.status === 0, seconds]);
  if (run.status !== 0) {
    console.error(`\n✖ Başarısız adım: ${label} (${seconds} sn)`);
    break;
  }
}

console.log('\nÖzet');
for (const [label, passed, seconds] of results)
  console.log(`  ${passed ? '✔' : '✖'} ${label} (${seconds} sn)`);
process.exit(results.every(([, passed]) => passed) && results.length === steps.length ? 0 : 1);
