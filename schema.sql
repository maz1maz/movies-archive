-- D1 database schema for the film archive
-- Run: npx wrangler d1 execute movies-archive --file=schema.sql

CREATE TABLE IF NOT EXISTS films (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'بدون نام',
  originalTitle TEXT,
  closet TEXT,
  shelf TEXT,
  row TEXT,
  director TEXT,
  producer TEXT,        -- برای سریال بهتره جای کارگردان (چون هر قسمت کارگردان جدا داره)
  cast TEXT,            -- JSON array
  year INTEGER,
  genre TEXT,           -- JSON array
  rating REAL,
  runtime INTEGER,
  country TEXT,
  synopsis TEXT,
  poster TEXT,
  studio TEXT,
  rated TEXT,
  format TEXT,
  borrowedTo TEXT,
  borrowedDate TEXT,
  watched INTEGER DEFAULT 0,
  imdbId TEXT,
  imdbVotes TEXT,
  metadataEnrichmentAttemptedAt TEXT,
  myRating INTEGER DEFAULT 0,             -- امتیاز شخصی کاربر (۰ تا ۵)
  criterion INTEGER DEFAULT 0,            -- نسخه‌ی کرایتریون هست یا نه
  criterionCopies INTEGER,                -- تعداد نسخه‌های کرایتریون (وقتی criterion=1)
  copies INTEGER DEFAULT 1,               -- تعداد نسخه‌های فیزیکی این عنوان
  mediaType TEXT DEFAULT 'physical',      -- physical | digital
  driveNumber TEXT,                       -- برای آیتم‌های دیجیتال
  itemType TEXT DEFAULT 'movie',          -- movie | series
  seasonsEpisodes TEXT,                   -- برای سریال‌ها
  seasonDrives TEXT,                       -- JSON: [{seasons:"1-3", drive:"HDD-01"}, ...] فصل‌های سریال روی چه هاردی
  totalSeasonsProduced INTEGER,           -- تعداد کل فصل‌های تولیدشده‌ی سریال (از TVMaze)
  totalSeasonsUpdatedAt TEXT,             -- آخرین بار که totalSeasonsProduced چک شد
  letterboxdRating REAL,                  -- امتیاز Letterboxd (کش‌شده)
  letterboxdVotes INTEGER,                -- تعداد رای Letterboxd (کش‌شده)
  watchlisted INTEGER DEFAULT 0,          -- وضعیت واچ‌لیست (سه‌حالته با watched)
  personalReview TEXT,                    -- متن نقد شخصی (از Letterboxd sync یا دستی)
  personalReviewUrl TEXT,                 -- لینک نقد روی Letterboxd
  personalReviewDate TEXT,                -- تاریخ نقد
  reviews TEXT,                           -- JSON array: نقدهای همگام‌شده از Letterboxd
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_films_title ON films(title);
CREATE INDEX IF NOT EXISTS idx_films_shelf ON films(shelf);
CREATE INDEX IF NOT EXISTS idx_films_closet ON films(closet);
CREATE INDEX IF NOT EXISTS idx_films_year ON films(year);
CREATE INDEX IF NOT EXISTS idx_films_watched ON films(watched);

-- لیست‌های تماشا (سفارشی، جدا از فیلد watchlisted روی هر فیلم)
CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  items TEXT,             -- JSON array of film ids
  createdAt TEXT DEFAULT (datetime('now'))
);

-- کش عکس/بیوگرافی بازیگرا (از ویکی‌پدیا/ویکی‌دیتا)، برای جلوگیری از فچ تکراری
CREATE TABLE IF NOT EXISTS people_photos (
  name TEXT PRIMARY KEY,
  photo TEXT,
  bio TEXT,
  birthDate TEXT,
  deathDate TEXT,
  height TEXT,
  spouse TEXT,
  children TEXT,
  imdbId TEXT
);

-- کش جوایز (از Wikidata) + پیشنهاد فیلم‌های کارگردان که تو آرشیو نیستن ولی
-- امتیاز بالایی دارن (IMDb + Letterboxd) — برای جلوگیری از فچ سنگین تکراری.
CREATE TABLE IF NOT EXISTS director_extras (
  name TEXT PRIMARY KEY,
  awards TEXT,           -- JSON: [{label, count}, ...]
  recommendations TEXT,  -- JSON: [{title, year, imdbRating, letterboxdRating, poster}, ...]
  fetchedAt TEXT DEFAULT (datetime('now'))
);

-- کش عمومی برای بخش «اخبار سینما» (تریلرهای تازه، فیلم/سریال‌های در راه‌ی
-- اهالی کالکشن) — یه جدول کلید/مقدار ساده به‌جای چند جدول جدا، چون همه‌ی
-- دیتاها کوچیک و از قبل JSON-friendly هستن.
CREATE TABLE IF NOT EXISTS cinema_news_cache (
  key TEXT PRIMARY KEY,
  data TEXT,
  fetchedAt TEXT DEFAULT (datetime('now'))
);

-- کاربران برنامه. مهمان‌ها (بدون سشن) فقط دسترسی مشاهده دارن.
-- role: 'admin' | 'user'
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  passwordSalt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  createdAt TEXT DEFAULT (datetime('now'))
);

-- سشن‌های لاگین (توکن تصادفی سمت سرور؛ نیازی به JWT/secret خارجی نیست)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);

-- ============================================================================
-- MIGRATION for an EXISTING production database (D1) that predates the
-- columns/table above. NOT run automatically by `npm run db:init` — that
-- only executes the CREATE TABLE/INDEX statements above, and CREATE TABLE
-- IF NOT EXISTS is a no-op against a table that already exists, so it will
-- NOT retroactively add these columns.
--
-- Each ALTER TABLE ... ADD COLUMN below only adds a new, nullable column —
-- it does not read, modify, or delete any existing row or data. Still,
-- review before running, and run manually and deliberately, e.g.:
--   npx wrangler d1 execute movies-archive --command "ALTER TABLE films ADD COLUMN closet TEXT;"
-- one statement at a time (D1 currently only supports one statement per
-- --command call). Do not run via `npm run db:init` — that would replay the
-- CREATE TABLE statements above too, which is harmless (IF NOT EXISTS) but
-- unnecessary.
-- ============================================================================
-- ALTER TABLE films ADD COLUMN closet TEXT;
-- ALTER TABLE films ADD COLUMN criterionCopies INTEGER;
-- ALTER TABLE films ADD COLUMN totalSeasonsProduced INTEGER;
-- ALTER TABLE films ADD COLUMN totalSeasonsUpdatedAt TEXT;
-- ALTER TABLE films ADD COLUMN personalReview TEXT;
-- ALTER TABLE films ADD COLUMN personalReviewUrl TEXT;
-- ALTER TABLE films ADD COLUMN personalReviewDate TEXT;
-- ALTER TABLE films ADD COLUMN reviews TEXT;
-- CREATE INDEX IF NOT EXISTS idx_films_closet ON films(closet);
-- CREATE TABLE IF NOT EXISTS watchlists (
--   id TEXT PRIMARY KEY,
--   name TEXT NOT NULL,
--   items TEXT,
--   createdAt TEXT DEFAULT (datetime('now'))
-- );

