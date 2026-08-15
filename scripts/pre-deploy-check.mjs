// اسکریپت تست خودکار قبل از دیپلوی — به‌صورت predeploy زیر npm run deploy اجرا می‌شه.
// اگه هر کدوم از چک‌ها fail بشه، با exit code غیرصفر متوقف می‌شه و دیپلوی انجام نمی‌گیره.
//
// چک‌ها:
//   1) سینتکس همه‌ی فایل‌های server/*.js
//   2) build کامل frontend (vite build)
//   3) تطبیق جدول‌های schema.sql با چیزی که worker.js واقعاً بهش رفرنس می‌ده
//      (فقط هشدار می‌ده، fail نمی‌کنه — چون بعضی جدول‌ها ممکنه عمداً حذف‌شده باشن)
//   4) اگه اپ لایوه (بعد از دیپلوی قبلی)، /api/debug/checks رو می‌زنه و
//      وضعیت OMDb/TMDB رو چاپ می‌کنه (فقط اطلاع‌رسانیه، fail نمی‌کنه)

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

let hasError = false
const warn = (msg) => console.warn(`⚠️  ${msg}`)
const fail = (msg) => {
  console.error(`❌ ${msg}`)
  hasError = true
}
const ok = (msg) => console.log(`✅ ${msg}`)

// ---- 1) سینتکس فایل‌های سرور ----
console.log('\n— بررسی سینتکس server/*.js —')
const serverDir = path.join(ROOT, 'server')
const serverFiles = fs.readdirSync(serverDir).filter((f) => f.endsWith('.js'))
for (const f of serverFiles) {
  const full = path.join(serverDir, f)
  try {
    execSync(`node --check "${full}"`, { stdio: 'pipe' })
    ok(`server/${f}`)
  } catch (e) {
    fail(`server/${f} — سینتکس خراب:\n${e.stderr?.toString() || e.message}`)
  }
}

// ---- 2) build کامل frontend ----
console.log('\n— npx vite build —')
try {
  execSync('npx vite build', { cwd: ROOT, stdio: 'pipe' })
  ok('vite build موفق بود')
} catch (e) {
  fail(`vite build شکست خورد:\n${e.stdout?.toString() || e.message}`)
}

// ---- 3) تطبیق جدول‌های schema.sql با ارجاعات worker.js ----
console.log('\n— تطبیق schema.sql با worker.js —')
try {
  const schema = fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8')
  const worker = fs.readFileSync(path.join(ROOT, 'server', 'worker.js'), 'utf8')
  const declaredTables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1].toLowerCase())

  // فقط محتوای رشته‌های داخل db.prepare(...) رو بررسی می‌کنیم، نه کل فایل —
  // که جلوی false positive از کامنت‌ها/متن فارسی/جاهای دیگه رو می‌گیره.
  const prepareCalls = [...worker.matchAll(/db\s*\.\s*prepare\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g)].map((m) =>
    m[1].slice(1, -1)
  )
  const SQL_KEYWORDS = new Set(['set', 'select', 'where', 'values'])
  const referenced = new Set()
  for (const sql of prepareCalls) {
    for (const m of sql.matchAll(/\b(?:FROM|INTO|UPDATE)\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi)) {
      const t = m[1].toLowerCase()
      if (!SQL_KEYWORDS.has(t)) referenced.add(t)
    }
  }
  const missing = [...referenced].filter((t) => !declaredTables.includes(t))
  if (missing.length) {
    warn(`جدول‌هایی که تو worker.js استفاده شدن ولی تو schema.sql تعریف نشدن: ${missing.join(', ')}`)
    warn('اگه اخیراً جدولی رو مستقیم تو D1 ساختی (نه از طریق schema.sql)، این طبیعیه — ولی بهتره schema.sql رو هم آپدیت کنی.')
  } else {
    ok('همه‌ی جدول‌های ارجاع‌شده تو worker.js (داخل db.prepare)، تو schema.sql هم تعریف شدن')
  }
} catch (e) {
  warn(`نتونستم schema.sql رو با worker.js تطبیق بدم: ${e.message}`)
}

// ---- 4) اگه آدرس لایو داده شده، سلامت سرویس‌های بیرونی رو چک کن ----
const liveUrl = process.env.DEPLOY_CHECK_URL
if (liveUrl) {
  console.log(`\n— چک زنده‌ی ${liveUrl}/api/debug/checks —`)
  try {
    const res = await fetch(`${liveUrl.replace(/\/$/, '')}/api/debug/checks`, {
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (data.usage?.omdb?.warning) {
      warn(`OMDb امروز به ${data.usage.omdb.count}/${data.usage.omdb.limit} رسیده — نزدیک سقفه`)
    } else if (data.usage?.omdb) {
      ok(`OMDb امروز: ${data.usage.omdb.count}/${data.usage.omdb.limit}`)
    }
    if (data.tmdb?.httpStatus === 200) ok('TMDB سالمه')
    else warn(`TMDB وضعیت غیرمنتظره: ${JSON.stringify(data.tmdb)}`)
  } catch (e) {
    warn(`نتونستم /api/debug/checks رو بزنم (شاید نیاز به لاگین داره یا اپ هنوز بالا نیومده): ${e.message}`)
  }
} else {
  console.log('\n(برای چک زنده‌ی سرویس‌های بیرونی، DEPLOY_CHECK_URL رو ست کن، مثلاً:')
  console.log('  DEPLOY_CHECK_URL=https://your-app.workers.dev npm run deploy)')
}

console.log('')
if (hasError) {
  console.error('❌ حداقل یه چک fail شد — دیپلوی متوقف شد.')
  process.exit(1)
} else {
  console.log('✅ همه‌ی چک‌های ضروری رد شدن — می‌ره برای دیپلوی.')
}
