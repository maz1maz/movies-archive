-- 0011_shooting_coords
-- مختصات مکان‌های فیلم‌برداری (Wikidata P915 + P625) برای نقشه‌ی لوکیشن‌ها.
-- JSON: [{"label":"Prague","lat":50.08,"lon":14.43}]
-- NULL = هنوز چک نشده؛ '[]' = چک شده و مختصاتی ثبت نشده.
ALTER TABLE films ADD COLUMN shootingCoords TEXT;
