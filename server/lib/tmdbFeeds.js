import { fetchTvMazePersonUpcoming } from '../tvmaze.js'
import { isCacheFresh } from './cache.js'


// افرادی از people_photos (کش تولد/عکس که PersonModal پرش می‌کنه) که تولدشون
// امروزه، فیلتر شده به اونایی که واقعاً توی آرشیو (کارگردان یا بازیگر) نقشی
// دارن. چون people_photos فقط با باز کردن PersonModal پر می‌شه، این لیست
// به‌مرور کامل‌تر می‌شه، نه از روز اول.
export async function fetchTodaysBirthdays(db) {
  try {
    const peopleRes = await db
      .prepare(
        `SELECT name, photo, birthDate FROM people_photos
         WHERE birthDate IS NOT NULL AND deathDate IS NULL
         AND strftime('%m-%d', birthDate) = strftime('%m-%d', 'now')`
      )
      .all()
    const people = peopleRes.results || []
    if (!people.length) return []

    const out = []
    for (const p of people) {
      const nameLower = p.name.toLowerCase()
      const like = `%${nameLower}%`
      const filmsRes = await db
        .prepare('SELECT title, director, "cast" FROM films WHERE LOWER(director) LIKE ? OR LOWER("cast") LIKE ? LIMIT 6')
        .bind(like, like)
        .all()
      const rows = filmsRes.results || []
      if (!rows.length) continue // فقط اهالی خودِ کالکشن، نه هر کسی که تصادفاً کش شده

      // اسم با حروف درست (people_photos.name همیشه lowercase ذخیره می‌شه)
      let displayName = p.name
      for (const f of rows) {
        if (f.director && f.director.toLowerCase().includes(nameLower)) {
          const match = f.director.split(',').map((s) => s.trim()).find((s) => s.toLowerCase() === nameLower)
          displayName = match || f.director
          break
        }
        try {
          const cast = JSON.parse(f.cast || '[]')
          const match = Array.isArray(cast)
            ? cast.find((c) => ((typeof c === 'object' ? c.name : c) || '').toLowerCase() === nameLower)
            : null
          if (match) {
            displayName = typeof match === 'object' ? match.name : match
            break
          }
        } catch {}
      }

      out.push({
        name: displayName,
        photo: p.photo,
        age: ageFromBirthDate(p.birthDate),
        films: rows.map((f) => f.title).slice(0, 3),
      })
    }
    return out
  } catch {
    return []
  }
}


// فیلم/سریال‌های در راهِ پرتکرارترین کارگردان‌ها و بازیگرهای کالکشن (از
// روی تعداد عناوینی که ازشون تو آرشیو هست). هر فرد جدا توی cinema_news_cache
// کش می‌شه (۳ روزه) تا هر بار مودال باز می‌شه TMDB دوباره چک نشه.
export async function fetchUpcomingFromCollection(db, env) {
  if (!env.TMDB_API_KEY) return []
  try {
    const filmsRes = await db.prepare('SELECT director, "cast" FROM films').all()
    const films = filmsRes.results || []
    const counts = new Map()
    for (const f of films) {
      if (f.director) {
        for (const d of f.director.split(',').map((s) => s.trim()).filter(Boolean)) {
          counts.set(d, (counts.get(d) || 0) + 1)
        }
      }
      try {
        const cast = JSON.parse(f.cast || '[]')
        if (Array.isArray(cast)) {
          for (const c of cast) {
            const name = typeof c === 'object' ? c.name : c
            if (name) counts.set(name, (counts.get(name) || 0) + 1)
          }
        }
      } catch {}
    }
    const topPeople = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name)

    const results = []
    for (const name of topPeople) {
      const cacheKey = `upcoming:${name.toLowerCase()}`
      const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind(cacheKey).first()
      const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 3 * 24 * 60 * 60 * 1000)
      let items
      if (fresh) {
        try {
          items = JSON.parse(cached.data || '[]')
        } catch {
          items = []
        }
      } else {
        items = await fetchPersonUpcoming(name, env)
        await db
          .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
          .bind(cacheKey, JSON.stringify(items))
          .run()
      }
      for (const it of items) results.push({ ...it, personName: name })
    }

    // یکتاسازی (ممکنه یه فیلم هم بازیگر هم کارگردانش تو کالکشن باشن) +
    // مرتب‌سازی بر اساس نزدیک‌ترین تاریخ اکران
    const seen = new Set()
    const unique = []
    for (const r of results.sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'))) {
      const key = `${r.title}|${r.releaseDate}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(r)
    }
    return unique.slice(0, 20)
  } catch {
    return []
  }
}


export async function fetchPersonUpcoming(name, env) {
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

  let upcoming = []
  try {
    const search = await tmdbGet('/search/person', { query: name })
    const person = (search?.results || [])[0]
    if (person) {
      const credits = await tmdbGet(`/person/${person.id}/combined_credits`, {})
      const today = new Date().toISOString().slice(0, 10)
      const all = [...(credits?.cast || []), ...(credits?.crew || [])]
      const seen = new Set()
      for (const c of all) {
        const releaseDate = c.release_date || c.first_air_date
        if (!releaseDate || releaseDate <= today) continue
        const title = c.title || c.name
        if (!title) continue
        const key = `${c.media_type}:${c.id}`
        if (seen.has(key)) continue
        seen.add(key)
        upcoming.push({
          title,
          releaseDate,
          poster: c.poster_path ? `https://image.tmdb.org/t/p/w300${c.poster_path}` : null,
          mediaType: c.media_type === 'tv' ? 'series' : 'movie',
          role: c.job || (c.character ? 'Actor' : null),
          infoUrl: `https://www.themoviedb.org/${c.media_type === 'tv' ? 'tv' : 'movie'}/${c.id}`,
        })
      }
    }
  } catch {}

  // TMDB اکثر وقتا برای سریال‌ها تاریخ اپیزود بعدی نداره (فقط تاریخ اولین
  // پخش رو می‌دونه)، برای همین اغلب این بخش برای بازیگرهای سریالی خالی
  // می‌مونه. TVMaze دقیقاً برای همین جاست: سریال‌های در حال پخش + تاریخ
  // اپیزود بعدی. نتایجش رو اضافه می‌کنیم (نه جایگزین)، با یکتاسازی بر اساس عنوان.
  try {
    const tvMazeItems = await fetchTvMazePersonUpcoming(name)
    const existingTitles = new Set(upcoming.map((u) => u.title.toLowerCase()))
    for (const item of tvMazeItems) {
      if (existingTitles.has(item.title.toLowerCase())) continue
      existingTitles.add(item.title.toLowerCase())
      upcoming.push(item)
    }
  } catch {}

  return upcoming.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)).slice(0, 5)
}


// تریلرهای فیلم‌های نزدیک‌به‌اکران هالیوود — عمومیه (نه شخصی‌سازی‌شده بر اساس
// کالکشن)، برای همین فقط یه بار در روز کلاً کش می‌شه، نه به‌ازای هر کاربر.
export async function fetchTrendingTrailers(db, env) {
  if (!env.TMDB_API_KEY) return []
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('trailers').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

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

    const upcomingRes = await tmdbGet('/movie/upcoming', { region: 'US', page: '1' })
    const movies = (upcomingRes?.results || []).slice(0, 5)

    const trailers = []
    for (const m of movies) {
      const videosRes = await tmdbGet(`/movie/${m.id}/videos`, {})
      const vids = videosRes?.results || []
      const trailer =
        vids.find((v) => v.type === 'Trailer' && v.site === 'YouTube' && v.official) ||
        vids.find((v) => v.type === 'Trailer' && v.site === 'YouTube')
      if (!trailer) continue
      trailers.push({
        title: m.title,
        releaseDate: m.release_date,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
        youtubeKey: trailer.key,
      })
    }

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('trailers', JSON.stringify(trailers))
      .run()

    return trailers
  } catch {
    return []
  }
}


// فیلم/سریال‌های در راه به‌طور کلی (نه فقط اهالی کالکشن) — برای کسی که فقط
// می‌خواد ببینه چه چیزی به‌زودی میاد، بدون ربط به این‌که تو آرشیوش هست یا نه.
// فیلم از TMDB /movie/upcoming، سریال از /discover/tv با first_air_date از
// امروز به بعد. یک‌روزه کش می‌شه، عمومیه.
export async function fetchGeneralUpcoming(db, env) {
  if (!env.TMDB_API_KEY) return { movies: [], series: [] }
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('general_upcoming').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '{"movies":[],"series":[]}')
      } catch {
        return { movies: [], series: [] }
      }
    }

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

    const today = new Date().toISOString().slice(0, 10)

    const moviesRes = await tmdbGet('/movie/upcoming', { region: 'US', page: '1' })
    const movies = (moviesRes?.results || [])
      .filter((m) => m.title && m.release_date)
      .slice(0, 12)
      .map((m) => ({
        title: m.title,
        releaseDate: m.release_date,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
        infoUrl: `https://www.themoviedb.org/movie/${m.id}`,
      }))

    // نکته: قبلاً اینجا /discover/tv با first_air_date.gte بود که فقط
    // سریال‌های کاملاً تازه (قسمت اولشون هنوز پخش نشده) رو می‌گرفت — یعنی
    // تقریباً همیشه خالی، چون اکثر سریال‌های محبوب همین الان در حال پخشن
    // (فصل جدید دارن، نه اولین قسمت). به‌جاش /tv/on_the_air که سریال‌های
    // با اپیزود در ۷ روز آینده رو می‌ده، خیلی بیشتر نتیجه‌ی مرتبط داره.
    const seriesRes = await tmdbGet('/tv/on_the_air', { region: 'US', page: '1' })
    const series = (seriesRes?.results || [])
      .filter((s) => s.name && s.first_air_date)
      .slice(0, 12)
      .map((s) => ({
        title: s.name,
        releaseDate: s.first_air_date,
        poster: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : null,
        infoUrl: `https://www.themoviedb.org/tv/${s.id}`,
      }))

    const data = { movies, series }
    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('general_upcoming', JSON.stringify(data))
      .run()

    return data
  } catch {
    return { movies: [], series: [] }
  }
}


// ترند هفته (فیلم+سریال)، پرطرفدارترین این ماه، و «گیشه» (چون TMDB چارت واقعی
// فروش نداره، از فیلم‌های در حال اکران، مرتب‌شده بر اساس محبوبیت، به‌عنوان
// نزدیک‌ترین جایگزین در دسترس استفاده می‌کنیم). چهار فراخوانی TMDB، یک‌روزه
// کش می‌شه، عمومیه.
export async function fetchTrendingAndBoxOffice(db, env) {
  const empty = { trendingMoviesWeek: [], trendingSeriesWeek: [], popularMonth: [], boxOffice: [] }
  if (!env.TMDB_API_KEY) return empty
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('trending_boxoffice').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || 'null') || empty
      } catch {
        return empty
      }
    }

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

    const mapMovie = (m) => ({
      title: m.title,
      releaseDate: m.release_date || null,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
      rating: typeof m.vote_average === 'number' ? Math.round(m.vote_average * 10) / 10 : null,
      infoUrl: `https://www.themoviedb.org/movie/${m.id}`,
    })
    const mapSeries = (s) => ({
      title: s.name,
      releaseDate: s.first_air_date || null,
      poster: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : null,
      rating: typeof s.vote_average === 'number' ? Math.round(s.vote_average * 10) / 10 : null,
      infoUrl: `https://www.themoviedb.org/tv/${s.id}`,
    })

    const [trendingMoviesRes, trendingSeriesRes, popularRes] = await Promise.all([
      tmdbGet('/trending/movie/week', {}),
      tmdbGet('/trending/tv/week', {}),
      tmdbGet('/movie/popular', { region: 'US', page: '1' }),
    ])

    // برای «گیشه» به‌جای پروکسی محبوبیت، از فیلد revenue واقعیِ TMDB استفاده
    // می‌کنیم (چون Box Office Mojo تو robots.txt خودش دسترسی خودکار رو کلاً
    // بسته). فیلم‌های «در حال اکران» اغلب هنوز revenue ثبت‌شده ندارن (این
    // فیلد با تأخیر آپدیت می‌شه)، برای همین به‌جاش مستقیم از discover با
    // sort_by=revenue.desc تو ۶ ماه اخیر می‌گیریم — TMDB خودش این‌جوری فقط
    // فیلم‌هایی که واقعاً revenue ثبت‌شده دارن رو بالا میاره.
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const todayStr = new Date().toISOString().slice(0, 10)
    const boxRes = await tmdbGet('/discover/movie', {
      sort_by: 'revenue.desc',
      'primary_release_date.gte': sixMonthsAgo,
      'primary_release_date.lte': todayStr,
      region: 'US',
      page: '1',
    })
    const boxOfficeCandidates = (boxRes?.results || []).filter((m) => m.title).slice(0, 10)
    const boxOfficeWithRevenue = await Promise.all(
      boxOfficeCandidates.map(async (m) => {
        const detail = await tmdbGet(`/movie/${m.id}`, {})
        return { ...m, revenue: detail?.revenue || 0 }
      })
    )

    const data = {
      trendingMoviesWeek: (trendingMoviesRes?.results || []).filter((m) => m.title).slice(0, 8).map(mapMovie),
      trendingSeriesWeek: (trendingSeriesRes?.results || []).filter((s) => s.name).slice(0, 8).map(mapSeries),
      popularMonth: (popularRes?.results || []).filter((m) => m.title).slice(0, 8).map(mapMovie),
      boxOffice: boxOfficeWithRevenue
        .filter((m) => m.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((m) => ({ ...mapMovie(m), revenue: m.revenue })),
    }

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('trending_boxoffice', JSON.stringify(data))
      .run()

    return data
  } catch {
    return empty
  }
}


// پرطرفدارترین آدم‌های این هفته (بازیگر/کارگردان) — از TMDB trending/person،
// شبیه بخش «Trending people» توی IMDb. یک‌روزه کش می‌شه.
export async function fetchTrendingPeople(db, env) {
  if (!env.TMDB_API_KEY) return []
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('trending_people').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

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

    const res = await tmdbGet('/trending/person/week', { language: 'en-US' })
    const isLatinName = (name) => /^[A-Za-z0-9À-ÖØ-öø-ÿ'’.\-\s]+$/.test(name || '')
    const people = (res?.results || [])
      .filter((p) => p.name && !p.adult && isLatinName(p.name))
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        photo: p.profile_path ? `https://image.tmdb.org/t/p/w300${p.profile_path}` : null,
        knownFor: (p.known_for || [])
          .map((k) => k.title || k.name)
          .filter(Boolean)
          .slice(0, 2)
          .join(', '),
        infoUrl: `https://www.themoviedb.org/person/${p.id}`,
      }))

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('trending_people', JSON.stringify(people))
      .run()

    return people
  } catch {
    return []
  }
}


// تولدهای امروز به‌طور کلی (نه فقط اهالی کالکشن) — از Wikidata SPARQL: هنرمندان
// سینما که امروز متولد شدن، مرتب بر اساس تعداد sitelink (معیار شهرت). برای
// محدود موندن تعداد fetchها، فقط ۴ نفر اول عکس می‌گیرن.
export async function fetchBornTodayGeneral(db) {
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('born_today').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const now = new Date()
    const month = now.getUTCMonth() + 1
    const day = now.getUTCDate()
    const sparql = `SELECT DISTINCT ?person ?personLabel ?dob ?sitelinks WHERE {
      VALUES ?occ { wd:Q33999 wd:Q2526255 wd:Q10800557 }
      ?person wdt:P106 ?occ .
      ?person wdt:P569 ?dob .
      FILTER(MONTH(?dob) = ${month} && DAY(?dob) = ${day})
      ?person wikibase:sitelinks ?sitelinks .
      FILTER(?sitelinks > 30)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } ORDER BY DESC(?sitelinks) LIMIT 30`

    const wikidataHeaders = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }
    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers: wikidataHeaders })
    if (!res.ok) {
      // یه بار دیگه امتحان کن — سرویس Wikidata گاهی زیر بار سنگین موقتاً رد می‌کنه
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers: wikidataHeaders })
    }
    if (!res.ok) return []
    const data = await res.json()
    const rows = data?.results?.bindings || []
    const seenNames = new Set()
    const people = []
    for (const r of rows) {
      const name = r.personLabel?.value || null
      if (!name) continue
      const key = name.toLowerCase()
      if (seenNames.has(key)) continue // یه نفر ممکنه چند occupation match بشه (بازیگر + کارگردان)، تکراری نگیر
      seenNames.add(key)
      const dob = r.dob?.value ? r.dob.value.slice(0, 10) : null
      const year = dob ? parseInt(dob.slice(0, 4), 10) : null
      people.push({ name, birthYear: year, age: year ? now.getUTCFullYear() - year : null })
      if (people.length >= 10) break
    }

    // فقط برای ۴ نفر اول عکس بگیر (هزینه‌ی fetch رو کنترل می‌کنه)
    for (let i = 0; i < Math.min(4, people.length); i++) {
      try {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=200&titles=${encodeURIComponent(people[i].name)}`,
          { headers: { 'User-Agent': 'CinefilioArchive/1.0 (personal film archive app)' } }
        )
        if (wikiRes.ok) {
          const wd = await wikiRes.json()
          const page = Object.values(wd?.query?.pages || {})[0]
          if (page?.thumbnail?.source) people[i].photo = page.thumbnail.source
        }
      } catch {}
    }

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('born_today', JSON.stringify(people))
      .run()

    return people
  } catch {
    return []
  }
}

// تقویم جشنواره‌های مهم سینمایی (Cannes/Venice/Berlinale/Sundance/TIFF/Oscars)
// — کاملاً خودکار، بدون هیچ لیست دستی. برای هر جشنواره:
//   ۱) با wbsearchentities اسم رو به Wikidata Q-ID تبدیل می‌کنیم (کش نمی‌شه چون
//      خودش سریعه و به‌ندرت عوض می‌شه، ولی نتیجه‌ی نهایی کل تابع کش می‌شه)
//   ۲) با SPARQL دنبال آیتم‌هایی می‌گردیم که «جزئی از سری» (P179) همون
//      جشنواره‌ن و تاریخ شروع (P580) دارن؛ نزدیک‌ترین ادیشن به امروز (چه در
//      حال برگزاری، چه در آینده) رو انتخاب می‌کنیم.
// کل نتیجه ۱۴ روز کش می‌شه (isCacheFresh) — چون تاریخ جشنواره‌ها به‌ندرت عوض می‌شه.
export const FESTIVAL_SERIES = [
  'Cannes Film Festival',
  'Venice Film Festival',
  'Berlin International Film Festival',
  'Sundance Film Festival',
  'Toronto International Film Festival',
  'Academy Awards',
]


export async function fetchFestivalCalendar(db) {
  try {
    const cached = await db.prepare('SELECT data, fetchedAt FROM cinema_news_cache WHERE key = ?').bind('festivals').first()
    const fresh = isCacheFresh(cached?.fetchedAt, cached?.data, 14 * 24 * 60 * 60 * 1000)
    if (fresh) {
      try {
        return JSON.parse(cached.data || '[]')
      } catch {
        return []
      }
    }

    const wikidataHeaders = {
      'User-Agent': 'CinefilmArchive/1.0 (https://github.com/maz1maz/movies-archive; personal, single-user film archive app)',
      accept: 'application/sparql-results+json',
    }

    const results = await Promise.all(FESTIVAL_SERIES.map((name) => fetchOneFestival(name, wikidataHeaders)))
    const festivals = results.filter(Boolean)

    await db
      .prepare("INSERT OR REPLACE INTO cinema_news_cache (key, data, fetchedAt) VALUES (?, ?, datetime('now'))")
      .bind('festivals', JSON.stringify(festivals))
      .run()

    return festivals
  } catch {
    return []
  }
}


export async function fetchOneFestival(seriesName, headers) {
  try {
    // ۱) اسم رو به Wikidata Q-ID تبدیل کن
    const searchRes = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(seriesName)}&language=en&type=item&format=json&limit=1`,
      { headers }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const qid = searchData?.search?.[0]?.id
    if (!qid) return null

    // ۲) نزدیک‌ترین ادیشن (P179 = این جشنواره) به امروز رو پیدا کن — چه در حال
    // برگزاری چه در آینده. از ۳۰ روز پیش شروع می‌کنیم تا جشنوالی که همین الان
    // در حال برگزاریه رو هم از دست ندیم.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const sparql = `SELECT ?item ?itemLabel ?start ?end ?website ?locationLabel WHERE {
      ?item wdt:P179 wd:${qid} .
      ?item wdt:P580 ?start .
      OPTIONAL { ?item wdt:P582 ?end. }
      OPTIONAL { ?item wdt:P856 ?website. }
      OPTIONAL { ?item wdt:P276 ?location. }
      FILTER(?start > "${cutoff}T00:00:00Z"^^xsd:dateTime)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } ORDER BY ASC(?start) LIMIT 1`

    let res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    if (!res.ok) {
      res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers })
    }
    if (!res.ok) return null
    const data = await res.json()
    const row = data?.results?.bindings?.[0]
    if (!row) return null

    const start = row.start?.value ? row.start.value.slice(0, 10) : null
    const end = row.end?.value ? row.end.value.slice(0, 10) : start
    if (!start) return null

    return {
      name: row.itemLabel?.value || seriesName,
      location: row.locationLabel?.value || null,
      start,
      end,
      url: row.website?.value || null,
    }
  } catch {
    return null
  }
}


export function ageFromBirthDate(birthDate) {
  if (!birthDate) return null
  const m = String(birthDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m
  const birth = new Date(Date.UTC(+y, +mo - 1, +d))
  const now = new Date()
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const hadBirthdayThisYear =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate())
  if (!hadBirthdayThisYear) age--
  return age >= 0 && age < 130 ? age : null
}
