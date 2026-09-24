import { decodeHtmlEntities } from '../helpers.js'


// آدرس صفحه‌ی شخصیِ letterboxd.com (actor یا director) رو با امتحان کردن
// اسلاگ ساخته‌شده از اسم پیدا می‌کنه. اگه هیچ‌کدوم جواب نداد (اسم غیرمعمول
// یا Letterboxd اصلاً صفحه‌ای براش نداره)، null برمی‌گردونه و فرانت به لینک
// جستجو fallback می‌کنه.
export async function resolveLetterboxdPersonUrl(name) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) return null
  const headers = { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' }
  for (const kind of ['actor', 'director']) {
    try {
      const res = await fetch(`https://letterboxd.com/${kind}/${slug}/`, { headers })
      if (res.ok) return `https://letterboxd.com/${kind}/${slug}/`
    } catch {}
  }
  return null
}


// فید RSS شخصیِ لترباکس (letterboxd.com/USERNAME/rss/) رو پارس می‌کنه و از هر
// آیتم دیاری، عنوان/سال فیلم، امتیاز شخصی (۰ تا ۵)، متن نظر (اگه نوشته باشه)
// و لینک و تاریخ تماشا رو در میاره. فید فقط ~۵۰ ورودی آخر رو می‌ده.
// Sync برای چند نفر (سعید/علیرضا/...) — بر خلاف /api/letterboxd-sync که
// روی فیلدهای مشترک و تکی personalReview/myRating می‌نویسه (فقط برای صاحب
// آرشیو مناسبه)، این تابع رتبه/نقد هرکس رو با نام خودش توی آرایه‌ی چندنویسنده‌ی
// reviews[] ذخیره می‌کنه — دقیقاً همون مکانیزم «Apply to archive» توی داشبورد.
// فید RSS لترباکس فقط ~۵۰ ورودی دیاری آخر رو می‌ده، برای همین هر بار فقط
// همین اواخر رو چک می‌کنه، نه کل تاریخچه.
export async function syncLetterboxdUserToReviews(db, username, authorLabel) {
  const res = await fetch(`https://letterboxd.com/${encodeURIComponent(username)}/rss/`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0)' },
  })
  if (!res.ok) throw new Error(`Letterboxd username '${username}' not found or feed unavailable (${res.status})`)
  const xml = await res.text()
  const entries = parseLetterboxdRss(xml)

  let matched = 0
  let updated = 0
  for (const entry of entries) {
    if (!entry.filmTitle || (!entry.reviewText && entry.memberRating == null)) continue
    const row = await db
      .prepare(
        `SELECT id, reviews FROM films
         WHERE mediaType != 'digital' AND itemType != 'series' AND LOWER(title) = ?
         AND (year IS ? OR year = ?)`
      )
      .bind(entry.filmTitle.trim().toLowerCase(), entry.filmYear ?? null, entry.filmYear ?? null)
      .first()
    if (!row) continue
    matched++

    let existingReviews = []
    try {
      existingReviews = row.reviews ? JSON.parse(row.reviews) : []
      if (!Array.isArray(existingReviews)) existingReviews = []
    } catch {
      existingReviews = []
    }

    const newEntry = {
      author: authorLabel,
      text: entry.reviewText || null,
      rating: entry.memberRating != null ? Math.round(entry.memberRating) : null,
    }
    // اگه قبلاً از همین نویسنده نقدی برای این فیلم ثبت شده، جایگزینش کن
    // (نه اضافه‌کردنِ تکراری) — تا هربار sync، ورودی‌های تکراری تلنبار نشه.
    const withoutThisAuthor = existingReviews.filter((r) => r.author !== authorLabel)
    const mergedReviews = [...withoutThisAuthor, newEntry]

    await db.prepare('UPDATE films SET reviews = ? WHERE id = ?').bind(JSON.stringify(mergedReviews), row.id).run()
    updated++
  }
  return { username, authorLabel, processed: entries.length, matched, updated }
}


export function parseLetterboxdRss(xml) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
  return items.map((raw) => {
    const grab = (tag) => {
      const m = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
      if (!m) return null
      return m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim()
    }
    const filmTitle = grab('letterboxd:filmTitle')
    const filmYearRaw = grab('letterboxd:filmYear')
    const memberRatingRaw = grab('letterboxd:memberRating')
    const watchedDate = grab('letterboxd:watchedDate')
    const link = grab('link')
    let descriptionHtml = grab('description') || ''
    // توضیحات هر آیتم معمولاً یه <img> پوستر و بعدش متن نظر (اگه نوشته باشه)
    // هست؛ عکس و تگ‌های HTML رو حذف می‌کنیم تا فقط متن نظر بمونه.
    let reviewText = descriptionHtml
      .replace(/<img[^>]*>/gi, '')
      .replace(/<p>\s*Watched on[^<]*<\/p>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
    if (!reviewText) reviewText = null
    return {
      filmTitle,
      filmYear: filmYearRaw ? parseInt(filmYearRaw, 10) : null,
      memberRating: memberRatingRaw ? parseFloat(memberRatingRaw) : null,
      watchedDate,
      link,
      reviewText,
    }
  })
}


// جستجوی فیلم توی Letterboxd و استخراج امتیاز میانگین از تگ متای صفحه‌ش.
// صفحه‌ی سرچ Letterboxd با جاوااسکریپت رندر می‌شه (توی HTML خام چیزی نیست)،
// برای همین به‌جاش مستقیم از روی عنوان، اسلاگ صفحه‌ی فیلم رو می‌سازیم — که
// خودِ صفحه‌ی فیلم (بر خلاف صفحه‌ی سرچ) سمت سرور رندر می‌شه و تگ متا داره.
export function metaContent(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return decodeHtmlEntities(m[1])
  }
  return null
}


// روی خودِ HTML صفحه‌ی فیلم Letterboxd (نه از طریق API) پارس می‌کنه تا یه پایه‌ی
// اولیه از عنوان/سال/کارگردان/بازیگرها/خلاصه/پوستر بسازه. برای فیلم‌های خیلی جدید
// که هنوز توی OMDb نیستن، این تنها منبعیه که داریم.
export function parseLetterboxdBasic(html) {
  const out = {}
  const ogTitle = metaContent(html, 'og:title')
  if (ogTitle) {
    const yearMatch = ogTitle.match(/\((\d{4})\)\s*$/)
    if (yearMatch) out.year = parseInt(yearMatch[1], 10)
    out.title = ogTitle.replace(/\s*\(\d{4}\)\s*$/, '').trim()
  }
  const desc = metaContent(html, 'og:description') || metaContent(html, 'description')
  if (desc) out.synopsis = desc.trim()

  const directorMatch = html.match(/\/director\/[^"']+["'][^>]*>([^<]+)</i)
  if (directorMatch) out.director = decodeHtmlEntities(directorMatch[1].trim())

  const castMatches = [...html.matchAll(/\/actor\/[^"']+["'][^>]*>([^<]+)</gi)]
  if (castMatches.length) {
    const names = [...new Set(castMatches.map((m) => decodeHtmlEntities(m[1].trim())).filter(Boolean))]
    out.cast = names.slice(0, 10)
  }

  return out
}


export function titleToLetterboxdSlug(title) {
  return (title || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}


export async function fetchLetterboxdRating(title, year) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; CinefilioArchive/1.0; personal film archive app)' }
  const baseSlug = titleToLetterboxdSlug(title)
  if (!baseSlug) return null
  const candidates = year ? [baseSlug, `${baseSlug}-${year}`] : [baseSlug]

  for (const slug of candidates) {
    try {
      const filmRes = await fetch(`https://letterboxd.com/film/${slug}/`, { headers })
      if (!filmRes.ok) continue
      const filmHtml = await filmRes.text()
      const ratingMatch = filmHtml.match(/name="twitter:data2"\s+content="([\d.]+)\s+out of 5"/)
      if (!ratingMatch) continue
      const rating = parseFloat(ratingMatch[1])
      if (isNaN(rating)) continue

      let count = null
      try {
        // فرگمنت هیستوگرام امتیازها؛ عدد دقیق هر ستاره داخل title هر لینکه
        // (چون متن قابل‌مشاهده‌ش مخفف مثل «13.9K» هست، نه عدد کامل)،
        // مثلاً: title="13,875 ★★ ratings (6%)". همه رو جمع می‌زنیم.
        const histRes = await fetch(`https://letterboxd.com/csi/film/${slug}/rating-histogram/`, {
          headers: { ...headers, Referer: `https://letterboxd.com/film/${slug}/` },
        })
        if (histRes.ok) {
          const histHtml = await histRes.text()
          const matches = [...histHtml.matchAll(/title="([\d,]+)\s+[^"]*ratings[^"]*"/gi)]
          if (matches.length) {
            count = matches.reduce((sum, m) => sum + parseInt(m[1].replace(/,/g, ''), 10), 0)
          }
        }
      } catch {
        // اگه هیستوگرام در دسترس نبود، فقط امتیاز میانگین رو نشون می‌دیم
      }

      return { rating, count }
    } catch {
      // این اسلاگ جواب نداد، اسلاگ بعدی رو امتحان کن
    }
  }
  return null
}
