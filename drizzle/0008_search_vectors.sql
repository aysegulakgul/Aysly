-- D-022 / FR-SRCH-02: Türkçe harf ve aksan farkına duyarsız arama metni. Üretilmiş kolonda kullanılabilmesi için
-- IMMUTABLE sarmalayıcı; sözlük açıkça verildiği için search_path'ten bağımsızdır. NULL boş metin sayılır; "ı" ve "İ" önce ASCII'ye çevrilir.
CREATE OR REPLACE FUNCTION aysly_search_text(input text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, translate(coalesce(input, ''), 'ıİ', 'iI'))) $$;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', aysly_search_text(name)), 'A') || setweight(to_tsvector('simple', aysly_search_text(description)), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', aysly_search_text(title)), 'A') || setweight(to_tsvector('simple', aysly_search_text(description)), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', aysly_search_text(title)), 'A') || setweight(to_tsvector('simple', aysly_search_text(body)), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', aysly_search_text(title)), 'A') || setweight(to_tsvector('simple', aysly_search_text(description)), 'B')) STORED;--> statement-breakpoint
CREATE INDEX "projects_search_idx" ON "projects" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "tasks_search_idx" ON "tasks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "notes_search_idx" ON "notes" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "goals_search_idx" ON "goals" USING gin ("search_vector");