-- Faz 2: Sonraki fazların ihtiyaç duyduğu PostgreSQL uzantıları.
-- unaccent + pg_trgm: Türkçe karakter duyarsız arama (D-022, BR-SRCH-001).
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
