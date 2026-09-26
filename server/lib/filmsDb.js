import { ENRICHABLE_FIELDS, isEmptyMetadata } from '../helpers.js'
import { enrichFilm } from '../omdb.js'
import { isCacheFresh } from './cache.js'
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
    const res = await fetch(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${env.TMDB_API_KEY}`)
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
export async function resolveFilmCollection(db, env, film) {
  if (film.collectionId != null) {
    // قبلاً چک شده — یا عضو یه مجموعه‌ست، یا مطمئنیم که نیست
    if (!film.collectionId) return null
    return { collectionId: film.collectionId, collectionName: film.collectionName, collectionPoster: film.collectionPoster }
  }
  if (!env.TMDB_API_KEY || film.itemType === 'series') {
    return null // TMDB collections فقط برای فیلمن، نه سریال
  }

  let tmdbMovieId = null
  try {
    if (film.imdbId) {
      const findRes = await fetch(
        `https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${env.TMDB_API_KEY}&external_source=imdb_id`
      )
      if (findRes.ok) {
        const findData = await findRes.json()
        tmdbMovieId = findData?.movie_results?.[0]?.id || null
      }
    }
    if (!tmdbMovieId && film.title) {
      const q = encodeURIComponent(film.title)
      const yearParam = film.year ? `&year=${film.year}` : ''
      const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${env.TMDB_API_KEY}&query=${q}${yearParam}`)
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        tmdbMovieId = searchData?.results?.[0]?.id || null
      }
    }
    if (!tmdbMovieId) {
      await db.prepare("UPDATE films SET collectionId = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    const movieRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbMovieId}?api_key=${env.TMDB_API_KEY}`)
    if (!movieRes.ok) return null
    const movieData = await movieRes.json()
    const collection = movieData.belongs_to_collection

    if (!collection) {
      await db.prepare("UPDATE films SET collectionId = '' WHERE id = ?").bind(film.id).run()
      return null
    }

    const collectionPoster = collection.poster_path ? `https://image.tmdb.org/t/p/w342${collection.poster_path}` : null
    await db
      .prepare('UPDATE films SET collectionId = ?, collectionName = ?, collectionPoster = ? WHERE id = ?')
      .bind(String(collection.id), collection.name, collectionPoster, film.id)
      .run()
    return { collectionId: String(collection.id), collectionName: collection.name, collectionPoster }
  } catch {
    return null
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

  if (!env.TMDB_API_KEY || !film.imdbId) return []
  try {
    const mediaType = film.itemType === 'series' ? 'tv' : 'movie'
    const findRes = await fetch(
      `https://api.themoviedb.org/3/find/${film.imdbId}?api_key=${env.TMDB_API_KEY}&external_source=imdb_id`
    )
    if (!findRes.ok) return []
    const findData = await findRes.json()
    const tmdbId = findData?.[`${mediaType}_results`]?.[0]?.id
    if (!tmdbId) return []

    const imgRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images?api_key=${env.TMDB_API_KEY}`)
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
// باگ قبلی: بدون ORDER BY، هر بار همون چند فیلم اولِ بی‌پوستر (که OMDb اصلاً
// پوستری براشون نداره یا اسمشون قابل‌تشخیص نیست) انتخاب می‌شدن؛ دکمه هیچ‌وقت
// به فیلم‌های واقعاً بررسی‌نشده نمی‌رسید. الان اول فیلم‌های بررسی‌نشده رو
// تموم می‌کنه، بعد بی‌پوسترها رو به ترتیب قدیمی‌ترین تلاش می‌ره سراغشون.
// scopeClause (اختیاری): خروجیِ enrichScopeClause، برای محدود کردن به یه بخش خاص.
export async function enrichBatch(db, env, limit, scopeClause = '') {
  const all = await db
    .prepare(
      `SELECT * FROM films
       WHERE (metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = '')${scopeClause}
       ORDER BY (metadataEnrichmentAttemptedAt IS NULL) DESC, metadataEnrichmentAttemptedAt ASC
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
      `SELECT COUNT(*) as count FROM films WHERE (metadataEnrichmentAttemptedAt IS NULL OR poster IS NULL OR poster = '')${scopeClause}`
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
