-- 0003_api_usage_daily
-- شمارنده‌ی روزانه‌ی مصرف API (فعلاً فقط OMDb) برای هشدار نزدیک‌شدن به quota
-- (تب DB Health و تب API Usage تو Dashboard)
CREATE TABLE IF NOT EXISTS api_usage_daily (
  date TEXT NOT NULL,
  service TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, service)
);
