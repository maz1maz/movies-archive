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
// قبل از هر حذفی، یه بکاپ کامل از جدول films تو KV ذخیره می‌شه (مثل reset-locations)
// تا در صورت اشتباه قابل بازگردانی باشه.

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const DB_NAME = 'movies-archive'

const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function runD1(sql) {
  const out = execFileSync(
    NPX_CMD,
    ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', sql],
    { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 200, shell: process.platform === 'win32' }
  )
  const parsed = JSON.parse(out)
  return parsed[0]?.results || []
}

function normalizeTitle(t) {
  return (t || '').toString().trim().toLowerCase()
}

function main() {
  console.log('📥 خوندن کل جدول films از D1...')
  const rows = runD1('SELECT * FROM films')
  console.log(`   ${rows.length} رکورد خونده شد.`)

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

    console.log('🔧 در حال ادغام...')
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

      const esc = (s) => String(s).replace(/'/g, "''")
      runD1(
        `UPDATE films SET driveNumber = '${esc(newDrive)}', copies = ${newCopies}, updatedAt = datetime('now') WHERE id = '${esc(keep.id)}'`
      )
      for (const o of others) {
        runD1(`DELETE FROM films WHERE id = '${esc(o.id)}'`)
      }
      console.log(`   ✓ ${keep.title} (${keep.year || '—'}) → Drive ${newDrive}, ${newCopies} copies — ${others.length} رکورد حذف شد`)
    }
    console.log('\n✅ ادغام خودکار تمام شد.')
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
