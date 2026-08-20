-- 0006_perf-indexes
-- فیلترهای mediaType/itemType تقریباً روی هر بار بارگذاری لیست فیلم‌ها اجرا
-- می‌شن (worker.js: /api/films) ولی ایندکسی روشون نبود — با رشد جدول این
-- فیلترها به full table scan می‌رفتن. یه composite index اضافه می‌کنیم چون
-- این دو ستون معمولاً با هم فیلتر می‌شن (مثلاً mediaType='Movie' AND
-- itemType='physical').
CREATE INDEX IF NOT EXISTS idx_films_mediaType_itemType ON films(mediaType, itemType);
