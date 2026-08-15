-- 0002_audit_log
-- تاریخچه‌ی create/update/delete رو ثبت می‌کنه (تب Audit Trail تو Dashboard)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  filmId TEXT,
  filmTitle TEXT,
  action TEXT NOT NULL,
  changes TEXT,
  changedBy TEXT,
  changedAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_changedAt ON audit_log(changedAt DESC);
