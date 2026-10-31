// SECURITY §7 [MVP]: depoya girecek dosyalarda gizli anahtar taraması (gitleaks eşdeğeri, ek paket yok — D-058).
// Git'in izlediği ve izleyeceği (yok sayılmayan) dosyalar taranır; .env gibi yok sayılan dosyalar depoya girmez.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const RULES = [
  ['Özel anahtar (PEM)', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS erişim anahtarı', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Stripe canlı anahtar', /\b[sr]k_live_[A-Za-z0-9]{16,}\b/],
  ['Google API anahtarı', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Kimlik bilgisi içeren bağlantı adresi', /\b[a-z+]+:\/\/[^\s:/@'"]+:[^\s@'"]{16,}@/],
  [
    'Değeri yazılmış gizli anahtar',
    /\b(?:AUTH_SECRET|[A-Z_]*(?:API_KEY|SECRET_KEY|ACCESS_TOKEN|PRIVATE_KEY))\s*[=:]\s*['"]?[A-Za-z0-9+/_=-]{20,}/,
  ],
];
const ALLOW = new Set(['scripts/secret-scan.mjs']);
// Bilerek yazılmış test değeri satır sonunda gerekçesiyle işaretlenir: `// secret-scan: izinli — <gerekçe>`.
const LINE_ALLOW = /secret-scan: izinli — \S/;
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|pdf|dump|zip)$/i;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => f && !ALLOW.has(f) && !BINARY.test(f));

const findings = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // silinmiş ama henüz commit edilmemiş dosya
  }
  text.split('\n').forEach((line, i) => {
    if (LINE_ALLOW.test(line)) return;
    for (const [name, pattern] of RULES) {
      if (pattern.test(line)) findings.push(`${file}:${i + 1} — ${name}`);
    }
  });
}

if (findings.length) {
  for (const f of findings) console.error(`✖ ${f}`);
  console.error('Gizli bilgi depoya girmemeli (SECURITY §7). Değeri .env dosyasına taşı.');
  process.exit(1);
}
console.log(`✔ ${files.length} dosyada gizli anahtar bulunmadı.`);
