import { ENRICHABLE_FIELDS, isEmptyMetadata } from '../helpers.js'
import { enrichFilm } from '../omdb.js'
import { isCacheFresh } from './cache.js'
import { tmdbFetch } from './tmdb.js'
import { applyTmdbExtras, fetchTmdbExtras } from './tmdbEnrich.js'


export function parseFilmRow(row) {
  if (!row) return null
  const film = { ...row }
  if (typeof film.cast === 'string') {
    try { film.cast = JSON.parse(film.cast) } catch { film.cast = [] }
  }
  if (typeof film.genre === 'string') {
    try { film.genre = JSON.parse(film.genre) } catch { film.genre = [] }
  }
  if (typeof film.seasonDrives === 'string' && film.seasonDrives) {
    try { film.seasonDrives = JSON.parse(film.seasonDrives) } catch { film.seasonDrives = [] }
  }
  if (typeof film.reviews === 'string' && film.reviews) {
    try { film.reviews = JSON.parse(film.reviews) } catch { film.reviews = [] }
  } else if (!film.reviews) {
    film.reviews = []
  }
  if (film.watched != null) film.watched = Boolean(film.watched)
  if (film.watchlisted != null) film.watchlisted = Boolean(film.watchlisted)
  if (film.criterion != null) film.criterion = Boolean(film.criterion)
  if (film.hasSubtitle != null) film.hasSubtitle = Boolean(film.hasSubtitle)
  if (film.dubbed != null) film.dubbed = Boolean(film.dubbed)
  if (!film.mediaType) film.mediaType = 'physical'
  if (!film.itemType) film.itemType = 'movie'
  if (!film.copies) film.copies = 1
  if (typeof film.relatedFilms === 'string' && film.relatedFilms) {
    try { film.relatedFilms = JSON.parse(film.relatedFilms) } catch { film.relatedFilms = [] }
  } else if (!film.relatedFilms) {
    film.relatedFilms = []
  }
  if (typeof film.festivalAwards === 'string' && film.festivalAwards) {
    try { film.festivalAwards = JSON.parse(film.festivalAwards) } catch { film.festivalAwards = [] }
  } else if (!film.festivalAwards) {
    film.festivalAwards = []
  }
  if (typeof film.productionCompanies === 'string' && film.productionCompanies) {
    try { film.productionCompanies = JSON.parse(film.productionCompanies) } catch { film.productionCompanies = [] }
  } else if (!film.productionCompanies) {
    film.productionCompanies = []
  }
  if (typeof film.productionCountries === 'string' && film.productionCountries) {
    try { film.productionCountries = JSON.parse(film.productionCountries) } catch { film.productionCountries = [] }
  } else if (!film.productionCountries) {
    film.productionCountries = []
  }
  if (typeof film.spokenLanguages === 'string' && film.spokenLanguages) {
    try { film.spokenLanguages = JSON.parse(film.spokenLanguages) } catch { film.spokenLanguages = [] }
  } else if (!film.spokenLanguages) {
    film.spokenLanguages = []
  }
  film.trailerWatched = Boolean(film.trailerWatched)
  film.cultClassic = Boolean(film.cultClassic)
  film.experimental = Boolean(film.experimental)
  return film
}

// ---------- TMDB Collections (based on / sequel / prequel graph) ----------

// جزئیات کامل یه مجموعه‌ی TMDB (اسم، پوستر، لیست همه‌ی فیلم‌های عضو) —
// ۳۰ روز کش می‌شه چون به‌ندرت تغییر می‌کنه (فقط وقتی فیلم جدیدی به مجموعه اضافه بشه).
export async function fetchCollectionDetails(db, env, collectionId) {
  const cacheKey = `collection:${collectionId}`
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind(cacheKey).first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 30 * 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data)
      } catch {}
    }
  } catch {}

  if (!env.TMDB_API_KEY) return null
  try {
    const res = await tmdbFetch(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${env.TMDB_API_KEY}`, env)
    if (!res.ok) return null
    const data = await res.json()
    const result = {
      id: data.id,
      name: data.name,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w342${data.poster_path}` : null,
      parts: (data.parts || [])
        .filter((p) => p.release_date)
        .map((p) => ({
          tmdbId: p.id,
          title: p.title,
          year: p.release_date ? parseInt(p.release_date.slice(0, 4), 10) : null,
          poster: p.poster_path ? `https://image.tmdb.org/t/p/w185${p.poster_path}` : null,
        }))
        .sort((a, b) => (a.year || 9999) - (b.year || 9999)),
    }
    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind(cacheKey, JSON.stringify(result))
      .run()
    return result
  } catch {
    return null
  }
}


// یه فیلم رو به یه TMDB collection وصل می‌کنه (اگه قبلاً چک نشده باشه). نتیجه
// رو مستقیم روی ردیف films ذخیره می‌کنه (collectionId='' یعنی چک‌شده و متعلق
// به هیچ مجموعه‌ای نیست، تا دوباره هر بار fetch نشه).
const COLLECTION_RECHECK_MS = 30 * 24 * 60 * 60 * 1000

// زمان آخرین چکِ عضویت هر فیلم تو cinema_news_cache (کلید collcheck:<id>)
// نگه داشته می‌شه تا بدون تغییر schema هر ۳۰ روز یه بار دوباره چک بشه.
// ردیف‌های قدیمی که هنوز زمان ندارن «همین الان چک‌شده» حساب می‌شن — یعنی
// جوابشون می‌مونه و ۳۰ روز بعد خودکار تازه می‌شن.
// کلید TMDB از ۲۱ سپتامبر تا این لحظه خراب بود؛ «عضو هیچ مجموعه‌ای نیست»‌هایی
// که قبل از این زمان ثبت شدن قابل اعتماد نیستن و یه‌بار دوباره چک می‌شن.
const TMDB_KEY_FIXED_AT = Date.parse('2026-10-16T19:30:00Z')

async function collectionCheckIsFresh(db, filmId, isEmpty = false) {
  const key = `collcheck:${filmId}`
  try {
    const row = await db.prepare('SELECT fetchedAt FROM cinema_news_cache WHERE key = ?').bind(key).first()
    if (!row) {
      if (isEmpty) return false
      await markCollectionChecked(db, filmId)
      return true
    }
    const checkedAt = new Date(row.fetchedAt.replace(' ', 'T') + (row.fetchedAt.endsWith('Z') ? '' : 'Z')).getTime()
    if (isEmpty && checkedAt < TMDB_KEY_FIXED_AT) return false
    return Date.now() - checkedAt < COLLECTION_RECHECK_MS
  } catch {
    return true
  }
}

async function markCollectionChecked(db, filmId) {
  try {
    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, '1', datetime('now'))")
      .bind(`collcheck:${filmId}`)
      .run()
  } catch {}
}

export async function resolveFilmCollection(db, env, film) {
  if (film.collectionId != null && (await collectionCheckIsFresh(db, film.id, film.collectionId === ''))) {
    // تو ۳۰ روز اخیر چک شده — یا عضو یه مجموعه‌ست، یا مطمئنیم که نیست
    if (!film.collectionId) return null
    return { collectionId: film.collectionId, collectionName: film.collectionName, collectionPoster: film.collectionPoster }
  }
  const cachedResult = film.collectionId
    ? { collectionId: film.collectionId, collectionName: film.collectionName, collectionPoster: film.collectionPoster }
    : null
  if (!env.TMDB_API_KEY || film.itemType === 'series') {
    return null // TMDB collections فقط برای فیلمن، نه سریال
  }

  let tmdbMovieId = null
  // فقط وقتی همه‌ی درخواست‌های TMDB واقعاً جواب دادن «عضو هیچ مجموعه‌ای
  // نیست» ('') ذخیره می‌شه. قبلاً یه خطای گذرا (429/شبکه) هم '' دائمی
  // می‌نوشت و فیلمی مثل Casino Royale برای همیشه مجموعه‌ش رو گم می‌کرد.
  let lookupFailed = false
  try {
    if (film.imdbId) {
      const findRes = await tmdbFetch(`https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${env.TMDB_API_KEY}&external_source=imdb_id`, env)
      if (findRes.ok) {
        const findData = await findRes.json()
        tmdbMovieId = findData?.movie_results?.[0]?.id || null
      } else {
        lookupFailed = true
      }
    }
    if (!tmdbMovieId && film.title) {
      const q = encodeURIComponent(film.title)
      const yearParam = film.year ? `&year=${film.year}` : ''
      const searchRes = await tmdbFetch(`https://api.themoviedb.org/3/search/movie?api_key=${env.TMDB_API_KEY}&query=${q}${yearParam}`, env)
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        tmdbMovieId = searchData?.results?.[0]?.id || null
      } else {
        lookupFailed = true
      }
    }
    if (!tmdbMovieId) {
      if (lookupFailed) return cachedResult
      await db.prepare("UPDATE films SET collectionId = '' WHERE id = ?").bind(film.id).run()
      await markCollectionChecked(db, film.id)
      return null
    }

    const movieRes = await tmdbFetch(`https://api.themoviedb.org/3/movie/${tmdbMovieId}?api_key=${env.TMDB_API_KEY}`, env)
    if (!movieRes.ok) return cachedResult
    const movieData = await movieRes.json()
    const collection = movieData.belongs_to_collection

    if (!collection) {
      await db.prepare("UPDATE films SET collectionId = '' WHERE id = ?").bind(film.id).run()
      await markCollectionChecked(db, film.id)
      return null
    }

    const collectionPoster = collection.poster_path ? `https://image.tmdb.org/t/p/w342${collection.poster_path}` : null
    await db
      .prepare('UPDATE films SET collectionId = ?, collectionName = ?, collectionPoster = ? WHERE id = ?')
      .bind(String(collection.id), collection.name, collectionPoster, film.id)
      .run()
    await markCollectionChecked(db, film.id)
    return { collectionId: String(collection.id), collectionName: collection.name, collectionPoster }
  } catch {
    return cachedResult
  }
}


// اقتباس از کتاب — خودکار از Wikidata، فیلد P144 «based on». اگه فیلم روی
// اثری مبتنیه، اسم اثر + نویسنده (P50) رو برمی‌گردونه. مثل collections، فقط
// یه بار چک می‌شه: basedOnBook=NULL یعنی هنوز چک‌نشده، ''=چک‌شده بدون اقتباس.
export async function resolveBookAdaptation(db, env, film) {
  if (film.basedOnBook != null) {
    if (!film.basedOnBook) return null
    return { basedOnBook: film.basedOnBook, bookAuthor: film.bookAuthor || null }
  }
  if (!film.imdbId) return null

  try {
    const headers = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }
    const sparql = `SELECT ?workLabel ?authorLabel WHERE {
      ?film wdt:P345 "${film.imdbId}".
      ?film wdt:P144 ?work.
      OPTIONAL { ?work wdt:P50 ?author. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`

    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    if (!res.ok) {
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    }
    if (!res.ok) return null
    const data = await res.json()
    const row = data?.results?.bindings?.[0]

    if (!row) {
      await db.prepare("UPDATE films SET basedOnBook = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    const workTitle = row.workLabel?.value || ''
    const author = row.authorLabel?.value || null
    if (!workTitle) {
      await db.prepare("UPDATE films SET basedOnBook = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    await db.prepare('UPDATE films SET basedOnBook = ?, bookAuthor = ? WHERE id = ?').bind(workTitle, author, film.id).run()
    return { basedOnBook: workTitle, bookAuthor: author }
  } catch {
    return null
  }
}


// لوکیشن فیلم‌برداری — خودکار از Wikidata، فیلد P915 «filming location». مثل
// basedOnBook: shootingLocation=NULL یعنی هنوز چک‌نشده، ''=چک‌شده بدون لوکیشن ثبت‌شده.
export async function resolveShootingLocation(db, env, film) {
  if (film.shootingLocation != null) {
    return film.shootingLocation || null
  }
  if (!film.imdbId) return null

  try {
    const headers = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }
    const sparql = `SELECT ?locationLabel WHERE {
      ?film wdt:P345 "${film.imdbId}".
      ?film wdt:P915 ?location.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 5`

    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    if (!res.ok) {
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    }
    if (!res.ok) return null
    const data = await res.json()
    const rows = data?.results?.bindings || []

    if (!rows.length) {
      await db.prepare("UPDATE films SET shootingLocation = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    const locations = [...new Set(rows.map((r) => r.locationLabel?.value).filter(Boolean))].join(', ')
    if (!locations) {
      await db.prepare("UPDATE films SET shootingLocation = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    await db.prepare('UPDATE films SET shootingLocation = ? WHERE id = ?').bind(locations, film.id).run()
    return locations
  } catch {
    return null
  }
}

// جدول تشخیص جشنواره از روی متن اسم جایزه (Wikidata P166) — فقط ۵ جشنواره‌ی
// معتبر اصلی رو می‌شناسیم تا کارت پر از بج نشه؛ جوایز صنفی/منطقه‌ای نادیده
// گرفته می‌شن. هر کدوم یه emoji و رنگ مخصوص به خودش داره (نه لوگوی واقعی —
// به‌خاطر کپی‌رایت، لوگوهای رسمی جشنواره‌ها استفاده نمی‌شن).
export const FESTIVAL_BADGES = [
  { test: /palme d.?or|cannes/i, festival: 'Cannes', icon: '🌿', color: '#d4af37' },
  { test: /golden lion|venice/i, festival: 'Venice', icon: '🦁', color: '#c9a227' },
  { test: /golden bear|berlin/i, festival: 'Berlin', icon: '🐻', color: '#c0392b' },
  { test: /academy award|oscar/i, festival: 'Oscar', icon: '🏆', color: '#f5c518' },
  { test: /sundance/i, festival: 'Sundance', icon: '🏔️', color: '#4a90d9' },
]


// همه‌ی جوایز واقعی فیلم — خودکار از Wikidata P166 «award received»، با سال
// دقیق (P585 قید «point in time») و دسته/عنوان جایزه (مثلاً «Academy Award
// for Best Actor»). ۵ جشنواره‌ی اصلی (بالا) بج و آیکون رنگی می‌گیرن، بقیه‌ی
// جوایز (گلدن گلوب، بفتا، اسکار، امی، جوایز صنفی و ...) هم لیست می‌شن ولی با
// آیکون عمومی. festivalAwards=NULL یعنی هنوز چک‌نشده، '[]'=چک‌شده بدون جایزه.
export async function resolveFestivalAwards(db, env, film) {
  if (film.festivalAwards != null) {
    try {
      return JSON.parse(film.festivalAwards || '[]')
    } catch {
      return []
    }
  }
  if (!film.imdbId) return []

  try {
    const headers = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }
    // p:P166/ps:P166 + pq:P585 برای گرفتن قید «سال» روی خودِ claim
    // (wdt:P166 ساده فقط اسم جایزه رو می‌ده، بدون سال).
    const sparql = `SELECT ?awardLabel ?year WHERE {
      ?film wdt:P345 "${film.imdbId}".
      ?film p:P166 ?statement.
      ?statement ps:P166 ?award.
      OPTIONAL { ?statement pq:P585 ?time. BIND(YEAR(?time) AS ?year) }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 60`

    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    if (!res.ok) {
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    }
    if (!res.ok) return []
    const data = await res.json()
    const rows = data?.results?.bindings || []

    const matched = []
    const seen = new Set()
    for (const r of rows) {
      const label = r.awardLabel?.value
      if (!label) continue
      const year = r.year?.value ? parseInt(r.year.value, 10) : null
      const key = `${label}|${year}`
      if (seen.has(key)) continue
      seen.add(key)
      const badge = FESTIVAL_BADGES.find((b) => b.test.test(label))
      matched.push({
        award: label,
        year,
        festival: badge?.festival || null,
        icon: badge?.icon || '🏅',
        color: badge?.color || '#8a8a8a',
      })
    }

    matched.sort((a, b) => (b.year || 0) - (a.year || 0))
    await db.prepare('UPDATE films SET festivalAwards = ? WHERE id = ?').bind(JSON.stringify(matched), film.id).run()
    return matched
  } catch {
    return []
  }
}


// پوسترهای جایگزین یه فیلم/سریال از TMDB — برای اسلایدشوی خودکار روی کارت
// تو گرید. با imdbId فیلم TMDB رو پیدا می‌کنیم، عکس‌هاش رو می‌گیریم، تا ۵ تای
// برتر (بر اساس رأی) رو نگه می‌داریم. ۳۰ روز کش می‌شه (نتیجه‌ی خالی فقط
// ۳۰ دقیقه، تا اگه فیلم تازه امروز اضافه شده دوباره امتحان بشه).
// اسکن کل آرشیو برای پیدا کردن لینک‌های پوستر خراب (404 یا هر خطای دیگه).
// دسته‌دسته (concurrency محدود) چک می‌شه تا subrequest محدودیت Workers رد
// نشه؛ هر چند صد تا یه‌بار پیشرفت رو تو DB ذخیره می‌کنه تا حتی وسط کار هم
// بشه وضعیتش رو دید.
// اسکن کل آرشیو برای پیدا کردن لینک‌های پوستر خراب (404 یا هر خطای دیگه) —
// تکه‌تکه (هر بار CHUNK_SIZE فیلم). قبلاً بین تکه‌ها با یه fetch واقعی به
// خودِ Worker ادامه می‌داد، ولی self-fetch به دامنه‌ی workers.dev ظاهراً با
// یه محافظت لبه‌ی Cloudflare برخورد می‌کرد و ۴۰۴ می‌گرفت. الان به‌جاش یه
// کرون هر-۱-دقیقه (به wrangler.jsonc نگاه کن) هر بار یه تکه رو پیش می‌بره —
// چون هر تیک کرون یه invocation کاملاً جدا و مستقله، مشکل سقف subrequest هم
// همچنان حل می‌مونه، بدون نیاز به self-fetch.
export async function runPosterAuditChunk(db) {
  const CHUNK_SIZE = 25
  const saveProgress = async (payload) => {
    try {
      await db
        .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES ('poster_audit', ?, datetime('now'))")
        .bind(JSON.stringify(payload))
        .run()
    } catch {}
  }

  try {
    const row = await db.prepare('SELECT data FROM cinema_news_cache WHERE key = ?').bind('poster_audit').first()
    const prev = row ? JSON.parse(row.data) : null
    if (!prev || prev.status !== 'running') return // چیزی برای ادامه نیست

    // قبلاً کل جدول (همه‌ی فیلم‌های دارای پوستر) رو با SELECT بدون LIMIT
    // می‌خوند و فقط سمت JS با slice() یه تکه‌ی ۲۵تایی برمی‌داشت — یعنی هر
    // چانک، صرف‌نظر از اینکه فقط ۲۵ ردیف لازم داشت، هزاران row-read از D1
    // مصرف می‌کرد. الان مستقیم با LIMIT/OFFSET همون ۲۵ تا رو می‌خونه.
    const offset = prev._offset || 0
    const totalRow = await db
      .prepare("SELECT COUNT(*) as cnt FROM films WHERE poster IS NOT NULL AND poster != ''")
      .first()
    const total = (totalRow && totalRow.cnt) || 0
    const batchRows = await db
      .prepare("SELECT id, title, poster FROM films WHERE poster IS NOT NULL AND poster != '' LIMIT ? OFFSET ?")
      .bind(CHUNK_SIZE, offset)
      .all()
    const batch = batchRows.results || []
    const broken = prev.broken || []

    await Promise.all(
      batch.map(async (f) => {
        try {
          const headers = { 'User-Agent': 'CinefilmArchive/1.0 (personal film archive app; poster link check)' }
          let res
          try {
            res = await fetch(f.poster, { method: 'HEAD', headers, signal: AbortSignal.timeout(8000) })
          } catch {
            res = null
          }
          if (!res || !res.ok) {
            res = await fetch(f.poster, { method: 'GET', headers, signal: AbortSignal.timeout(8000) })
          }
          if (!res.ok) broken.push({ id: f.id, title: f.title, poster: f.poster, status: res.status })
        } catch (e) {
          broken.push({ id: f.id, title: f.title, poster: f.poster, status: 'error', error: String(e).slice(0, 80) })
        }
      })
    )

    const newOffset = offset + batch.length
    const done = newOffset >= total
    await saveProgress({
      status: done ? 'done' : 'running',
      total,
      checked: newOffset,
      broken,
      _offset: newOffset,
    })
  } catch (e) {
    await saveProgress({ status: 'error', error: String(e) })
  }
}


export async function fetchAltPosters(db, env, film) {
  const cacheKey = `posters:${film.id}`
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind(cacheKey).first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 30 * 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data)
      } catch {}
    }
  } catch {}

  if (!env.TMDB_API_KEY) return []
  try {
    const mediaType = film.itemType === 'series' ? 'tv' : 'movie'
    let tmdbId = null
    if (film.imdbId) {
      const findRes = await tmdbFetch(`https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${env.TMDB_API_KEY}&external_source=imdb_id`, env)
      if (!findRes.ok) return []
      const findData = await findRes.json()
      tmdbId = findData?.[`${mediaType}_results`]?.[0]?.id || null
    }
    // حدود ۲۰٪ آرشیو imdbId نداره و قبلاً همیشه فقط یه پوستر می‌گرفت —
    // حالا با عنوان+سال تو TMDB جست‌وجو می‌کنیم (مثل resolveFilmCollection).
    if (!tmdbId && film.title) {
      const yearKey = mediaType === 'tv' ? 'first_air_date_year' : 'year'
      const yearParam = film.year ? `&${yearKey}=${film.year}` : ''
      const searchRes = await tmdbFetch(`https://api.themoviedb.org/3/search/${mediaType}?api_key=${env.TMDB_API_KEY}&query=${encodeURIComponent(film.title.replace(/\s*\([^)]*\)\s*$/, ''))}${yearParam}`, env)
      if (!searchRes.ok) return []
      const searchData = await searchRes.json()
      tmdbId = searchData?.results?.[0]?.id || null
    }
    if (!tmdbId) return []

    const imgRes = await tmdbFetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images?api_key=${env.TMDB_API_KEY}`, env)
    if (!imgRes.ok) return []
    const imgData = await imgRes.json()
    const candidates = (imgData.posters || [])
      .filter((p) => p.file_path)
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 10)
      .map((p) => `https://image.tmdb.org/t/p/w500${p.file_path}`)

    // چندتا از این «پوسترهای جایگزین» عکس کاملاً یکسانن (فقط file_path
    // TMDB فرق داره — مثلاً یه‌بار با کیفیت متفاوت آپلود شده). بایت‌های هر
    // عکس رو می‌گیریم و هش می‌کنیم؛ اگه هش یکی بود یعنی عیناً همون عکسه، رد
    // می‌شه. این فقط یه‌بار در ماه (وقتی کش این فیلم منقضی شده) اجرا می‌شه.
    const seenHashes = new Set()
    const posters = []
    for (const url of candidates) {
      if (posters.length >= 5) break
      try {
        const imgFetch = await fetch(url)
        if (!imgFetch.ok) continue
        const buf = await imgFetch.arrayBuffer()
        const hashBuf = await crypto.subtle.digest('SHA-256', buf)
        const hashHex = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')
        if (seenHashes.has(hashHex)) continue
        seenHashes.add(hashHex)
        posters.push(url)
      } catch {
        posters.push(url)
      }
    }

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind(cacheKey, JSON.stringify(posters))
      .run()
    return posters
  } catch {
    return []
  }
}


export async function insertFilm(db, film) {
  const { id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, criterionCopies, copies, mediaType, driveNumber, resolution, videoFormat, hasSubtitle, dubbed, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives,
    originalLanguage, boxOffice, tagline, budget, revenue, metascore, rottenTomatoes, releaseDate,
    productionCompanies, productionCountries, homepage, spokenLanguages, status, popularity,
    network, seriesStatus, schedule } = film
  await db.prepare(
    `INSERT INTO films (id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, criterionCopies, copies, mediaType, driveNumber, resolution, videoFormat, hasSubtitle, dubbed, itemType, seasonsEpisodes, letterboxdRating, watchlisted, seasonDrives,
      originalLanguage, boxOffice, tagline, budget, revenue, metascore, rottenTomatoes, releaseDate,
      productionCompanies, productionCountries, homepage, spokenLanguages, status, popularity,
      network, seriesStatus, schedule)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?)`
  ).bind(
    id, title || null, originalTitle || null, closet || null, shelf || null, row || null,
    director || null, producer || null, cast ? (Array.isArray(cast) ? JSON.stringify(cast) : cast) : null,
    year || null, genre ? (Array.isArray(genre) ? JSON.stringify(genre) : genre) : null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null, myRating || 0, criterion ? 1 : 0,
    criterion ? (criterionCopies || 1) : null,
    copies || 1, mediaType || 'physical', driveNumber || null,
    resolution || null, videoFormat || null, hasSubtitle != null ? (hasSubtitle ? 1 : 0) : null, dubbed != null ? (dubbed ? 1 : 0) : null,
    itemType || 'movie', seasonsEpisodes || null, letterboxdRating || null, watchlisted ? 1 : 0,
    seasonDrives ? (Array.isArray(seasonDrives) ? JSON.stringify(seasonDrives) : seasonDrives) : null,
    originalLanguage || null, boxOffice || null, tagline || null, budget || null, revenue || null,
    metascore || null, rottenTomatoes || null, releaseDate || null,
    productionCompanies ? (Array.isArray(productionCompanies) ? JSON.stringify(productionCompanies) : productionCompanies) : null,
    productionCountries ? (Array.isArray(productionCountries) ? JSON.stringify(productionCountries) : productionCountries) : null,
    homepage || null,
    spokenLanguages ? (Array.isArray(spokenLanguages) ? JSON.stringify(spokenLanguages) : spokenLanguages) : null,
    status || null, popularity || null,
    network || null, seriesStatus || null, schedule || null
  ).run()
}


// بر اساس ?mediaType= و ?itemType= توی کوئری‌استرینگ، یه شرط AND اضافه
// می‌سازه تا enrichBatch/شمارش‌باقی‌مونده فقط رو همون قسمتی که کاربر بازش
// کرده (فیلم فیزیکی/سریال فیزیکی/فیلم دیجیتال/سریال دیجیتال) کار کنه.
// مقدار نامعتبر یا نبودن پارامتر = بدون فیلتر (کل آرشیو، رفتار قبلی).
export function enrichScopeClause(searchParams) {
  const mediaType = searchParams.get('mediaType')
  const itemType = searchParams.get('itemType')
  let clause = ''
  if (mediaType === 'digital') clause += " AND mediaType = 'digital'"
  else if (mediaType === 'physical') clause += " AND (mediaType IS NULL OR mediaType != 'digital')"
  if (itemType === 'series') clause += " AND itemType = 'series'"
  else if (itemType === 'movie') clause += " AND (itemType IS NULL OR itemType != 'series')"
  return clause
}


// یه دسته از فیلم‌های بی‌اطلاعات رو enrich می‌کنه — هم دکمه‌ی «Fill missing
// details» تو اپ، هم کرون روزانه از همین استفاده می‌کنن.
// باگ قبلی (۱): بدون ORDER BY، هر بار همون چند فیلم اولِ بی‌پوستر (که OMDb اصلاً
// پوستری براشون نداره یا اسمشون قابل‌تشخیص نیست) انتخاب می‌شدن؛ دکمه هیچ‌وقت
// به فیلم‌های واقعاً بررسی‌نشده نمی‌رسید.
// باگ قبلی (۲، جدی‌تر): معیار «remaining»/انتخاب کاندیدها شاملِ
// «poster IS NULL OR poster = ''» بود، نه فقط «هنوز امتحان نشده». یعنی فیلمی
// که OMDb واقعاً پوستری براش نداره، حتی بعد از یه بار enrich کامل (که
// metadataEnrichmentAttemptedAt رو هم ست می‌کنه) هنوز «remaining» حساب
// می‌شد و همون فیلم‌های بی‌پوستر دوباره و دوباره انتخاب می‌شدن — یعنی
// دکمه رو یه عدد ثابت (همون تعداد فیلم‌های بی‌پوستر) برای همیشه گیر می‌کرد.
// الان معیار تکمیل‌شدن فقط «امتحان شده یا نه»ست؛ اگه یه‌بار enrich شد و
// OMDb پوستری نداشت، همون‌جا تمومه، دیگه دوباره امتحان نمی‌شه.
// scopeClause (اختیاری): خروجیِ enrichScopeClause، برای محدود کردن به یه بخش خاص.
export async function enrichBatch(db, env, limit, scopeClause = '') {
  const all = await db
    .prepare(
      `SELECT * FROM films
       WHERE metadataEnrichmentAttemptedAt IS NULL${scopeClause}
       ORDER BY id ASC
       LIMIT ?`
    )
    .bind(limit)
    .all()
  const candidates = all.results || []

  let updated = 0
  let quotaExceeded = false
  let apiError = null
  for (const film of candidates) {
    const parsed = parseFilmRow(film)
    const before = { ...parsed }
    let enriched
    try {
      enriched = await enrichFilm(parsed, env.OMDB_API_KEY, () => bumpApiUsage('omdb'))
    } catch (e) {
      if (e.code === 'OMDB_QUOTA_EXCEEDED') {
        quotaExceeded = true
        break
      }
      // مشکل واقعیِ OMDb (کلید نامعتبر، خطای سرویس) — همه‌ی کاندیدهای بعدی
      // هم به همین شکل fail می‌شن، برای همین به‌جای throw کردن (که کل batch/
      // کرون شبانه رو می‌ترکونه)، همینجا متوقف می‌شیم و خطا رو تو جواب برمی‌گردونیم.
      if (e.code === 'OMDB_API_ERROR' || e.code === 'OMDB_HTTP_ERROR') {
        apiError = e.message
        break
      }
      throw e
    }
    try {
      const { extras } = await fetchTmdbExtras(enriched.imdbId, enriched.itemType, env)
      applyTmdbExtras(enriched, extras)
    } catch {}
    const fields = ENRICHABLE_FIELDS.filter((f) => isEmptyMetadata(before[f]) && !isEmptyMetadata(enriched[f]))
    if (fields.length) updated++
    enriched.metadataEnrichmentAttemptedAt = new Date().toISOString()
    await updateFilm(db, enriched)
    try {
      await syncSharedMetadataToSibling(db, enriched)
    } catch {}
  }

  const remaining = await db
    .prepare(
      `SELECT COUNT(*) as count FROM films WHERE metadataEnrichmentAttemptedAt IS NULL${scopeClause}`
    )
    .first()

  return { processed: candidates.length, updated, remaining: remaining?.count || 0, quotaExceeded, apiError }
}


export async function updateFilm(db, film) {
  const { id, title, originalTitle, closet, shelf, row, director, producer, cast, year, genre, rating, runtime, country, synopsis, poster, studio, rated, format, borrowedTo, borrowedDate, watched, imdbId, imdbVotes, metadataEnrichmentAttemptedAt, myRating, criterion, criterionCopies, copies, mediaType, driveNumber, resolution, videoFormat, hasSubtitle, dubbed, itemType, seasonsEpisodes, letterboxdRating, letterboxdVotes, watchlisted, seasonDrives, personalReview, personalReviewUrl, personalReviewDate, reviews,
    cinematicMovement, relatedFilms, trailerWatched, trailerWatchedDate, basedOnBook, bookAuthor, screenwriter, cultClassic, shootingLocation, editionType, festivalAwards, screeningFormat, pacing, experimental, myNotes,
    originalLanguage, boxOffice, tagline, budget, revenue, metascore, rottenTomatoes, releaseDate,
    productionCompanies, productionCountries, homepage, spokenLanguages, status, popularity,
    network, seriesStatus, schedule } = film
  await db.prepare(
    `UPDATE films SET title=?, originalTitle=?, closet=?, shelf=?, row=?, director=?, producer=?, cast=?, year=?, genre=?, rating=?, runtime=?, country=?, synopsis=?, poster=?, studio=?, rated=?, format=?, borrowedTo=?, borrowedDate=?, watched=?, imdbId=?, imdbVotes=?, metadataEnrichmentAttemptedAt=?, myRating=?, criterion=?, criterionCopies=?, copies=?, mediaType=?, driveNumber=?, resolution=?, videoFormat=?, hasSubtitle=?, dubbed=?, itemType=?, seasonsEpisodes=?, letterboxdRating=?, letterboxdVotes=?, watchlisted=?, seasonDrives=?, personalReview=?, personalReviewUrl=?, personalReviewDate=?, reviews=?,
      cinematicMovement=?, relatedFilms=?, trailerWatched=?, trailerWatchedDate=?, basedOnBook=?, bookAuthor=?, screenwriter=?, cultClassic=?, shootingLocation=?, editionType=?, festivalAwards=?, screeningFormat=?, pacing=?, experimental=?, myNotes=?,
      originalLanguage=?, boxOffice=?, tagline=?, budget=?, revenue=?, metascore=?, rottenTomatoes=?, releaseDate=?,
      productionCompanies=?, productionCountries=?, homepage=?, spokenLanguages=?, status=?, popularity=?,
      network=?, seriesStatus=?, schedule=?
     WHERE id=?`
  ).bind(
    title || null, originalTitle || null, closet || null, shelf || null, row || null,
    director || null, producer || null, cast && Array.isArray(cast) ? JSON.stringify(cast) : cast || null,
    year || null, genre && Array.isArray(genre) ? JSON.stringify(genre) : genre || null,
    rating || null, runtime || null, country || null,
    synopsis || null, poster || null, studio || null, rated || null,
    format || null, borrowedTo || null, borrowedDate || null,
    watched ? 1 : 0, imdbId || null, imdbVotes || null,
    metadataEnrichmentAttemptedAt || null, myRating || 0, criterion ? 1 : 0,
    criterion ? (criterionCopies || 1) : null,
    copies || 1, mediaType || 'physical', driveNumber || null,
    resolution || null, videoFormat || null, hasSubtitle != null ? (hasSubtitle ? 1 : 0) : null, dubbed != null ? (dubbed ? 1 : 0) : null,
    itemType || 'movie', seasonsEpisodes || null, letterboxdRating || null, letterboxdVotes || null, watchlisted ? 1 : 0,
    seasonDrives ? (Array.isArray(seasonDrives) ? JSON.stringify(seasonDrives) : seasonDrives) : null,
    personalReview || null, personalReviewUrl || null, personalReviewDate || null,
    reviews ? (Array.isArray(reviews) ? JSON.stringify(reviews) : reviews) : null,
    cinematicMovement || null,
    relatedFilms ? (Array.isArray(relatedFilms) ? JSON.stringify(relatedFilms) : relatedFilms) : null,
    trailerWatched ? 1 : 0, trailerWatchedDate || null,
    basedOnBook || null, bookAuthor || null, screenwriter || null,
    cultClassic ? 1 : 0, shootingLocation || null, editionType || null,
    festivalAwards ? (Array.isArray(festivalAwards) ? JSON.stringify(festivalAwards) : festivalAwards) : null,
    screeningFormat || null, pacing || null, experimental ? 1 : 0, myNotes || null,
    originalLanguage || null, boxOffice || null, tagline || null, budget || null, revenue || null,
    metascore || null, rottenTomatoes || null, releaseDate || null,
    productionCompanies ? (Array.isArray(productionCompanies) ? JSON.stringify(productionCompanies) : productionCompanies) : null,
    productionCountries ? (Array.isArray(productionCountries) ? JSON.stringify(productionCountries) : productionCountries) : null,
    homepage || null,
    spokenLanguages ? (Array.isArray(spokenLanguages) ? JSON.stringify(spokenLanguages) : spokenLanguages) : null,
    status || null, popularity || null,
    network || null, seriesStatus || null, schedule || null,
    id
  ).run()
}

// فیلدهای «توصیفیِ» فیلم که مستقل از فرمت (فیزیکی/دیجیتال) هستن و باید بین
// دو نسخه‌ی هم‌نام (بلوری + دیجیتالِ همون فیلم) یکسان بمونن. فیلدهای مخصوص
// فرمت (closet/shelf/row/driveNumber/format/criterion/copies/watched/...)
// عمداً اینجا نیستن، چون طبیعتاً بین دو نسخه فرق دارن.
export const SHARED_METADATA_FIELDS = [
  'originalTitle', 'director', 'producer', 'cast', 'genre', 'rating',
  'runtime', 'country', 'synopsis', 'poster', 'studio', 'rated',
  'imdbId', 'imdbVotes', 'letterboxdRating', 'letterboxdVotes',
]


// بعد از هر آپدیت/enrich روی یه فیلم، اگه همون فیلم (با عنوان+سال یکسان) هم
// به‌صورت فیزیکی هم دیجیتال توی آرشیو باشه، فیلدهای توصیفی مشترک رو از رکورد
// تازه‌آپدیت‌شده روی نسخه‌ی دیگه هم می‌ریزیم — تا دیگه سینوپسیس/کست/امتیاز
// بین دو نسخه فرق نکنه. دیتای تازه‌تر (همینی که الان آپدیت شد) همیشه ارجحیت داره.
export async function syncSharedMetadataToSibling(db, film) {
  if (!film.title || !film.mediaType) return
  const otherMediaType = film.mediaType === 'digital' ? 'physical' : 'digital'
  const sibling = await db
    .prepare(
      `SELECT * FROM films WHERE id != ? AND mediaType = ? AND LOWER(TRIM(REPLACE(title, char(8217), char(39)))) = LOWER(TRIM(REPLACE(?, char(8217), char(39)))) AND (year IS ? OR year = ?) LIMIT 1`
    )
    .bind(film.id, otherMediaType, film.title, film.year ?? null, film.year ?? null)
    .first()
  if (!sibling) return
  const siblingParsed = parseFilmRow(sibling)
  let changed = false
  for (const key of SHARED_METADATA_FIELDS) {
    const incoming = film[key]
    const isIncomingEmpty = incoming == null || (Array.isArray(incoming) ? incoming.length === 0 : String(incoming).trim() === '')
    if (isIncomingEmpty) continue
    const current = siblingParsed[key]
    const same = Array.isArray(incoming) && Array.isArray(current)
      ? JSON.stringify(incoming) === JSON.stringify(current)
      : incoming === current
    if (!same) {
      siblingParsed[key] = incoming
      changed = true
    }
  }
  if (changed) await updateFilm(db, siblingParsed)
}


// ---------- پر کردن imdbId گمشده از TMDB ----------
// حدود ۲۰٪ آرشیو imdbId نداره (اسم/سال برای OMDb قابل‌تشخیص نبوده)، پس نه
// پوستر جایگزین داره نه امتیاز IMDb. هر بار کرون یه دسته‌ی کوچیک رو با
// جست‌وجوی TMDB پیدا می‌کنه — فقط وقتی عنوان (یا عنوان اصلی) دقیقاً یکی و
// سال حداکثر ۱ سال فرق داره ذخیره می‌کنه، تا فیلم هم‌نام اشتباه ثبت نشه.
// هر فیلم فقط یه‌بار امتحان می‌شه (کلید imdbfill:<id> تو cinema_news_cache).
const normForMatch = (t) =>
  (t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9Ѐ-ӿ؀-ۿ぀-ヿ一-鿿]+/g, '')

export async function backfillImdbIds(db, env, limit = 20) {
  if (!env.TMDB_API_KEY) return { processed: 0, matched: 0 }
  const rows = await db
    .prepare(
      `SELECT id, title, year, itemType FROM films
       WHERE (imdbId IS NULL OR imdbId = '') AND year IS NOT NULL AND title IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM cinema_news_cache c WHERE c.key = 'imdbfill:' || films.id)
       LIMIT ?`
    )
    .bind(limit)
    .all()
  let processed = 0
  let matched = 0
  for (const film of rows.results || []) {
    const isTv = film.itemType === 'series'
    const kind = isTv ? 'tv' : 'movie'
    const query = encodeURIComponent(film.title.replace(/\s*\([^)]*\)\s*$/, ''))
    const searchRes = await tmdbFetch(`https://api.themoviedb.org/3/search/${kind}?api_key=${env.TMDB_API_KEY}&query=${query}`, env)
    if (!searchRes.ok) break // TMDB در دسترس نیست / rate limit — دفعه‌ی بعد ادامه
    const searchData = await searchRes.json()
    const want = normForMatch(film.title)
    const year = Number(film.year)
    const hit = (searchData.results || []).find((r) => {
      const y = parseInt(((isTv ? r.first_air_date : r.release_date) || '').slice(0, 4), 10)
      if (!y || Math.abs(y - year) > 1) return false
      const names = isTv ? [r.name, r.original_name] : [r.title, r.original_title]
      return names.some((n) => n && normForMatch(n) === want)
    })
    let imdbId = null
    if (hit) {
      const extRes = await tmdbFetch(`https://api.themoviedb.org/3/${kind}/${hit.id}/external_ids?api_key=${env.TMDB_API_KEY}`, env)
      if (!extRes.ok) break
      const ext = await extRes.json()
      if (/^tt\d+$/.test(ext?.imdb_id || '')) imdbId = ext.imdb_id
    }
    if (imdbId) {
      // metadataEnrichmentAttemptedAt خالی می‌شه تا enrich روزانه با همین
      // imdbId امتیاز/اطلاعات IMDb رو پر کنه؛ کش پوسترها هم پاک می‌شه.
      await db
        .prepare("UPDATE films SET imdbId = ?, metadataEnrichmentAttemptedAt = NULL WHERE id = ? AND (imdbId IS NULL OR imdbId = '')")
        .bind(imdbId, film.id)
        .run()
      await db.prepare('DELETE FROM cinema_news_cache WHERE key = ?').bind(`posters:${film.id}`).run()
      matched++
    }
    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind(`imdbfill:${film.id}`, imdbId || '')
      .run()
    processed++
  }
  return { processed, matched }
}


// ---------- بازیگران کامل از TMDB (یه‌بار، ذخیره تو خود ردیف فیلم) ----------
// OMDb فقط ۳ بازیگر اصلی می‌ده (بدون نقش/عکس). اولین بار که فیلمی با ۳ یا
// کمتر بازیگر باز می‌شه، تا ۱۲ بازیگر با نقش و عکس از TMDB گرفته و مستقیم
// تو ستون cast ذخیره می‌شه — دفعه‌های بعد از همون دیتابیس میاد. هر فیلم فقط
// یه‌بار امتحان می‌شه (castfill:<id>)، مگه TMDB جواب نده که بعداً دوباره.
export async function fetchFullCast(db, env, film) {
  if (!env.TMDB_API_KEY || !film) return null
  const flagKey = `castfill:${film.id}`
  const tried = await db.prepare('SELECT 1 FROM cinema_news_cache WHERE key = ?').bind(flagKey).first()
  if (tried) return null
  const markTried = () =>
    db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, '1', datetime('now'))")
      .bind(flagKey)
      .run()
  const isTv = film.itemType === 'series'
  const kind = isTv ? 'tv' : 'movie'
  const key = env.TMDB_API_KEY
  let tmdbId = null
  if (film.imdbId) {
    const r = await tmdbFetch(`https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${key}&external_source=imdb_id`, env)
    if (!r.ok) return null
    const d = await r.json()
    tmdbId = d?.[`${kind}_results`]?.[0]?.id || null
  }
  if (!tmdbId && film.title) {
    const yearKey = isTv ? 'first_air_date_year' : 'year'
    const yearParam = film.year ? `&${yearKey}=${film.year}` : ''
    const r = await tmdbFetch(
      `https://api.themoviedb.org/3/search/${kind}?api_key=${key}&query=${encodeURIComponent(film.title.replace(/\s*\([^)]*\)\s*$/, ''))}${yearParam}`,
      env
    )
    if (!r.ok) return null
    const d = await r.json()
    tmdbId = d?.results?.[0]?.id || null
  }
  if (!tmdbId) {
    await markTried()
    return null
  }
  const creditsPath = isTv ? `tv/${tmdbId}/aggregate_credits` : `movie/${tmdbId}/credits`
  const r = await tmdbFetch(`https://api.themoviedb.org/3/${creditsPath}?api_key=${key}`, env)
  if (!r.ok) return null
  const credits = await r.json()
  const cast = (credits?.cast || [])
    .filter((c) => c?.name)
    .slice(0, 12)
    .map((c) => ({
      name: c.name,
      character: (isTv ? c.roles?.[0]?.character : c.character) || null,
      photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }))
  await markTried()
  const current = Array.isArray(film.cast) ? film.cast : []
  if (cast.length <= current.length) return null
  await db.prepare('UPDATE films SET cast = ? WHERE id = ?').bind(JSON.stringify(cast), film.id).run()
  return cast
}

// عکس بازیگر از TMDB، وقتی ویکی‌پدیا عکس نداره. هر اسم فقط یه‌بار امتحان می‌شه
// (کلید tmdbphoto:<name>)، تا برای بی‌عکس‌ها هر بار درخواست الکی نزنیم.
export async function fetchTmdbPersonPhoto(db, env, name) {
  if (!env?.TMDB_API_KEY || !name) return null
  const key = `tmdbphoto:${name.toLowerCase()}`
  try {
    const tried = await db.prepare('SELECT 1 FROM cinema_news_cache WHERE key = ?').bind(key).first()
    if (tried) return null
    const res = await tmdbFetch(
      `https://api.themoviedb.org/3/search/person?api_key=${env.TMDB_API_KEY}&query=${encodeURIComponent(name)}`,
      env
    )
    if (!res.ok) return null // خطای موقت؛ علامت نزن تا دفعه‌ی بعد دوباره امتحان بشه
    const data = await res.json()
    const target = normForMatch(name)
    const hit = (data.results || []).find((p) => p.profile_path && normForMatch(p.name) === target)
    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, '1', datetime('now'))")
      .bind(key)
      .run()
    return hit ? `https://image.tmdb.org/t/p/w185${hit.profile_path}` : null
  } catch {
    return null
  }
}

// بک‌فیلِ پس‌زمینه‌ی بازیگرها: فیلم‌هایی که ≤۳ بازیگر دارن و هنوز امتحان نشدن.
export async function backfillFullCast(db, env, limit = 18) {
  if (!env.TMDB_API_KEY) return { skipped: 'no key' }
  const { results } = await db
    .prepare(
      `SELECT id, title, year, imdbId, itemType, cast FROM films
       WHERE (cast IS NULL OR cast = '' OR json_valid(cast) = 0 OR json_array_length(cast) <= 3)
         AND NOT EXISTS (SELECT 1 FROM cinema_news_cache c WHERE c.key = 'castfill:' || films.id)
       LIMIT ?`
    )
    .bind(limit)
    .all()
  let filled = 0
  for (const row of results) {
    const got = await fetchFullCast(db, env, parseFilmRow(row)).catch(() => null)
    if (got) filled++
  }
  return { tried: results.length, filled }
}

// عکس‌های صحنه/پشت‌صحنه (backdrops) از TMDB، کش ۹۰ روزه تو cinema_news_cache
// (کلید stills:<id>). فقط لینک ذخیره می‌شه، نه خودِ عکس.
export async function fetchFilmStills(db, env, film) {
  const key = `stills:${film.id}`
  const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind(key).first()
  if (cached && Date.now() - Date.parse(cached.fetchedAt.replace(' ', 'T') + 'Z') < 90 * 86400000) {
    try { return JSON.parse(cached.data) } catch {}
  }
  if (!env.TMDB_API_KEY) return []
  const isTv = film.itemType === 'series'
  const kind = isTv ? 'tv' : 'movie'
  const apiKey = env.TMDB_API_KEY
  let tmdbId = null
  if (film.imdbId) {
    const r = await tmdbFetch(`https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${apiKey}&external_source=imdb_id`, env)
    if (!r.ok) return []
    tmdbId = (await r.json())?.[`${kind}_results`]?.[0]?.id || null
  }
  if (!tmdbId && film.title) {
    const yearKey = isTv ? 'first_air_date_year' : 'year'
    const yearParam = film.year ? `&${yearKey}=${film.year}` : ''
    const r = await tmdbFetch(
      `https://api.themoviedb.org/3/search/${kind}?api_key=${apiKey}&query=${encodeURIComponent(film.title.replace(/\s*\([^)]*\)\s*$/, ''))}${yearParam}`,
      env
    )
    if (!r.ok) return []
    tmdbId = (await r.json())?.results?.[0]?.id || null
  }
  let stills = []
  if (tmdbId) {
    const r = await tmdbFetch(`https://api.themoviedb.org/3/${kind}/${tmdbId}/images?api_key=${apiKey}`, env)
    if (!r.ok) return []
    const d = await r.json()
    stills = (d.backdrops || [])
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 12)
      .map((b) => `https://image.tmdb.org/t/p/w780${b.file_path}`)
  }
  await db
    .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
    .bind(key, JSON.stringify(stills))
    .run()
  return stills
}

// برچسب‌های خودکار از keywordهای TMDB (کالت/تجربی/جنبش‌ها). بدون تغییر schema:
// تو cinema_news_cache با کلید tags:<id> (آرایه‌ی خالی یعنی «چک شد، چیزی نداشت»).
const TAG_RULES = [
  ['cult', /\bcult (film|classic|movie)\b/],
  ['experimental', /\b(experimental|avant[- ]garde|surreal|art film)\b/],
  ['noir', /\bfilm noir\b/],
  ['neo-noir', /\bneo[- ]noir\b/],
  ['french-new-wave', /\bfrench new wave|nouvelle vague\b/],
  ['neorealism', /\bneorealis/],
  ['german-expressionism', /\bgerman expressionism|expressionism\b/],
  ['new-hollywood', /\bnew hollywood\b/],
  ['dogme-95', /\bdogme\b/],
  ['slow-cinema', /\bslow cinema\b/],
]

export async function fetchFilmTags(db, env, film) {
  const key = `tags:${film.id}`
  const cached = await db.prepare('SELECT data FROM cinema_news_cache WHERE key = ?').bind(key).first()
  if (cached) {
    try { return JSON.parse(cached.data) } catch { return [] }
  }
  if (!env.TMDB_API_KEY) return []
  const isTv = film.itemType === 'series'
  const kind = isTv ? 'tv' : 'movie'
  const apiKey = env.TMDB_API_KEY
  let tmdbId = null
  if (film.imdbId) {
    const r = await tmdbFetch(`https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${apiKey}&external_source=imdb_id`, env)
    if (!r.ok) return []
    tmdbId = (await r.json())?.[`${kind}_results`]?.[0]?.id || null
  }
  if (!tmdbId && film.title) {
    const yearKey = isTv ? 'first_air_date_year' : 'year'
    const yearParam = film.year ? `&${yearKey}=${film.year}` : ''
    const r = await tmdbFetch(
      `https://api.themoviedb.org/3/search/${kind}?api_key=${apiKey}&query=${encodeURIComponent(film.title.replace(/\s*\([^)]*\)\s*$/, ''))}${yearParam}`,
      env
    )
    if (!r.ok) return []
    tmdbId = (await r.json())?.results?.[0]?.id || null
  }
  let tags = []
  if (tmdbId) {
    const r = await tmdbFetch(`https://api.themoviedb.org/3/${kind}/${tmdbId}/keywords?api_key=${apiKey}`, env)
    if (!r.ok) return [] // خطای موقت؛ کش نکن
    const d = await r.json()
    const names = (d.keywords || d.results || []).map((k) => (k.name || '').toLowerCase())
    tags = TAG_RULES.filter(([, re]) => names.some((n) => re.test(n))).map(([t]) => t)
  }
  await db
    .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
    .bind(key, JSON.stringify(tags))
    .run()
  return tags
}

export async function backfillFilmTags(db, env, limit = 20) {
  if (!env.TMDB_API_KEY) return { skipped: 'no key' }
  const { results } = await db
    .prepare(
      `SELECT id, title, year, imdbId, itemType FROM films
       WHERE NOT EXISTS (SELECT 1 FROM cinema_news_cache c WHERE c.key = 'tags:' || films.id)
       LIMIT ?`
    )
    .bind(limit)
    .all()
  let tagged = 0
  for (const row of results) {
    const t = await fetchFilmTags(db, env, row).catch(() => [])
    if (t.length) tagged++
  }
  return { tried: results.length, tagged }
}
