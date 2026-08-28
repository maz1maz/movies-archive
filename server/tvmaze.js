// غنی‌سازی سریال‌ها از TVMaze — یه API رایگان و بدون کلید، مخصوص سریال‌ها.
// این نسخه از روی اسکریپت پایتونی که واقعاً برای پر کردن ۱۱۳ تا سریال جواب
// داد پورت شده (series-enricher-complete.py) — نسخه‌ی قبلی این فایل فقط
// singlesearch + cast می‌زد و هیچ‌وقت crew (تهیه‌کننده/کارگردان/سازنده) رو
// نمی‌گرفت، برای همین Producer/Director سریال‌ها همیشه خالی می‌موند.
// داده‌ی موجود توسط کاربر رو هیچ‌وقت رونویسی نمی‌کنه — فقط فیلدهای خالی رو پر می‌کنه.
const BASE = 'https://api.tvmaze.com'
const FETCH_HEADERS = { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' }
const FETCH_TIMEOUT = 8000

// چند تا عنوان که TVMaze سرچ ساده براشون جواب اشتباه/بی‌ربط می‌ده — شناسه‌ی
// دقیق TVMaze رو مستقیم می‌ذاریم که دیگه به حدس سرچ نیاز نباشه.
const CORRECTIONS = {
  'money heist': 27436, // La Casa de Papel (2017) — نه نسخه‌ی کره‌ای ۲۰۲۲
  protector: 36807, // Hakan: Muhafız — سریال ترکی ۲۰۱۸
  'the protector': 36807,
  'the bridge (bron-breon)': 1910, // Bron / Broen 2011
  anne: 12989, // Anne with an E
}

// عنوان‌هایی که یه سری کاندید سرچ خاص لازم دارن (چون اسمشون تو آرشیو خودمون
// با اسم رسمی TVMaze فرق داره یا خیلی کلی/مبهمه)
function specialCandidates(title) {
  const t = title.toLowerCase()
  if (t === 'anne') return ['Anne with an E', 'Anne']
  if (t === '24') return ['24']
  if (t === 'kingdom') return ['Kingdom Korean', 'Kingdom']
  if (t === 'money heist') return ['La Casa de Papel', 'Money Heist']
  if (t === 'protector') return ['Hakan Muhafiz', 'The Protector 2018']
  if (t.includes('bridge')) return ['Bron Broen', 'The Bridge', title]
  return null
}

// "Stranger Things S 03" یا "... Season 3" -> "Stranger Things" برای سرچ بهتر
function cleanSearchTitle(rawTitle) {
  let t = rawTitle.trim()
  t = t.replace(/\s+S\s*\d+.*$/i, '')
  t = t.replace(/\s+Season\s*\d+.*$/i, '')
  return t.replace(/\s+/g, ' ').trim()
}

function stripParenthesis(title) {
  return title.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
}

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0
  return value == null || String(value).trim() === ''
}

function fillMissing(film, field, value) {
  if (!isEmpty(film[field]) || value == null || value === '') return
  film[field] = value
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function buildCandidates(title) {
  const special = specialCandidates(title)
  if (special) return special

  const candidates = [title]
  const cleaned = cleanSearchTitle(title)
  if (cleaned !== title) candidates.push(cleaned)
  const stripped = stripParenthesis(cleaned)
  if (stripped !== cleaned && stripped !== title) candidates.push(stripped)
  return [...new Set(candidates)]
}

async function findShow(title) {
  const key = title.toLowerCase()
  if (CORRECTIONS[key] != null) {
    const show = await fetchJson(`${BASE}/shows/${CORRECTIONS[key]}`)
    if (show) return show
  }

  for (const candidate of buildCandidates(title)) {
    const results = await fetchJson(`${BASE}/search/shows?q=${encodeURIComponent(candidate)}`)
    if (Array.isArray(results) && results.length) {
      const correctionId = CORRECTIONS[key]
      if (correctionId != null) {
        const match = results.find((r) => r.show?.id === correctionId)
        if (match) return match.show
      }
      return results[0].show
    }
  }
  return null
}

// کشورهای متداول بر اساس زبان، برای وقتی که TVMaze کشور شبکه رو نداره
const LANGUAGE_COUNTRY = {
  English: 'United States',
  Korean: 'South Korea',
  Spanish: 'Spain',
  Turkish: 'Turkey',
  Swedish: 'Sweden',
  Japanese: 'Japan',
  French: 'France',
  German: 'Germany',
}
const STREAMING_SERVICES_US = new Set(['Netflix', 'Hulu', 'Amazon Prime Video', 'Apple TV+', 'Disney+'])

function extractShowFields(show) {
  const fields = {}

  if (show.premiered) {
    const m = String(show.premiered).match(/^(19\d{2}|20\d{2})/)
    if (m) fields.year = parseInt(m[1], 10)
  }
  if (Array.isArray(show.genres) && show.genres.length) fields.genre = show.genres
  if (show.rating?.average != null) fields.rating = show.rating.average
  fields.runtime = show.runtime || show.averageRuntime || undefined

  let country = ''
  let studio = ''
  if (show.network) {
    country = show.network.country?.name || ''
    studio = show.network.name || ''
  }
  if (show.webChannel) {
    if (!country) country = show.webChannel.country?.name || ''
    if (!studio) studio = show.webChannel.name || ''
    if (!country && STREAMING_SERVICES_US.has(show.webChannel.name)) country = 'United States'
  }
  if (!country) country = LANGUAGE_COUNTRY[show.language] || show.language || ''
  if (country) fields.country = country
  if (studio) fields.studio = studio

  if (show.summary) fields.synopsis = stripHtml(show.summary)
  const poster = show.image?.original || show.image?.medium
  if (poster) fields.poster = poster
  if (show.externals?.imdb) fields.imdbId = show.externals.imdb
  if (show.name) fields.originalTitle = show.name
  if (studio) fields.network = studio
  if (show.status) fields.seriesStatus = show.status
  if (Array.isArray(show.schedule?.days) && show.schedule.days.length) {
    const time = show.schedule.time ? ` ${show.schedule.time}` : ''
    fields.schedule = `${show.schedule.days.join(', ')}${time}`
  }

  return fields
}

function extractCrewFields(crew, cast) {
  const producers = []
  const directors = []
  const creators = []
  for (const member of crew || []) {
    const type = member.type || ''
    const name = member.person?.name
    if (!name) continue
    if (type.includes('Producer')) producers.push(name)
    if (type.includes('Director')) directors.push(name)
    if (type.includes('Creator')) creators.push(name)
  }
  const uniq = (arr) => [...new Set(arr)]
  let producerStr = uniq(producers).slice(0, 5).join(', ')
  let directorStr = uniq(directors).slice(0, 3).join(', ')
  if (!directorStr && creators.length) directorStr = uniq(creators).slice(0, 3).join(', ')
  if (!producerStr && creators.length) producerStr = uniq(creators).slice(0, 3).join(', ')

  const castNames = (cast || [])
    .slice(0, 8)
    .map((c) => c.person?.name)
    .filter(Boolean)

  return { producer: producerStr, director: directorStr, cast: castNames }
}

export async function enrichSeriesFromTVMaze(film) {
  const title = (film.title || '').trim()
  if (!title) return film

  const show = await findShow(title)
  if (!show || !show.id) return film

  return applyShowData(film, show)
}

// وقتی مستقیم لینک TVMaze داریم (tvmaze.com/shows/{id}/...)، به‌جای سرچ روی
// عنوان، مستقیم با شناسه‌ی TVMaze می‌گیریمش — دقیق‌تر و بدون ابهام.
export async function enrichSeriesFromTVMazeById(showId, film) {
  const show = await fetchJson(`${BASE}/shows/${showId}`)
  if (!show || !show.id) return null
  return applyShowData(film || {}, show)
}

async function applyShowData(film, show) {
  const [crew, cast] = await Promise.all([
    fetchJson(`${BASE}/shows/${show.id}/crew`),
    fetchJson(`${BASE}/shows/${show.id}/cast`),
  ])

  const out = { ...film }
  if (!out.title) out.title = show.name
  const showFields = extractShowFields(show)
  for (const [field, value] of Object.entries(showFields)) {
    fillMissing(out, field, value)
  }

  const { producer, director, cast: castNames } = extractCrewFields(crew || [], cast || [])
  if (producer) fillMissing(out, 'producer', producer)
  if (director) fillMissing(out, 'director', director)
  if (castNames.length) fillMissing(out, 'cast', castNames)

  return out
}

// چند تا سریال که TVMaze شماره‌ی فصل نامرتب/تکراری برمی‌گردونه (مثلاً یه
// «Special»های اضافی که فصل شمارش عادی رو به‌هم می‌زنه) اینجا دستی تصحیح
// می‌شه؛ در غیر این صورت از بیشترین شماره‌ی فصل واقعی (غیر ویژه) استفاده می‌کنیم.
export async function fetchTotalSeasons(title) {
  const show = await findShow((title || '').trim())
  if (!show || !show.id) return null
  const seasons = await fetchJson(`${BASE}/shows/${show.id}/seasons`)
  if (!Array.isArray(seasons) || !seasons.length) return null
  const numbers = seasons.map((s) => s.number).filter((n) => typeof n === 'number' && n > 0)
  if (!numbers.length) return null
  return Math.max(...numbers)
}

// سریال‌های در حال پخش (یا هنوز تعیین‌نشده) یه بازیگر/عوامل — برای بخش
// «اخبار سینما»، چون TMDB برای خیلی از سریال‌ها تاریخ اپیزود بعدی نداره ولی
// TVMaze داره. اسم رو به شخص TVMaze تبدیل می‌کنیم، credits سریالیش رو
// می‌گیریم، و برای هرکدوم که Running/To Be Determined هست تاریخ اپیزود
// بعدی (اگه موجود باشه) رو هم اضافه می‌کنیم.
export async function fetchTvMazePersonUpcoming(name) {
  try {
    const people = await fetchJson(`${BASE}/search/people?q=${encodeURIComponent(name)}`)
    const person = Array.isArray(people) && people.length ? people[0].person : null
    if (!person || !person.id) return []

    const credits = await fetchJson(`${BASE}/people/${person.id}/castcredits?embed=show`)
    if (!Array.isArray(credits)) return []

    const shows = credits
      .map((c) => c._embedded?.show)
      .filter((s) => s && (s.status === 'Running' || s.status === 'To Be Determined'))

    const seen = new Set()
    const out = []
    for (const show of shows) {
      if (seen.has(show.id)) continue
      seen.add(show.id)
      let releaseDate = show.premiered || null
      const nextEpUrl = show._links?.nextepisode?.href
      if (nextEpUrl) {
        const ep = await fetchJson(nextEpUrl)
        if (ep?.airdate) releaseDate = ep.airdate
      }
      if (!releaseDate) continue
      out.push({
        title: show.name,
        releaseDate,
        poster: show.image?.medium || show.image?.original || null,
        mediaType: 'series',
        role: 'Actor',
        infoUrl: show.url,
        source: 'tvmaze',
      })
    }
    return out.slice(0, 5)
  } catch {
    return []
  }
}

