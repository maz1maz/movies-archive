-- 0009_films_title_norm_index
-- syncSharedMetadataToSibling (filmsDb.js) بعد از هر ویرایش/enrich دنبال نسخه‌ی
-- دیگه‌ی همون فیلم می‌گرده، با عنوان نرمال‌شده — و چون ایندکسی روی این عبارت
-- نبود، هر ویرایش کل جدول films رو اسکن می‌کرد (~۷هزار ردیف). این ایندکس
-- عبارت دقیقاً همونی رو پوشش می‌ده که تو کوئری هست.
CREATE INDEX IF NOT EXISTS idx_films_media_titlenorm
  ON films(mediaType, LOWER(TRIM(REPLACE(title, char(8217), char(39)))));
