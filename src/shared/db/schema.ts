/**
 * Tüm modüllerin Drizzle tablo tanımlarının toplandığı yer (drizzle-kit bu dosyayı okur).
 * Her modül kendi tablolarını `src/modules/<modül>/infrastructure/schema.ts` içinde tanımlar.
 */
export * from '@/modules/identity/infrastructure/schema';
export * from '@/modules/workspaces/infrastructure/schema';
export * from '@/modules/projects/infrastructure/schema';
export * from '@/modules/preferences/infrastructure/schema';
export * from '@/modules/audit/infrastructure/schema';
export * from '@/modules/tasks/infrastructure/schema';
export * from '@/shared/http/idempotency-schema';
export * from '@/modules/tags/infrastructure/schema';
