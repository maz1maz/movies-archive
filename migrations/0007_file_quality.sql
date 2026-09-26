-- 0007_file_quality
-- اطلاعات کیفیت فایل برای نسخه‌های دیجیتال (رزولوشن، فرمت، زیرنویس، دوبله) —
-- تو FilmModal فقط برای mediaType='digital' نشون داده می‌شن.
ALTER TABLE films ADD COLUMN resolution TEXT;
ALTER TABLE films ADD COLUMN videoFormat TEXT;
ALTER TABLE films ADD COLUMN hasSubtitle INTEGER;
ALTER TABLE films ADD COLUMN dubbed INTEGER;
