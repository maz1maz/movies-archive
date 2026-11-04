-- 0008_films_fts
-- سرچ صفحه‌ی اصلی با LIKE '%...%' هر بار کل جدول films (۱۷هزار+ ردیف) رو
-- اسکن می‌کرد و سقف روزانه‌ی خواندن D1 رو پر می‌کرد. یه جدول FTS5 با
-- tokenizer «trigram» (جست‌وجوی substring مثل LIKE، ولی ایندکس‌شده؛ حداقل ۳ حرف)
-- روی ستون‌های قابل‌سرچ می‌سازیم. جدول external-content هست (داده‌ی تکراری
-- نگه نمی‌داره) و با triggerها خودکار با films هم‌گام می‌شه.
CREATE VIRTUAL TABLE IF NOT EXISTS films_fts USING fts5(
  title, originalTitle, director, producer, "cast",
  content='films', content_rowid='rowid', tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS films_fts_ai AFTER INSERT ON films BEGIN
  INSERT INTO films_fts(rowid, title, originalTitle, director, producer, "cast")
  VALUES (new.rowid, new.title, new.originalTitle, new.director, new.producer, new."cast");
END;

CREATE TRIGGER IF NOT EXISTS films_fts_ad AFTER DELETE ON films BEGIN
  INSERT INTO films_fts(films_fts, rowid, title, originalTitle, director, producer, "cast")
  VALUES ('delete', old.rowid, old.title, old.originalTitle, old.director, old.producer, old."cast");
END;

CREATE TRIGGER IF NOT EXISTS films_fts_au AFTER UPDATE OF title, originalTitle, director, producer, "cast" ON films BEGIN
  INSERT INTO films_fts(films_fts, rowid, title, originalTitle, director, producer, "cast")
  VALUES ('delete', old.rowid, old.title, old.originalTitle, old.director, old.producer, old."cast");
  INSERT INTO films_fts(rowid, title, originalTitle, director, producer, "cast")
  VALUES (new.rowid, new.title, new.originalTitle, new.director, new.producer, new."cast");
END;

-- پر کردن اولیه از روی داده‌ی موجود
INSERT INTO films_fts(films_fts) VALUES ('rebuild');
