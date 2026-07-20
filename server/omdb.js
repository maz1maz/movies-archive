// غنی‌سازی اختیاری اطلاعات فیلم از OMDb
// اگر متغیر محیطی OMDB_API_KEY تنظیم نشده باشه، هیچ تماسی با شبکه صورت نمی‌گیره
// و فیلم دقیقاً با همون داده‌هایی که در اکسل وارد شده برگردونده می‌شه.
const BASE = 'https://www.omdbapi.com/'

export async function enrichFilm(film, key) {
  const qs = new URLSearchParams({ apikey: key, t: film.title, type: 'movie' })
  const res = await fetch(`${BASE}?${qs.toString()}`)
  if (!res.ok) return film
  const d = await res.json()
  if (d.Response !== 'True') return film

  const out = { ...film }
  if (d.Year && d.Year !== 'N/A') {
    const y = parseInt(d.Year, 10)
    if (!isNaN(y)) out.year = y
  }
  if (d.Director && d.Director !== 'N/A') out.director = d.Director
  if (d.Actors && d.Actors !== 'N/A')
    out.cast = d.Actors.split(',').map((s) => s.trim()).filter(Boolean)
  if (d.Genre && d.Genre !== 'N/A')
    out.genre = d.Genre.split(',').map((s) => s.trim()).filter(Boolean)
  if (d.imdbRating && d.imdbRating !== 'N/A') {
    const r = parseFloat(d.imdbRating)
    if (!isNaN(r)) out.rating = r
  }
  const m = (d.Runtime || '').match(/(\d+)/)
  if (m) out.runtime = parseInt(m[1], 10)
  if (d.Country && d.Country !== 'N/A') out.country = d.Country
  if (d.Plot && d.Plot !== 'N/A') out.synopsis = d.Plot
  if (d.Poster && d.Poster !== 'N/A') out.poster = d.Poster
  if (d.Rated && d.Rated !== 'N/A') out.rated = d.Rated
  if (d.Production && d.Production !== 'N/A') out.studio = d.Production
  out.imdbId = d.imdbID || undefined
  return out
}
