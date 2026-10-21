// اسکریپت تست خودکار قبل از دیپلوی — به‌صورت predeploy زیر npm run deploy اجرا می‌شه.
// اگه هر کدوم از چک‌ها fail بشه، با exit code غیرصفر متوقف می‌شه و دیپلوی انجام نمی‌گیره.
//
// چک‌ها:
//   0) git: فقط از main که با origin/main یکیه دیپلوی کن، و هیچ شاخه‌ی اخیری
//      نباید کار merge نشده داشته باشه (درس ۲۱ اکتبر: ۹۷ commit از یه شاخه
//      مستقیم دیپلوی شده بودن و هیچ‌وقت merge نشدن؛ دیپلوی بعدی از main
//      همه‌شون رو از سایت حذف کرد). برای رد شدن عمدی: ALLOW_BRANCH_DEPLOY=1
//      یا ALLOW_UNMERGED_BRANCHES=1
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

// ---- 0) git: شاخه‌ی دیپلوی و کارهای merge نشده ----
console.log('\n— بررسی git (شاخه‌ی دیپلوی و شاخه‌های merge نشده) —')
{
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: ROOT, stdio: 'pipe' }).toString().trim()
  // تو CI (مثلاً Cloudflare Workers Builds روی main) فقط هشدار می‌دیم، بلاک نمی‌کنیم
  const inCi = Boolean(process.env.CI || process.env.WORKERS_CI)
  const gitFail = (msg) => (inCi ? warn(msg) : fail(msg))
  try {
    git('rev-parse --git-dir')
    try {
      git('fetch --quiet origin')
    } catch {
      warn('git fetch نشد — وضعیت شاخه‌های remote ممکنه قدیمی باشه')
    }
    const branch = git('rev-parse --abbrev-ref HEAD')
    if (branch !== 'main' && !process.env.ALLOW_BRANCH_DEPLOY) {
      gitFail(`داری از شاخه‌ی «${branch}» دیپلوی می‌کنی، نه main. اول merge کن، بعد از main دیپلوی کن (یا ALLOW_BRANCH_DEPLOY=1).`)
    } else {
      ok(`شاخه‌ی دیپلوی: ${branch}`)
    }
    const notOnMain = Number(git('rev-list --count origin/main..HEAD'))
    if (notOnMain > 0 && !process.env.ALLOW_BRANCH_DEPLOY) {
      gitFail(`${notOnMain} commit تو HEAD هست که تو origin/main نیست — سایت از کدی جلوتر از main ساخته می‌شه.`)
    }
    const behindMain = Number(git('rev-list --count HEAD..origin/main'))
    if (behindMain > 0) {
      gitFail(`HEAD ${behindMain} commit از origin/main عقبه — اول pull کن تا کار بقیه پاک نشه.`)
    }
    // شاخه‌هایی که تو ۳۰ روز اخیر commit دارن و کارشون هنوز تو main نیست
    const monthAgo = Date.now() / 1000 - 30 * 24 * 3600
    const refs = git("for-each-ref --format='%(refname:short) %(committerdate:unix)' refs/remotes/origin")
      .split('\n')
      .map((l) => l.replace(/'/g, '').trim().split(' '))
      .filter(([ref]) => ref && ref !== 'origin/main' && ref !== 'origin/HEAD' && ref !== 'origin')
    const recent = []
    let stale = 0
    let unrelated = 0
    for (const [ref, ts] of refs) {
      // شاخه‌ای که هیچ پایه‌ی مشترکی با main نداره (تاریخچه‌ی قدیمیِ بازنویسی‌شده)
      // نمی‌تونه نسخه‌ی فعلیِ سایت باشه — فقط شمرده می‌شه
      try {
        git(`merge-base origin/main ${ref}`)
      } catch {
        unrelated++
        continue
      }
      // git cherry فقط commitهایی رو می‌شمره که معادلشون (همون patch) تو main
      // نیست — پس شاخه‌هایی که squash-merge شدن، «merge نشده» حساب نمی‌شن
      const ahead = git(`cherry origin/main ${ref}`)
        .split('\n')
        .filter((l) => l.startsWith('+')).length
      if (!ahead) continue
      if (Number(ts) >= monthAgo) recent.push(`${ref} (${ahead} commit)`)
      else stale++
    }
    if (unrelated) warn(`${unrelated} شاخه هیچ تاریخچه‌ی مشترکی با main ندارن (نادیده گرفته شدن)`)
    if (recent.length && !process.env.ALLOW_UNMERGED_BRANCHES) {
      gitFail(
        `این شاخه‌ها کار merge نشده دارن؛ اگه قبلاً مستقیم دیپلوی شده باشن، این دیپلوی حذفشون می‌کنه:\n   ${recent.join('\n   ')}\n   اول merge کن یا مطمئن شو لازم نیستن (ALLOW_UNMERGED_BRANCHES=1).`
      )
    } else if (recent.length) {
      warn(`شاخه‌های merge نشده (با ALLOW_UNMERGED_BRANCHES رد شد): ${recent.join(', ')}`)
    } else {
      ok('هیچ شاخه‌ی اخیری کار merge نشده نداره')
    }
    if (stale) warn(`${stale} شاخه‌ی قدیمی‌تر از ۳۰ روز هم commit merge نشده دارن (بلاک نمی‌کنن)`)
  } catch (e) {
    warn(`بررسی git انجام نشد: ${e.message}`)
  }
}

// ---- 1) سینتکس فایل‌های سرور (شامل server/lib/*.js) ----
console.log('\n— بررسی سینتکس server/**/*.js —')
const serverDir = path.join(ROOT, 'server')
const listJsFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return listJsFiles(full)
    return e.name.endsWith('.js') ? [full] : []
  })
const serverFiles = listJsFiles(serverDir)
for (const full of serverFiles) {
  const rel = path.relative(ROOT, full)
  try {
    execSync(`node --check "${full}"`, { stdio: 'pipe' })
    ok(rel)
  } catch (e) {
    fail(`${rel} — سینتکس خراب:\n${e.stderr?.toString() || e.message}`)
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

// ---- 3) تطبیق جدول‌های schema.sql با ارجاعات worker.js + server/lib/*.js ----
console.log('\n— تطبیق schema.sql با worker.js —')
try {
  const schema = fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8')
  // منطق worker.js قبلاً تیکه‌تیکه به server/lib/*.js منتقل شده، پس db.prepare
  // ممکنه تو هر کدوم از این فایل‌ها باشه، نه فقط worker.js.
  const worker = serverFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
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
    warn(`جدول‌هایی که استفاده شدن ولی تو schema.sql تعریف نشدن: ${missing.join(', ')}`)
    warn('اگه اخیراً جدولی رو مستقیم تو D1 ساختی (نه از طریق schema.sql)، این طبیعیه — ولی بهتره schema.sql رو هم آپدیت کنی.')
  } else {
    ok('همه‌ی جدول‌های ارجاع‌شده (داخل db.prepare)، تو schema.sql هم تعریف شدن')
  }
} catch (e) {
  warn(`نتونستم schema.sql رو با کد سرور تطبیق بدم: ${e.message}`)
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
