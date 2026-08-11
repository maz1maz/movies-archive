// پاس دوم ادغام داپلیکیت‌ها — بعد از پاس اول (که فقط موارد کاملاً یکسان رو
// ادغام می‌کرد)، این نسخه معیار سخت‌گیرانه رو شل‌تر می‌کنه:
//   «امن» = rating و runtime دقیقاً یکسان باشن (صرف‌نظر از تفاوت جزئی تو
//   پوستر/سینوپسیس که معمولاً فقط اختلاف کوچیک تو منبع اسکرپ‌شده‌ست).
// برای فیلد format، هر مقداری که خالی/— نباشه برنده می‌شه.
// درایوهای تکراری داخل خود یه رکورد (مثل "Drive 9, Drive 9") هم موقع ادغام
// یکتا می‌شن.
//
// هر گروهی که rating یا runtime متفاوت داره، دست‌نخورده می‌مونه و تو گزارش
// پایانی با مشخص‌کردن AINAً کدوم فیلد فرق داره لیست می‌شه.

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
    if (start === -1 || end === -1 || end < start) throw new Error('Could not find JSON in wrangler output:\n' + out)
    jsonText = out.slice(start, end + 1)
  }
  return JSON.parse(jsonText)[0]?.results || []
}

function runQuery(sql) {
  let out
  if (IS_WIN) {
    const quoted = '"' + sql.replace(/"/g, '""') + '"'
    const cmd = `${NPX_CMD} wrangler d1 execute ${DB_NAME} --remote --json --command ${quoted}`
    out = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 200, env: ENV })
  } else {
    out = execFileSync(NPX_CMD, ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', sql], {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 200,
      env: ENV,
    })
  }
  return extractJsonResults(out)
}

function runMutations(sql) {
  const tmpFile = `.tmp-d1-${randomUUID()}.sql`
  writeFileSync(tmpFile, sql, 'utf-8')
  try {
    execFileSync(NPX_CMD, ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--yes', '--file', tmpFile], {
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
function isBlank(v) {
  return v == null || String(v).trim() === '' || String(v).trim() === '—'
}
function dedupeDrives(str) {
  return Array.from(
    new Set(
      String(str || '')
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
    )
  ).join(', ')
}

function main() {
  console.log('📥 خوندن کل جدول films از D1...')
  const rows = runQuery('SELECT * FROM films;')
  console.log(`   ${rows.length} رکورد خونده شد.`)
  if (rows.length < 100) {
    console.log('⚠️  تعداد کم مشکوکه، متوقف می‌شم.')
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

  const safe = []
  const needsReview = []
  for (const group of dupGroups) {
    const base = group[0]
    const sameCore = group.every(
      (f) => String(f.rating || '') === String(base.rating || '') && String(f.runtime || '') === String(base.runtime || '')
    )
    if (sameCore) safe.push(group)
    else needsReview.push(group)
  }

  console.log(`✅ ${safe.length} گروه امن (rating+runtime یکسان)`)
  console.log(`⚠️  ${needsReview.length} گروه نیاز به بررسی دستی (rating یا runtime فرق داره)\n`)

  if (safe.length) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(`backup-before-merge2-${ts}.json`, JSON.stringify(rows, null, 2))
    console.log(`💾 backup-before-merge2-${ts}.json ذخیره شد.\n`)

    const statements = []
    const summary = []
    for (const group of safe) {
      const keep = group.reduce((a, b) => (String(a.id) < String(b.id) ? a : b))
      const others = group.filter((f) => f.id !== keep.id)
      const drives = dedupeDrives(group.map((f) => f.driveNumber || '').join(','))
      const newCopies = group.reduce((sum, f) => sum + (Number(f.copies) || 1), 0)
      const format = group.map((f) => f.format).find((v) => !isBlank(v)) || keep.format
      const poster = group.map((f) => f.poster).find((v) => !isBlank(v)) || keep.poster
      const synopsis = group.map((f) => f.synopsis).find((v) => !isBlank(v)) || keep.synopsis

      statements.push(
        `UPDATE films SET driveNumber = ${drives ? `'${esc(drives)}'` : 'NULL'}, copies = ${newCopies}, format = ${
          format ? `'${esc(format)}'` : 'NULL'
        }, poster = ${poster ? `'${esc(poster)}'` : 'NULL'}, synopsis = ${
          synopsis ? `'${esc(synopsis)}'` : 'NULL'
        }, updatedAt = datetime('now') WHERE id = '${esc(keep.id)}';`
      )
      for (const o of others) statements.push(`DELETE FROM films WHERE id = '${esc(o.id)}';`)
      summary.push(`   ✓ ${keep.title} (${keep.year || '—'}) → Drive ${drives || '—'}, ${newCopies} copies — ${others.length} حذف شد`)
    }

    console.log(`🚀 اجرای ${statements.length} دستور...`)
    runMutations(statements.join('\n'))
    console.log('✅ تمام شد.\n')
    summary.forEach((l) => console.log(l))
  } else {
    console.log('چیزی برای ادغام خودکار نبود.')
  }

  if (needsReview.length) {
    console.log('\n⚠️  این گروه‌ها واقعاً نیاز به تصمیم دستی دارن:')
    for (const group of needsReview) {
      const base = group[0]
      const diffs = []
      if (!group.every((f) => String(f.rating || '') === String(base.rating || ''))) diffs.push('rating')
      if (!group.every((f) => String(f.runtime || '') === String(base.runtime || ''))) diffs.push('runtime')
      console.log(`   • ${base.title} (${base.year || '—'}) — فرق تو: ${diffs.join(', ')}`)
      for (const f of group) {
        console.log(`       id=${f.id} drive=${f.driveNumber || '—'} format=${f.format || '—'} rating=${f.rating || '—'} runtime=${f.runtime || '—'}`)
      }
    }
  }
}

main()
