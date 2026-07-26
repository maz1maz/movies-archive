// غنی‌سازی سریال‌ها از TVMaze — یه API رایگان و بدون کلید، مخصوص سریال‌ها
// (برخلاف OMDb که بیشتر برای فیلمه و پوشش سریال‌هاش ضعیف‌تره). قد؛ داده‌های
// موجود توسط کاربر رو هیچ‌وقت رونویسی نمی‌کنه — فقط فیلدهای خالی رو پر می‌کنه.
const BASE = 'https://api.tvmaze.com'

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0
  return value == null || String(value).trim() === ''
}

function fillMissing(film, field, value) {
  if (!isEmpty(film[field]) || value == null || value === '') return
  film[field] = value
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function enrichSeriesFromTVMaze(film) {
  const title = (film.title || '').trim()
  if (!title) return film

  const searchRes = await fetch(
    `${BASE}/singlesearch/shows?q=${encodeURIComponent(title)}&embed=cast`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!searchRes.ok) return film
  const data = await searchRes.json()
  if (!data || !data.id) return film

  const out = { ...film }

  if (data.name) fillMissing(out, 'originalTitle', data.name)
  if (data.premiered) {
    const year = parseInt(String(data.premiered).slice(0, 4), 10)
    if (!Number.isNaN(year)) fillMissing(out, 'year', year)
  }
  if (Array.isArray(data.genres) && data.genres.length) fillMissing(out, 'genre', data.genres)
  if (data.rating?.average != null) fillMissing(out, 'rating', data.rating.average)
  const runtime = data.averageRuntime || data.runtime
  if (runtime) fillMissing(out, 'runtime', runtime)
  const networkCountry = data.network?.country?.name || data.webChannel?.country?.name
  if (networkCountry) fillMissing(out, 'country', networkCountry)
  const networkName = data.network?.name || data.webChannel?.name
  if (networkName) fillMissing(out, 'studio', networkName)
  if (data.summary) fillMissing(out, 'synopsis', stripHtml(data.summary))
  const poster = data.image?.original || data.image?.medium
  if (poster) fillMissing(out, 'poster', poster)
  if (data.externals?.imdb) fillMissing(out, 'imdbId', data.externals.imdb)

  const cast = data._embedded?.cast
  if (Array.isArray(cast) && cast.length) {
    const names = cast
      .slice(0, 8)
      .map((c) => c.person?.name)
      .filter(Boolean)
    if (names.length) fillMissing(out, 'cast', names)
  }

  return out
}
