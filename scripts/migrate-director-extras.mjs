// یه‌بار اجرا کن تا جدول director_extras (برای کش جوایز/پیشنهاد فیلم‌های
// کارگردان) روی دیتابیس زنده ساخته بشه.
// اجرا: node scripts/migrate-director-extras.mjs

import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const DB_NAME = 'movies-archive'
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const IS_WIN = process.platform === 'win32'

const sql = `
CREATE TABLE IF NOT EXISTS director_extras (
  name TEXT PRIMARY KEY,
  awards TEXT,
  recommendations TEXT,
  fetchedAt TEXT DEFAULT (datetime('now'))
);
ALTER TABLE people_photos ADD COLUMN imdbId TEXT;
`

const tmpFile = `.tmp-migrate-${randomUUID()}.sql`
writeFileSync(tmpFile, sql, 'utf-8')
try {
  console.log('🔧 در حال ساخت جدول director_extras...')
  execFileSync(NPX_CMD, ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--yes', '--file', tmpFile], {
    encoding: 'utf-8',
    stdio: 'inherit',
    shell: IS_WIN,
    env: { ...process.env, CI: '1' },
  })
  console.log('✅ انجام شد.')
} finally {
  try {
    unlinkSync(tmpFile)
  } catch {}
}
