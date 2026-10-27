// `pnpm setup:env`: .env.example dosyasından .env oluşturur ve AUTH_SECRET için rastgele değer üretir.
// Mevcut .env varsa yalnızca eksik AUTH_SECRET'i tamamlar, diğer değerlere dokunmaz.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const secret = randomBytes(48).toString('base64url');
let content = existsSync('.env')
  ? readFileSync('.env', 'utf8')
  : readFileSync('.env.example', 'utf8');
if (/^AUTH_SECRET=.{32,}$/m.test(content)) {
  console.log('.env zaten hazır; AUTH_SECRET mevcut.');
} else {
  content = /^AUTH_SECRET=.*$/m.test(content)
    ? content.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${secret}`)
    : `${content.trimEnd()}\nAUTH_SECRET=${secret}\n`;
  writeFileSync('.env', content);
  console.log('.env hazırlandı; AUTH_SECRET rastgele üretildi.');
}
