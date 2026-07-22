-- D1 database schema for the film archive
-- Run: npx wrangler d1 execute movies-archive --file=schema.sql

CREATE TABLE IF NOT EXISTS films (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'بدون نام',
  originalTitle TEXT,
  shelf TEXT,
  row TEXT,
  director TEXT,
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
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_films_title ON films(title);
CREATE INDEX IF NOT EXISTS idx_films_shelf ON films(shelf);
CREATE INDEX IF NOT EXISTS idx_films_year ON films(year);
CREATE INDEX IF NOT EXISTS idx_films_watched ON films(watched);
