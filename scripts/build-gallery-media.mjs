// اسکریپت ساخت مدیای فشرده‌ی گالری برای Voroforce
// اجرا: node scripts/build-gallery-media.mjs
//
// از films.json (خروجی فعلی آرشیو، همون فایلی که ریشه‌ی ریپو هست) می‌خونه،
// پوسترها رو (که URL ریموت هستن، مثل m.media-amazon.com) دانلود می‌کنه،
// توی یک گرید می‌چینه، با DXT1 فشرده می‌کنه، و یه فایل .dds واقعی می‌سازه.
//
// هر وقت films.json به‌روز شد (فیلم جدید اضافه شد)، دوباره اجراش کن.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import dxt from 'dxt-js'

const ROOT = path.resolve(import.meta.dirname, '..')
const FILMS_JSON = path.join(ROOT, 'films.json')
const OUT_DIR = path.join(ROOT, 'public/gallery-media')

const TILE_W = 64
const TILE_H = 96
const CONCURRENCY = 16

async function fetchPosterBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  const films = JSON.parse(await readFile(FILMS_JSON, 'utf-8'))
  const LIMIT = process.env.GALLERY_LIMIT ? Number(process.env.GALLERY_LIMIT) : Infinity
  const seenPosters = new Set()
  const withPoster = films
    .filter((f) => f.poster)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    // یکتاسازی بر اساس آدرس پوستر — دقیقاً همون منطقی که GalleryPanel.jsx
    // سمت کلاینت اجرا می‌کنه، تا index دو طرف هماهنگ بمونه.
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

  console.log(`📦 ${withPoster.length} فیلم دارای پوستر → گرید ${cols}x${rows}`)
  console.log(`🌐 دانلود پوسترها (${CONCURRENCY} همزمان)...`)

  const composites = new Array(withPoster.length)
  let idx = 0
  let done = 0

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
        console.warn(`⚠️  رد شد: ${f.title} (${err.message})`)
      }
      done++
      if (done % 200 === 0) console.log(`  ${done}/${withPoster.length}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log('🖼  ساخت اطلس...')
  const gridRGBA = await sharp({
    create: { width: gridW, height: gridH, channels: 4, background: { r: 20, g: 20, b: 22, alpha: 255 } },
  })
    .composite(composites.filter(Boolean))
    .raw()
    .toBuffer()

  console.log('🗜  فشرده‌سازی DXT1...')
  const compressed = dxt.compress(gridRGBA, gridW, gridH, dxt.flags.DXT1)
  console.log(`  ${(gridRGBA.length / 1024 / 1024).toFixed(1)}MB → ${(compressed.length / 1024 / 1024).toFixed(1)}MB`)

  await mkdir(path.join(OUT_DIR, 'dds'), { recursive: true })
  await writeFile(path.join(OUT_DIR, 'dds/0.dds'), makeDdsFile(compressed, gridW, gridH))
  console.log('✅ public/gallery-media/dds/0.dds')

  const mediaConfig = {
    enabled: true,
    baseUrl: '/gallery-media',
    preload: 'v0',
    compressionFormat: 'dds',
    versions: [{ cols, rows, width: gridW, height: gridH, layers: 1, layerSrcFormat: '/dds/{INDEX}.{EXT}', type: 'compressed-grid' }],
  }
  await writeFile(path.join(OUT_DIR, 'vf-media-config.json'), JSON.stringify(mediaConfig, null, 2))
  console.log('✅ public/gallery-media/vf-media-config.json')
  console.log('\nترتیب فیلم‌ها بر اساس id مرتب شده (پایدار).')
  console.log('GalleryPanel هم دقیقاً همین مرتب‌سازی رو انجام می‌ده تا index هماهنگ بمونه.')
}

function makeDdsFile(compressedBytes, width, height) {
  const header = Buffer.alloc(128)
  header.writeUInt32LE(0x20534444, 0)
  header.writeUInt32LE(124, 4)
  header.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000 | 0x80000, 8)
  header.writeUInt32LE(height, 12)
  header.writeUInt32LE(width, 16)
  header.writeUInt32LE(compressedBytes.length, 20)
  header.writeUInt32LE(0, 24)
  header.writeUInt32LE(0, 28)
  header.writeUInt32LE(32, 76)
  header.writeUInt32LE(0x4, 80)
  header.write('DXT1', 84, 'ascii')
  header.writeUInt32LE(0x1000, 108)
  return Buffer.concat([header, Buffer.from(compressedBytes)])
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
