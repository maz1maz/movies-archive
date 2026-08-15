-- 0005_film_collections
-- برای گراف رابطه‌ی فیلم‌ها (based on / sequel / prequel از TMDB collections)
-- collectionId = NULL یعنی هنوز چک نشده؛ '' یعنی چک شده و بخشی از هیچ
-- مجموعه‌ای نیست؛ مقدار دیگه یعنی TMDB collection id.
ALTER TABLE films ADD COLUMN collectionId TEXT;
ALTER TABLE films ADD COLUMN collectionName TEXT;
ALTER TABLE films ADD COLUMN collectionPoster TEXT;
