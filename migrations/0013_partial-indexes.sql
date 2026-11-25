-- 0013_partial-indexes
-- کم کردن «ردیف‌های خوانده‌شده»ی D1. این کوئری‌ها فقط چند ردیف می‌خوان ولی
-- بدون ایندکس کل جدول (~۱۸٫۷ هزار ردیف) رو هر بار اسکن می‌کردن:
--   ۱) شمارش/دسته‌ی «هنوز enrich نشده» (metadataEnrichmentAttemptedAt IS NULL)
--   ۲) فیلم‌های بدون imdbId برای پیدا کردن خودکار شناسه
-- ایندکس جزئی فقط همون ردیف‌های کم رو نگه می‌داره، پس هم کوچیکه هم ارزون.
CREATE INDEX IF NOT EXISTS idx_films_enrich_pending ON films(id) WHERE metadataEnrichmentAttemptedAt IS NULL;
CREATE INDEX IF NOT EXISTS idx_films_imdb_missing ON films(id) WHERE imdbId IS NULL OR imdbId = '';
