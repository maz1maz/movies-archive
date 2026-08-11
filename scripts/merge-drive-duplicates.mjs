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
// نکته‌ی فنی: به‌جای --command (که تو ویندوز به‌خاطر اسپیس‌های داخل SQL درست
// کوت نمی‌شه و می‌شکنه)، همیشه SQL رو تو یه فایل موقت می‌نویسیم و با --file
// اجرا می‌کنیم — این روی هر پلتفرمی مطمئنه.

import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const DB_NAME = 'movies-archive'
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const IS_WIN = process.platform === 'win32'

function runD1File(sql, { json = false } = {}) {
  const tmpFile = `.tmp-d1-${randomUUID()}.sql`
  writeFileSync(tmpFile, sql, 'utf-8')
  try {
    const args = ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--yes', '--file', tmpFile]
    if (json) args.push('--json')
    const out = execFileSync(NPX_CMD, args, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 200,
      shell: IS_WIN,
      // wrangler چاپ می‌کنه پیام‌های پیشرفت تعاملی («Checking if file needs
      // uploading» و غیره) رو تو stdout حتی با --json، که خروجی رو دیگه JSON
      // خالص نمی‌ذاره. CI=1 این پیام‌های تزئینی رو خاموش می‌کنه.
      env: { ...process.env, CI: '1' },
    })
    if (!json) return out
    // برای اطمینان، به‌جای فرض کردن کل stdout فقط JSON‌ه، دنبال خطی می‌گردیم که
    // خودش با '[' شروع می‌شه (خروجی --json وریلر معمولاً یه خط تک‌خطیه)؛ این از
    // برخورد اشتباه با براکت‌های داخل پیام‌های هشدار (مثل "[WARNING]") جلوگیری می‌کنه.
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
    } catch (e) {
      throw new Error('Failed to parse wrangler JSON output:\n' + out)
    }
    return parsed[0]?.results || []
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
  const rows = runD1File('SELECT * FROM films;', { json: true })
  console.log(`   ${rows.length} رکورد خونده شد.`)

  if (rows.length < 100) {
    console.log(
      '\n⚠️  تعداد رکوردهای خونده‌شده خیلی کمه (احتمالاً یه مشکل تو خوندن خروجی wrangler هست، نه اینکه واقعاً همینقدر فیلم داری).'
    )
    console.log('   برای اطمینان، اجرا رو متوقف می‌کنم تا چیزی اشتباه پاک نشه. لطفاً این پیام رو برام بفرست.')
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
    runD1File(statements.join('\n'))
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
