// اسکریپت ساخت اطلس ساده (JPG) برای گالری کروی
// اجرا: node scripts/build-sphere-atlas.mjs
//
// چرا این اسکریپت لازم بود: قبلاً گالری سعی می‌کرد پوسترها رو مستقیم از
// مرورگر (یا از Worker) در لحظه دانلود کنه. مشکل: ۹۳٪ پوسترها از
// media-amazon.com میان، و اون سرور IPهای دیتاسنتر (کلودفلر، و بیشتر
// سرویس‌های ابری) رو با 502/بلاک جواب می‌ده. این اسکریپت از کامپیوتر خودت
// (IP عادی خونگی) اجرا می‌شه که این مشکل رو نداره، و نتیجه رو یه‌بار برای
// همیشه توی یه فایل JPG می‌ذاره — گالری دیگه هیچ درخواست زنده‌ای به Amazon
// نمی‌زنه.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const FILMS_JSON = path.join(ROOT, 'films.json')
const OUT_DIR = path.join(ROOT, 'public/sphere-media')
// کش خام پوسترهای دانلودشده (raw bytes، قبل از resize) — چون tile
// size/quality رو ممکنه چندبار تنظیم کنیم، بدون این کش هر تغییر یعنی
// دوباره ۹۰۰۰+ درخواست به Amazon (چند دقیقه). این پوشه گیت‌ایگنور شده.
const CACHE_DIR = path.join(ROOT, '.cache/poster-atlas')

const TILE_W = 38
const TILE_H = 57
const CONCURRENCY = 10 // ملایم، چون بازم از یه IP واحده — نه اونقدر که Amazon شاکی بشه

function cacheKeyFor(url) {
  return crypto.createHash('sha1').update(url).digest('hex')
}

async function fetchPosterBuffer(url) {
  const cachePath = path.join(CACHE_DIR, cacheKeyFor(url))
  if (existsSync(cachePath)) return readFile(cachePath)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (CinefilioArchive personal use)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(cachePath, buf).catch(() => {})
  return buf
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })
  const films = JSON.parse(await readFile(FILMS_JSON, 'utf-8'))
  const LIMIT = process.env.GALLERY_LIMIT ? Number(process.env.GALLERY_LIMIT) : Infinity
  const seenPosters = new Set()
  const withPoster = films
    .filter((f) => f.poster)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .filter((f) => {
      if (seenPosters.has(f.poster)) return false
      seenPosters.add(f.poster)
      return true
    })
    .slice(0, LIMIT)

  const cols = Math.ceil(Math.sqrt(withPoster.length))
  const rows = Math.ceil(withPoster.length / cols)
  const gridW = cols * TILE_W
  const gridH = rows * TILE_H

  console.log(`📦 ${withPoster.length} پوستر یکتا → اطلس ${cols}x${rows} (${gridW}x${gridH}px)`)
  console.log(`🌐 دانلود (${CONCURRENCY} همزمان، ممکنه چند دقیقه طول بکشه)...`)

  const composites = new Array(withPoster.length)
  let idx = 0
  let done = 0
  let failed = 0

  async function worker() {
    while (idx < withPoster.length) {
      const i = idx++
      const f = withPoster[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      try {
        const raw = await fetchPosterBuffer(f.poster)
        const tile = await sharp(raw).resize(TILE_W, TILE_H, { fit: 'cover' }).ensureAlpha().raw().toBuffer()
        composites[i] = { input: tile, raw: { width: TILE_W, height: TILE_H, channels: 4 }, left: col * TILE_W, top: row * TILE_H }
      } catch (err) {
        failed++
      }
      done++
      if (done % 500 === 0) console.log(`  ${done}/${withPoster.length} (${failed} خطا تا الان)`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`✅ ${done - failed} موفق، ${failed} ناموفق (لینک شکسته/غیرقابل‌دسترس)`)

  console.log('🖼  ترکیب نهایی...')
  await mkdir(OUT_DIR, { recursive: true })
  // WebP به‌جای JPEG: در همین کیفیت چشمی، حجم فایل نهایی رو به‌طرز محسوسی
  // کمتر می‌کنه (برای گالری که کاربر منتظر لودشدنشه، این مهمه) — همه‌ی
  // مرورگرهای امروزی WebP رو پشتیبانی می‌کنن.
  await sharp({
    create: { width: gridW, height: gridH, channels: 4, background: { r: 20, g: 20, b: 22, alpha: 255 } },
  })
    .composite(composites.filter(Boolean))
    .webp({ quality: 62 })
    .toFile(path.join(OUT_DIR, 'atlas.webp'))

  const config = { cols, rows, count: withPoster.length, ids: withPoster.map((f) => f.id), titles: withPoster.map((f) => f.title) }
  await writeFile(path.join(OUT_DIR, 'atlas-config.json'), JSON.stringify(config, null, 2))

  console.log('✅ public/sphere-media/atlas.webp')
  console.log('✅ public/sphere-media/atlas-config.json')
  console.log('\nهر وقت films.json به‌روز شد، دوباره همین اسکریپت رو بزن.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
