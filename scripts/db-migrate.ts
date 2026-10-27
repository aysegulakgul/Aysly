/**
 * Migration'ları uygular: `pnpm db:migrate`.
 * Gerçek veri içeren veritabanına uygulamadan önce `pnpm db:backup` çalıştır (ARCHITECTURE §12.4).
 */
import { runMigrations } from '../src/shared/db/migrate';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL tanımlı değil. .env.example dosyasını .env olarak kopyala.');
  process.exit(1);
}

runMigrations(url)
  .then(() => console.log('Veritabanı güncellemesi tamamlandı.'))
  .catch((error: unknown) => {
    console.error(
      'Veritabanı güncellemesi başarısız oldu; başarısız adım geri alındı.',
      error instanceof Error ? error.message : '',
    );
    process.exit(1);
  });
