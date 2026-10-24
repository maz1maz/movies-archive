// لینک IMDb برای فیلمی که تو آرشیو نیست (جاهایی که دکمه‌ی «Order» هست):
// اگه شناسه‌ی IMDb داریم مستقیم صفحه‌ی فیلم، وگرنه /api/imdb-go که همون‌جا
// شناسه رو پیدا می‌کنه و ریدایرکت می‌کنه.
export function imdbUrl({ imdbId, title, year, type } = {}) {
  if (imdbId && /^tt\d+$/.test(imdbId)) return `https://www.imdb.com/title/${imdbId}/`
  // بدون شناسه: سرور از روی TMDB پیداش می‌کنه و به صفحه‌ی خود فیلم ریدایرکت می‌کنه
  const qs = new URLSearchParams({ title: String(title || '').trim() })
  const y = String(year || '').match(/\d{4}/)?.[0]
  if (y) qs.set('year', y)
  if (type === 'series' || type === 'tv') qs.set('type', 'tv')
  return `/api/imdb-go?${qs}`
}

// همین برای آدم‌ها (کارگردان/بازیگر)
export function imdbPersonUrl({ imdbId, name } = {}) {
  if (imdbId && /^nm\d+$/.test(imdbId)) return `https://www.imdb.com/name/${imdbId}/`
  return `/api/imdb-go?${new URLSearchParams({ name: String(name || '').trim() })}`
}
