import { decodeHtmlEntities } from '../helpers.js'
import { isCacheFresh } from './cache.js'


// تیترهای مهم سینمایی از فیدهای RSS چند منبع معتبر — یه بار در روز کش می‌شه
// (عمومیه، نه شخصی‌سازی‌شده).
export async function fetchCinemaHeadlines(db) {
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('headlines').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 6 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const feeds = [
      { url: 'https://variety.com/feed/', source: 'Variety' },
      { url: 'https://www.hollywoodreporter.com/feed/', source: 'The Hollywood Reporter' },
      { url: 'https://www.indiewire.com/feed/', source: 'IndieWire' },
      { url: 'https://deadline.com/feed/', source: 'Deadline' },
    ]
    const headers = { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' }
    const all = []
    for (const f of feeds) {
      try {
        const res = await fetch(f.url, { headers })
        if (!res.ok) continue
        const xml = await res.text()
        all.push(...parseRssItems(xml, f.source))
      } catch {}
    }

    all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    // قبلاً اینجا فقط ۶ تا نگه داشته می‌شد و بعد سمت کلاینت به فیلم/سریال
    // فیلتر می‌شد — با فقط ۶ تیتر کلی (که بیشترشون فیلمه)، بخش «Series
    // news» عملاً همیشه خالی بود. حالا مجموعه‌ی بزرگ‌تری نگه می‌داریم تا
    // بعد از فیلتر شدن هم چیزی برای هر دو دسته بمونه.
    const headlines = all.slice(0, 24)

    // ترجمه‌ی کوتاه فارسیِ هر تیتر انگلیسی، برای نمایش زیر عنوان اصلی
    await Promise.all(
      headlines.map(async (h) => {
        h.titleFa = await translateToFa(h.title)
      })
    )

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('headlines', JSON.stringify(headlines))
      .run()

    return headlines
  } catch {
    return []
  }
}


// ترجمه‌ی سریعِ عنوان. اول MyMemory (رایگان، برای استفاده‌ی برنامه‌نویسی
// طراحی شده، رو IPهای دیتاسنتر مثل Cloudflare Workers پایدارتره) و اگه جواب
// نداد، اندپوینت غیررسمی گوگل ترنسلیت به‌عنوان fallback. اگه هیچ‌کدوم در
// دسترس نبودن یا جواب غیرمنتظره دادن، فقط null برمی‌گردونه و تیتر بدون
// ترجمه نمایش داده می‌شه.
export async function translateToFa(text) {
  if (!text) return null
  const hasPersianChars = (s) => /[\u0600-\u06FF]/.test(s || '')

  const tryMyMemory = async () => {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fa`, {
        headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' },
      })
      if (!res.ok) return null
      const data = await res.json()
      const translated = data?.responseData?.translatedText
      return hasPersianChars(translated) ? translated : null
    } catch {
      return null
    }
  }

  const tryGoogle = async () => {
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fa&dt=t&q=${encodeURIComponent(text)}`,
        { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
      )
      if (!res.ok) return null
      const data = await res.json()
      const parts = data?.[0] || []
      const translated = parts.map((p) => p?.[0]).filter(Boolean).join('')
      return hasPersianChars(translated) ? translated : null
    } catch {
      return null
    }
  }

  // هر دو سرویس رو هم‌زمان می‌زنیم (نه یکی بعد از اون یکی) و هرکدوم زودتر
  // جواب معتبر (شامل حروف فارسی) داد همونو برمی‌داریم — چون این دو سرویسِ
  // رایگان گاهی رو IPهای دیتاسنتری مثل Cloudflare Workers rate-limit می‌شن،
  // اجرای موازی شانس موفقیت رو بدون هزینه‌ی زمانی اضافه بالا می‌بره.
  const [myMemoryResult, googleResult] = await Promise.allSettled([tryMyMemory(), tryGoogle()])
  const a = myMemoryResult.status === 'fulfilled' ? myMemoryResult.value : null
  const b = googleResult.status === 'fulfilled' ? googleResult.value : null
  return a || b || null
}


// تیترهای مهم سینمای فارسی‌زبان (ایران) از چند منبع — همون منطق و کش کش
// انگلیسی، فقط منابع فارسی. بعضی از این فیدها ممکنه گاهی در دسترس نباشن؛
// چون fetch هرکدوم جدا try/catch شده، بقیه‌ی فیدها لطمه نمی‌بینن.
export async function fetchCinemaHeadlinesFa(db) {
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('headlines_fa').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 6 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const feeds = [
      { urls: ['https://cinemacinema.ir/rss', 'https://cinemacinema.ir/feed/'], source: 'سینما سینما' },
      { urls: ['https://www.filmnews.ir/rss', 'https://www.filmnews.ir/feed/'], source: 'فیلم نیوز' },
      { urls: ['https://caffecinema.com/feed/', 'https://www.caffecinema.com/feed/'], source: 'کافه سینما' },
      { urls: ['https://www.cinemapress.ir/rss'], source: 'سینماپرس' },
      { urls: ['http://www.sourehcinema.ir/rss', 'http://www.sourehcinema.ir/feed/'], source: 'سوره سینما' },
    ]
    const headers = { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' }
    // هر منبع رو جدا نگه می‌داریم و بعد round-robin ترکیب می‌کنیم (اول یکی از
    // هر منبع، بعد دومی از هر منبع، ...) تا لیست همیشه از چند منبع پر بشه، نه
    // این‌که یه منبع که بیشتر/سریع‌تر پست می‌ذاره کل لیست رو با sort-by-date پر کنه.
    // هر منبع چند آدرس کاندید داره (RSS مسیرهای مختلفی داره تو سایت‌های مختلف)
    // — اولین آدرسی که جواب داد استفاده می‌شه.
    const perSource = []
    for (const f of feeds) {
      let items = []
      for (const url of f.urls) {
        try {
          const res = await fetch(url, { headers })
          if (!res.ok) continue
          const xml = await res.text()
          const parsed = parseRssItems(xml, f.source)
          if (parsed.length) {
            items = parsed
            break
          }
        } catch {}
      }
      perSource.push(items)
    }
    const maxLen = Math.max(0, ...perSource.map((s) => s.length))
    const interleaved = []
    for (let i = 0; i < maxLen; i++) {
      for (const src of perSource) {
        if (src[i]) interleaved.push(src[i])
      }
    }
    const headlines = interleaved.slice(0, 15)

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('headlines_fa', JSON.stringify(headlines))
      .run()

    return headlines
  } catch {
    return []
  }
}


// پارسر ساده‌ی RSS با regex (Workers دسترسی به DOMParser نداره) — فقط
// title/link/pubDate هر <item> رو در میاره، کافیه برای لیست تیترها.
export function parseRssItems(xml, sourceName) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRegex.exec(xml)) && items.length < 15) {
    const block = m[1]
    const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
    const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''
    const title = decodeHtmlEntities(rawTitle.replace('<![CDATA[', '').replace(']]>', '').trim())
    const link = rawLink.replace('<![CDATA[', '').replace(']]>', '').trim()
    if (title && link) items.push({ title, link, pubDate, source: sourceName })
  }
  return items
}
