import { runMigrations } from '../../src/shared/db/migrate';
import { createSqlClient } from '../../src/shared/db/client';
import { E2E_DATABASE, E2E_DATABASE_URL, ADMIN_DATABASE_URL } from './e2e-env';

/**
 * Tarayıcı testleri, geliştirme veritabanından ayrı ve her çalıştırmada sıfırdan kurulan `aysly_e2e`
 * veritabanını kullanır (CLAUDE.md §6: gerçek veriyle test yapılmaz).
 */
export default async function globalSetup() {
  const admin = createSqlClient(ADMIN_DATABASE_URL, 1);
  try {
    await admin.unsafe(`drop database if exists ${E2E_DATABASE} with (force)`);
    await admin.unsafe(`create database ${E2E_DATABASE}`);
  } finally {
    await admin.end({ timeout: 5 });
  }
  await runMigrations(E2E_DATABASE_URL);
}
