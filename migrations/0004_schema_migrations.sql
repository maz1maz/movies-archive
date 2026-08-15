-- 0004_schema_migrations
-- خود سیستم نسخه‌بندی — لیست مایگریشن‌هایی که قبلاً اعمال شدن رو نگه می‌داره.
-- scripts/migrate.mjs قبل از اجرای هر فایل تو migrations/ این جدول رو چک می‌کنه.
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  appliedAt TEXT DEFAULT (datetime('now'))
);
