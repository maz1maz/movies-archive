// اجرای مایگریشن‌های پندینگ روی D1 — می‌شه بعد از predeploy check یا دستی
// اجرا کرد (npm run migrate). فایل‌های migrations/000X_name.sql رو به ترتیب
// اسم چک می‌کنه؛ هرکدوم که تو schema_migrations نبود، اجرا می‌کنه و ثبتش می‌کنه.
//
// Usage:
//   npm run migrate                    (روی movies-archive --remote)
//   npm run migrate -- --local         (روی D1 لوکال، برای تست)

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'migrations')
const DB_NAME = 'movies-archive'
const isLocal = process.argv.includes('--local')
const flag = isLocal ? '--local' : '--remote'

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' })
}

function getAppliedIds() {
  const out = run(
    `npx wrangler d1 execute ${DB_NAME} ${flag} --json --command "SELECT id FROM schema_migrations"`
  )
  try {
    const parsed = JSON.parse(out)
    const rows = parsed?.[0]?.results || []
    return new Set(rows.map((r) => r.id))
  } catch {
    // اگه خود جدول schema_migrations هنوز وجود نداشت (اولین اجرای migrate رو
    // یه دیتابیس کاملاً تازه)، یعنی هیچی اعمال نشده.
    return new Set()
  }
}

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('پوشه‌ی migrations/ پیدا نشد — کاری برای اجرا نیست.')
    return
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  console.log(`چک کردن مایگریشن‌های اعمال‌شده روی ${DB_NAME} (${flag})...`)
  const applied = getAppliedIds()

  const pending = files.filter((f) => !applied.has(f.replace(/\.sql$/, '')))
  if (pending.length === 0) {
    console.log('✅ همه‌ی مایگریشن‌ها از قبل اعمال شدن — چیزی برای اجرا نیست.')
    return
  }

  console.log(`${pending.length} مایگریشن پندینگ پیدا شد: ${pending.join(', ')}`)
  for (const file of pending) {
    const id = file.replace(/\.sql$/, '')
    console.log(`\n— اجرای ${file} —`)
    run(`npx wrangler d1 execute ${DB_NAME} ${flag} --file="migrations/${file}"`)
    run(
      `npx wrangler d1 execute ${DB_NAME} ${flag} --command "INSERT OR IGNORE INTO schema_migrations (id) VALUES ('${id}')"`
    )
    console.log(`✅ ${file} اعمال و ثبت شد`)
  }
  console.log('\n✅ همه‌ی مایگریشن‌های پندینگ با موفقیت اعمال شدن.')
}

main()
