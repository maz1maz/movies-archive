import { normalizeTitle } from '../helpers.js'
import { resolveWikidataLabels, languageCodeToName } from './wikidata.js'
import { fetchLetterboxdRating } from './letterboxd.js'


// دقیقاً همون کاری که کاربر دستی انجام می‌ده: با عنوان (و سال) جستجو می‌کنه،
// بعد بین چند نتیجه‌ی بالای TMDB، اونی که کارگردانش با کارگردان شناخته‌شده‌ی
// فیلم (تو دیتابیس) یکی هست رو به‌عنوان تطبیق تأییدشده انتخاب می‌کنه — نه صرفاً
// اولین نتیجه‌ی جستجو (که باعث قاطی‌شدن فیلم‌های هم‌اسم می‌شه، مثل Deep Water).
// در آخر imdbId فیلم تأییدشده رو برمی‌گردونه تا enrichFilm/fetchTmdbExtras با
// همون آیدی دقیق (نه جستجوی مبهم عنوان) کار کنن.
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // حذف اکسان‌ها
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

export function directorNamesOverlap(knownDirector, candidateDirectorNames) {
  if (!knownDirector || !candidateDirectorNames?.length) return false
  const knownParts = String(knownDirector).split(/[,&]/).map(normalizeName).filter(Boolean)
  const candParts = candidateDirectorNames.map(normalizeName).filter(Boolean)
  return knownParts.some((k) => candParts.some((c) => c === k || c.includes(k) || k.includes(c)))
}


export async function findVerifiedImdbId(title, year, knownDirector, itemType, env) {
  const tmdbKey = env.TMDB_API_KEY
  if (!title || !tmdbKey) return null
  async function tmdbGet(path, params) {
    const qs = new URLSearchParams({ api_key: tmdbKey, ...params }).toString()
    try {
      const res = await fetch(`https://api.themoviedb.org/3${path}?${qs}`, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }
  const kind = itemType === 'series' ? 'tv' : 'movie'
  const searchParams = { query: title }
  if (year) searchParams[kind === 'tv' ? 'first_air_date_year' : 'year'] = String(year)
  const searchData = await tmdbGet(`/search/${kind}`, searchParams)
  const candidates = (searchData?.results || []).slice(0, 5)
  if (!candidates.length) return null

  // اگه کارگردان شناخته‌شده‌ست، بین کاندیدها دنبال تطبیق کارگردان می‌گردیم —
  // این همون گام تأییدیه‌ای که کاربر دستی انجام می‌ده.
  if (knownDirector) {
    for (const cand of candidates) {
      const credits = await tmdbGet(`/${kind}/${cand.id}/credits`, {})
      const directorNames = kind === 'tv'
        ? (credits?.crew || []).filter((c) => c.job === 'Director' || c.department === 'Directing').map((c) => c.name)
        : (credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name)
      if (directorNamesOverlap(knownDirector, directorNames)) {
        const ext = await tmdbGet(`/${kind}/${cand.id}/external_ids`, {})
        if (ext?.imdb_id) return ext.imdb_id
      }
    }
    // هیچ کاندیدی کارگردانش تأیید نشد — به‌جای انتخاب اشتباه، چیزی برنمی‌گردونیم
    return null
  }

  // کارگردان شناخته‌شده نیست (خودش هم خالیه) — همون بهترین نتیجه رو با احتیاط برمی‌گردونیم
  const top = candidates[0]
  const ext = await tmdbGet(`/${kind}/${top.id}/external_ids`, {})
  return ext?.imdb_id || null
}


// خروجی fetchTmdbExtras رو روی فیلم اعمال می‌کنه — فقط فیلدهای خالی رو پر می‌کنه،
// هیچ‌وقت چیزی که خود کاربر/OMDb از قبل پر کرده رو رونویسی نمی‌کنه.
export function isEmptyArrayField(v) {
  if (Array.isArray(v)) return v.length === 0
  return !v || v === '[]'
}

export function applyTmdbExtras(film, extras) {
  if (!extras) return
  if (!film.tagline && extras.tagline) film.tagline = extras.tagline
  if (!film.budget && extras.budget) film.budget = extras.budget
  if (!film.revenue && extras.revenue) film.revenue = extras.revenue
  if (!film.originalLanguage && extras.originalLanguage) film.originalLanguage = languageCodeToName(extras.originalLanguage)
  if (isEmptyArrayField(film.productionCompanies) && extras.productionCompanies) {
    film.productionCompanies = JSON.stringify(extras.productionCompanies)
  }
  if (isEmptyArrayField(film.productionCountries) && extras.productionCountries) {
    film.productionCountries = JSON.stringify(extras.productionCountries)
  }
  if (!film.homepage && extras.homepage) film.homepage = extras.homepage
  if (isEmptyArrayField(film.spokenLanguages) && extras.spokenLanguages) {
    film.spokenLanguages = JSON.stringify(extras.spokenLanguages)
  }
  if (!film.status && extras.status) film.status = extras.status
  if (film.popularity == null && extras.popularity != null) film.popularity = extras.popularity
}


// تگ‌لاین/بودجه/فروش/زبان اصلی رو از TMDB می‌گیره — این‌ها توی OMDb نیستن. اول با imdbId، فیلم/سریال رو روی TMDB پیدا می‌کنیم (endpoint find)،
// بعد جزئیات کامل (endpoint movie/tv) رو می‌گیریم چون budget/revenue/tagline
// فقط توی جزئیات کامل‌ان، نه توی نتیجه‌ی find.
export async function fetchTmdbExtras(imdbId, itemType, env) {
  const tmdbKey = env.TMDB_API_KEY
  if (!imdbId) return { extras: null, debug: 'no imdbId' }
  if (!tmdbKey) return { extras: null, debug: 'TMDB_API_KEY not set' }
  async function tmdbGet(url, useBearer) {
    const headers = useBearer
      ? { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' }
      : { accept: 'application/json' }
    const finalUrl = useBearer ? url : `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(tmdbKey)}`
    try {
      const res = await fetch(finalUrl, { headers })
      if (!res.ok) return { data: null, status: res.status }
      return { data: await res.json(), status: res.status }
    } catch (e) {
      return { data: null, status: 'fetch-error: ' + String(e) }
    }
  }
  let r1 = await tmdbGet(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`, false)
  if (!r1.data) r1 = await tmdbGet(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`, true)
  if (!r1.data) return { extras: null, debug: `find failed, status=${r1.status}` }
  const findData = r1.data
  const movieHit = (findData.movie_results || [])[0]
  const tvHit = (findData.tv_results || [])[0]
  const hit = itemType === 'series' ? (tvHit || movieHit) : (movieHit || tvHit)
  if (!hit) return { extras: null, debug: `find succeeded but no movie/tv match for ${imdbId}` }
  const kind = tvHit && !movieHit ? 'tv' : 'movie'
  let r2 = await tmdbGet(`https://api.themoviedb.org/3/${kind}/${hit.id}`, false)
  if (!r2.data) r2 = await tmdbGet(`https://api.themoviedb.org/3/${kind}/${hit.id}`, true)
  if (!r2.data) return { extras: null, debug: `details failed, status=${r2.status}` }
  const details = r2.data
  const extras = {
    tagline: details.tagline || undefined,
    budget: kind === 'movie' && details.budget ? details.budget : undefined,
    revenue: kind === 'movie' && details.revenue ? details.revenue : undefined,
    originalLanguage: details.original_language || undefined,
    productionCompanies: Array.isArray(details.production_companies) && details.production_companies.length
      ? details.production_companies.map((c) => c.name).filter(Boolean)
      : undefined,
    productionCountries: Array.isArray(details.production_countries) && details.production_countries.length
      ? details.production_countries.map((c) => c.name).filter(Boolean)
      : undefined,
    homepage: details.homepage || undefined,
    spokenLanguages: Array.isArray(details.spoken_languages) && details.spoken_languages.length
      ? details.spoken_languages.map((l) => l.english_name || l.name).filter(Boolean)
      : undefined,
    status: details.status || undefined,
    popularity: typeof details.popularity === 'number' ? details.popularity : undefined,
  }
  return { extras, debug: `ok, tmdbId=${hit.id}, kind=${kind}` }
}


// جوایز یه شخص (P166 «award received» روی Wikidata)، گروه‌بندی‌شده بر اساس
// اسم جایزه با تعداد تکرار — مثلاً «Academy Award for Best Director ×2».
export async function fetchDirectorAwards(name) {
  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&titles=${encodeURIComponent(name)}`,
      { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
    )
    if (!wikiRes.ok) return []
    const wikiData = await wikiRes.json()
    const page = Object.values(wikiData?.query?.pages || {})[0]
    const qid = page?.pageprops?.wikibase_item
    if (!qid) return []

    const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`, {
      headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const claims = data?.entities?.[qid]?.claims || {}
    const awardClaims = claims.P166 || []
    if (!awardClaims.length) return []

    const awardIds = awardClaims.map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean)
    const labels = await resolveWikidataLabels(awardIds)

    // هر جایزه با سالش جدا نگه داشته می‌شه (نه فقط شمارش) — اگه شخص یه جایزه
    // رو چند سال برده باشه، هر سالش جدا لیست می‌شه. P585 = «point in time».
    const results = []
    for (const c of awardClaims) {
      const id = c.mainsnak?.datavalue?.value?.id
      const label = id && labels[id]
      if (!label) continue
      const timeVal = c.qualifiers?.P585?.[0]?.datavalue?.value?.time
      let year = null
      if (timeVal) {
        const m = timeVal.match(/^\+?(-?\d{1,4})-/)
        if (m) year = parseInt(m[1], 10)
      }
      // اگه برای یه فیلم/کار خاص بوده (P1686 «for work»)، اسمش رو هم می‌گیریم.
      const workId = c.qualifiers?.P1686?.[0]?.datavalue?.value?.id
      results.push({ label, year, workId })
    }

    // اسم فیلم‌هایی که جایزه بابتشون بوده رو resolve می‌کنیم.
    const workIds = [...new Set(results.map((r) => r.workId).filter(Boolean))]
    const workLabels = workIds.length ? await resolveWikidataLabels(workIds) : {}
    for (const r of results) {
      r.forWork = r.workId ? workLabels[r.workId] || null : null
      delete r.workId
    }

    // یکتاسازی (همون جایزه/سال/کار ممکنه از چند claim تکراری بیاد)
    const seen = new Set()
    const deduped = results.filter((r) => {
      const key = `${r.label}|${r.year}|${r.forWork}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    deduped.sort((a, b) => (b.year || 0) - (a.year || 0))
    return deduped.slice(0, 40)
  } catch {
    return []
  }
}


// فیلم‌هایی که این کارگردان ساخته ولی توی آرشیو نیستن، فیلترشده به اونایی که
// امتیازشون واقعاً بالاست. فیلتر اصلی رو رو امتیاز خودِ TMDB (vote_average،
// که رایگان و بدون درخواست اضافه از قبل داریمش) انجام می‌دیم، نه OMDb — چون
// کوتای رایگان OMDb (۱۰۰۰ درخواست/روز) خیلی زود با همین یه فیچر تموم می‌شه.
// OMDb/Letterboxd فقط برای غنی‌سازی (امتیاز رسمی IMDb، پوستر بهتر) best-effort
// امتحان می‌شن؛ اگه جواب ندادن، نتیجه رو حذف نمی‌کنیم.
export async function fetchDirectorRecommendations(db, name, env) {
  if (!env.TMDB_API_KEY) return []
  const tmdbKey = env.TMDB_API_KEY

  async function tmdbGet(path, params) {
    const qs = new URLSearchParams(params).toString()
    const attempts = [
      { url: `https://api.themoviedb.org/3${path}?${qs}&api_key=${encodeURIComponent(tmdbKey)}`, headers: { accept: 'application/json' } },
      { url: `https://api.themoviedb.org/3${path}?${qs}`, headers: { Authorization: `Bearer ${tmdbKey}`, accept: 'application/json' } },
    ]
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, { headers: a.headers })
        if (res.ok) return await res.json()
      } catch {}
    }
    return null
  }

  try {
    const search = await tmdbGet('/search/person', { query: name })
    const person = (search?.results || [])[0]
    if (!person) return []

    const credits = await tmdbGet(`/person/${person.id}/movie_credits`, {})
    const directed = (credits?.crew || []).filter((c) => c.job === 'Director')
    const seen = new Set()
    const candidates = []
    for (const c of directed) {
      if (!c.title || !c.release_date) continue
      const key = `${c.id}`
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push({
        tmdbId: c.id,
        title: c.title,
        year: parseInt(c.release_date.slice(0, 4), 10),
        popularity: c.popularity || 0,
        tmdbRating: typeof c.vote_average === 'number' ? c.vote_average : null,
        posterPath: c.poster_path || null,
      })
    }
    if (!candidates.length) return []

    // فیلم‌هایی که از قبل تو آرشیون رو حذف کن (تطبیق با عنوان+سال، نادیده
    // گرفتن حروف بزرگ/کوچیک — همون منطق دوپلیکیت‌یاب).
    const existingRes = await db.prepare('SELECT title, year FROM films').all()
    const existingKeys = new Set(
      (existingRes.results || []).map((f) => `${normalizeTitle(f.title)}|${f.year || ''}`)
    )
    const missing = candidates.filter((c) => !existingKeys.has(`${normalizeTitle(c.title)}|${c.year || ''}`))

    // فیلتر اصلیِ کیفیت: امتیاز خودِ TMDB بالای ۷ (همون مقیاس IMDb، رایگان،
    // از قبل داریمش). فقط پرمحبوب‌ترین ۲۰ تا از این‌ها رو برای غنی‌سازی چک می‌کنیم.
    const toCheck = missing
      .filter((c) => c.tmdbRating != null && c.tmdbRating > 7)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 20)

    const results = []
    for (const c of toCheck) {
      let imdbRating = null
      let runtimeMins = null
      // پوستر رو اول از TMDB می‌گیریم (image.tmdb.org، همیشه از مرورگر لود
      // می‌شه)، نه از OMDb (که پوسترش رو media-amazon.com می‌ده و اون سایت
      // خیلی وقتا hotlinking از دامنه‌های دیگه رو بلاک می‌کنه و تصویر شکسته میاد).
      let poster = c.posterPath ? `https://image.tmdb.org/t/p/w300${c.posterPath}` : null

      // مدت‌زمان رو مستقیم از خود TMDB می‌گیریم (منبع اصلی و مطمئن‌تر از
      // OMDb برای این مورد) تا مطمئن بشیم فیلم کوتاه نیست.
      try {
        const details = await tmdbGet(`/movie/${c.tmdbId}`, {})
        if (typeof details?.runtime === 'number' && details.runtime > 0) {
          runtimeMins = details.runtime
        }
      } catch {}

      // OMDb فقط best-effort: اگه کوتاش تموم شده باشه یا جواب نده، مشکلی
      // نیست — امتیاز TMDB رو به‌جاش نگه می‌داریم، نه این‌که کل پیشنهاد رو حذف کنیم.
      try {
        const omdbRes = await fetch(
          `https://www.omdbapi.com/?apikey=${env.OMDB_API_KEY}&t=${encodeURIComponent(c.title)}&y=${c.year}&type=movie`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (omdbRes.ok) {
          const omdbData = await omdbRes.json()
          if (omdbData.Response === 'True' && omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
            const parsed = parseFloat(omdbData.imdbRating)
            if (!isNaN(parsed)) imdbRating = parsed
            if (!poster && omdbData.Poster && omdbData.Poster !== 'N/A') poster = omdbData.Poster
          }
          if (runtimeMins == null) {
            const runtimeMatch = (omdbData.Runtime || '').match(/(\d+)/)
            if (runtimeMatch) runtimeMins = parseInt(runtimeMatch[1], 10)
          }
        }
      } catch {}

      // فقط فیلم بلند (۴۰ دقیقه به بالا) — اگه مدت‌زمانش از هیچ منبعی معلوم
      // نشد (نه TMDB نه OMDb)، به‌جای اینکه با شک نشونش بدیم، حذفش می‌کنیم.
      if (runtimeMins == null || runtimeMins < 40) continue

      // برچسب UI می‌گه «IMDb»، پس باید واقعاً IMDb باشه — نه امتیاز TMDB که
      // جای خالیش رو پر کنه. اگه OMDb واقعی جواب نداد، این پیشنهاد رو حذف
      // می‌کنیم به‌جای اینکه یه عدد از منبع دیگه رو با برچسب اشتباه نشون بدیم.
      if (imdbRating == null || imdbRating <= 7) continue

      // لترباکس هم best-effort — اگه واقعاً امتیازش پایینه (زیر ۳.۵) حذفش
      // می‌کنیم، ولی اگه فقط جواب نداد (بلاک/تغییر مارک‌آپ) نادیده می‌گیریم.
      const lb = await fetchLetterboxdRating(c.title, c.year)
      if (lb && lb.rating <= 3.5) continue

      results.push({
        title: c.title,
        year: c.year,
        imdbRating,
        letterboxdRating: lb ? lb.rating : null,
        poster,
      })
    }

    return results.sort((a, b) => b.imdbRating - a.imdbRating)
  } catch {
    return []
  }
}
