// اسکریپت ادغام خودکار داپلیکیت‌های «همون فیلم، فقط درایو متفاوت».
// اجرا: node scripts/merge-drive-duplicates.mjs
// (نیاز به wrangler لاگین‌شده روی همین سیستم داره — همون چیزی که npm run deploy استفاده می‌کنه)
//
// منطق:
//   ۱. همه‌ی گروه‌های داپلیکیت (عنوان+سال+mediaType+itemType یکسان) رو پیدا می‌کنه.
//   ۲. اگه همه‌ی رکوردهای یه گروه از نظر rating/poster/format/runtime/genre/cast/synopsis
//      یکسان باشن => «امن» تشخیص داده می‌شه: یه رکورد نگه داشته می‌شه، driveNumber
//      همه با کاما ترکیب می‌شه، copies = تعداد رکوردها، بقیه حذف می‌شن.
//   ۳. اگه فرق داشته باشن (مثلاً کیفیت/زبون متفاوت) => دست‌نخورده می‌مونه، فقط تو
//      گزارش پایانی («نیاز به بررسی دستی») لیست می‌شه.
//
// قبل از هر حذفی، یه بکاپ کامل از جدول films محلی ذخیره می‌شه تا در صورت اشتباه
// قابل بازگردانی باشه.
//
// نکات فنی (بعد از چند بار خطا یاد گرفته شده):
//   - wrangler d1 execute --file برای SELECT فقط آمار (Rows read/written) برمی‌گردونه،
//     نه خودِ ردیف‌ها؛ برای خوندن داده حتماً باید --command استفاده بشه.
//   - تو ویندوز، execFileSync با shell:true آرگومان‌ها رو خودش کوت نمی‌کنه، پس
//     برای --command از execSync با یه رشته‌ی دستی کوت‌شده استفاده می‌کنیم.
//   - برای نوشتن (UPDATE/DELETE) از --file استفاده می‌کنیم چون نیازی به داده‌ی
//     برگشتی نداریم، فقط موفقیت اجرا مهمه — و اونجا مشکلی نیست.

import { execFileSync, execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const DB_NAME = 'movies-archive'
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const IS_WIN = process.platform === 'win32'
const ENV = { ...process.env, CI: '1' }

function extractJsonResults(out) {
  const lines = out.split(/\r?\n/)
  const jsonLine = lines.map((l) => l.trim()).filter((l) => l.startsWith('[') && l.endsWith(']')).pop()
  let jsonText = jsonLine
  if (!jsonText) {
    const start = out.indexOf('[')
    const end = out.lastIndexOf(']')
    if (start === -1 || end === -1 || end < start) {
      throw new Error('Could not find JSON in wrangler output:\n' + out)
    }
    jsonText = out.slice(start, end + 1)
  }
  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Failed to parse wrangler JSON output — see .wrangler-raw-debug.log')
  }
  return parsed[0]?.results || []
}

// خوندن داده — باید از --command استفاده کنه (نه --file)، وگرنه wrangler فقط
// آمار برمی‌گردونه نه ردیف‌های واقعی.
function runQuery(sql) {
  let out
  if (IS_WIN) {
    // کوت دستی برای cmd.exe: کل دستور رو با " دور می‌گیریم و " های داخلی رو دوبل می‌کنیم.
    const quoted = '"' + sql.replace(/"/g, '""') + '"'
    const cmd = `${NPX_CMD} wrangler d1 execute ${DB_NAME} --remote --json --command ${quoted}`
    out = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 200, env: ENV })
  } else {
    out = execFileSync(
      NPX_CMD,
      ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', sql],
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 200, env: ENV }
    )
  }
  writeFileSync('.wrangler-raw-debug.log', out, 'utf-8')
  return extractJsonResults(out)
}

// نوشتن (UPDATE/DELETE) — از --file استفاده می‌کنه، چون فایل موقت مشکل کوت‌شدن
// آرگومان تو ویندوز رو کلاً نداره (فقط اسم فایل پاس داده می‌شه، بدون فاصله).
function runMutations(sql) {
  const tmpFile = `.tmp-d1-${randomUUID()}.sql`
  writeFileSync(tmpFile, sql, 'utf-8')
  try {
    const args = ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--yes', '--file', tmpFile]
    execFileSync(NPX_CMD, args, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 200,
      shell: IS_WIN,
      env: ENV,
    })
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {}
  }
}

function normalizeTitle(t) {
  return (t || '').toString().trim().toLowerCase()
}

function esc(s) {
  return String(s).replace(/'/g, "''")
}

function main() {
  console.log('📥 خوندن کل جدول films از D1...')
  const rows = runQuery('SELECT * FROM films;')
  console.log(`   ${rows.length} رکورد خونده شد.`)

  if (rows.length < 100) {
    console.log(
      '\n⚠️  تعداد رکوردهای خونده‌شده خیلی کمه. برای اطمینان، اجرا رو متوقف می‌کنم تا چیزی اشتباه پاک نشه.'
    )
    console.log('   فایل .wrangler-raw-debug.log رو برام بفرست.')
    process.exit(1)
  }

  const groups = new Map()
  for (const f of rows) {
    const key = `${normalizeTitle(f.title)}|${f.year || ''}|${f.mediaType}|${f.itemType}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(f)
  }
  const dupGroups = Array.from(groups.values()).filter((g) => g.length > 1)
  console.log(`🔎 ${dupGroups.length} گروه داپلیکیت پیدا شد.\n`)

  const FIELDS_MUST_MATCH = ['rating', 'poster', 'format', 'runtime', 'genre', 'cast', 'synopsis']
  const safe = []
  const needsReview = []

  for (const group of dupGroups) {
    const base = group[0]
    const identical = group.every((f) =>
      FIELDS_MUST_MATCH.every((k) => String(f[k] || '') === String(base[k] || ''))
    )
    if (identical) safe.push(group)
    else needsReview.push(group)
  }

  console.log(`✅ ${safe.length} گروه امن برای ادغام خودکار`)
  console.log(`⚠️  ${needsReview.length} گروه نیاز به بررسی دستی\n`)

  if (safe.length === 0) {
    console.log('چیزی برای ادغام خودکار نیست.')
  } else {
    console.log('💾 بکاپ کامل قبل از تغییر...')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(`backup-before-merge-${ts}.json`, JSON.stringify(rows, null, 2))
    console.log(`   backup-before-merge-${ts}.json ذخیره شد.\n`)

    console.log('🔧 آماده‌سازی SQL ادغام...')
    const statements = []
    const summary = []

    for (const group of safe) {
      const keep = group.reduce((a, b) => (String(a.id) < String(b.id) ? a : b)) // پایدار: کوچیک‌ترین id
      const others = group.filter((f) => f.id !== keep.id)
      const drives = Array.from(
        new Set(
          group
            .map((f) => (f.driveNumber || '').toString())
            .join(',')
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => Number(a) - Number(b))
      const newDrive = drives.join(', ')
      const newCopies = group.reduce((sum, f) => sum + (Number(f.copies) || 1), 0)

      statements.push(
        `UPDATE films SET driveNumber = '${esc(newDrive)}', copies = ${newCopies}, updatedAt = datetime('now') WHERE id = '${esc(keep.id)}';`
      )
      for (const o of others) {
        statements.push(`DELETE FROM films WHERE id = '${esc(o.id)}';`)
      }
      summary.push(`   ✓ ${keep.title} (${keep.year || '—'}) → Drive ${newDrive}, ${newCopies} copies — ${others.length} رکورد حذف شد`)
    }

    console.log(`🚀 اجرای ${statements.length} دستور روی D1 (یک درخواست)...`)
    runMutations(statements.join('\n'))
    console.log('✅ ادغام خودکار تمام شد.\n')
    summary.forEach((line) => console.log(line))
  }

  if (needsReview.length > 0) {
    console.log('\n⚠️  این گروه‌ها نیاز به بررسی دستی دارن (فیلدهاشون فرق داره):')
    for (const group of needsReview) {
      console.log(`   • ${group[0].title} (${group[0].year || '—'}) — ${group.length} رکورد`)
      for (const f of group) {
        console.log(
          `       id=${f.id} drive=${f.driveNumber || '—'} format=${f.format || '—'} rating=${f.rating || '—'} runtime=${f.runtime || '—'}`
        )
      }
    }
  }
}

main()
