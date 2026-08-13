// هلپر مشترک برای اضافه‌کردن یه عنوان به «لیست سفارش» (از دکمه‌ی Order، چه تو
// Watchlists چه تو بخش Coming Soon اخبار سینما). سرور خودش تکراری رو نادیده
// می‌گیره.
export async function addToOrderList({ title, releaseDate, source, director }) {
  const res = await fetch('/api/order-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, releaseDate, source, director }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to add to order list')
  return res.json()
}

// اگه از قبل کارگردان رو نداریم (مثلاً آیتم‌های «Coming soon — everywhere»)،
// از روی لینک TMDB (themoviedb.org/movie/123 یا /tv/123) آی‌دی رو در میاره و
// یه lookup سبک و لحظه‌ای می‌زنه. فقط موقع کلیک روی Order صدا زده می‌شه، نه
// برای کل لیست.
export async function lookupDirectorFromTmdbUrl(infoUrl) {
  if (!infoUrl) return null
  const match = infoUrl.match(/themoviedb\.org\/(movie|tv)\/(\d+)/)
  if (!match) return null
  const [, mediaType, id] = match
  try {
    const res = await fetch(`/api/tmdb-director?id=${id}&type=${mediaType}`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.director || null
  } catch {
    return null
  }
}
