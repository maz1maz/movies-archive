// ماژول اختیاری غنی‌سازی اطلاعات فیلم از TMDB
// اگر متغیر محیطی TMDB_API_KEY تنظیم نشده باشه، هیچ تماسی با شبکه صورت نمی‌گیره
// و فیلم دقیقاً با همون داده‌هایی که در اکسل وارد شده برگردونده می‌شه.
const BASE = 'https://api.themoviedb.org/3'

export async function enrichFilm(film, key) {
  const q = encodeURIComponent(film.title)
  const url = `${BASE}/search/movie?api_key=${key}&language=fa-IR&query=${q}&include_adult=false`
  const res = await fetch(url)
  if (!res.ok) return film
  const data = await res.json()
  const m = data.results && data.results[0]
  if (!m) return film

  let director = film.director
  let cast = film.cast
  try {
    const cRes = await fetch(
      `${BASE}/movie/${m.id}/credits?api_key=${key}&language=fa-IR`
    )
    if (cRes.ok) {
      const c = await cRes.json()
      if (!director) {
        const d = (c.crew || []).find((x) => x.job === 'Director')
        if (d) director = d.name
      }
      if (!cast || cast.length === 0) {
        cast = (c.cast || []).slice(0, 8).map((x) => x.name)
      }
    }
  } catch {
    /* نادیده گرفتن خطای کست */
  }

  const poster = m.poster_path
    ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
    : film.poster

  return {
    ...film,
    originalTitle: film.originalTitle || m.original_title || undefined,
    year:
      film.year ||
      (m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : undefined),
    rating:
      film.rating ||
      (typeof m.vote_average === 'number'
        ? Math.round(m.vote_average * 10) / 10
        : undefined),
    synopsis: film.synopsis || m.overview || undefined,
    poster,
    director,
    cast,
    tmdbId: m.id,
  }
}
