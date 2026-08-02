// یکپارچه‌سازی با Trakt: امتیاز و وضعیت "تماشا شده" رو از پروفایل عمومیِ
// کاربر می‌گیره و روی فیلم/سریال‌های همنام آرشیو می‌ذاره. برای دیتای عمومی،
// فقط trakt-api-key (Client ID) لازمه؛ نیازی به OAuth نیست — به شرطی که
// پروفایل کاربر روی Trakt عمومی (public) باشه.

const BASE = 'https://api.trakt.tv'

async function fetchTrakt(path, clientId) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
    },
  })
  if (!res.ok) {
    if (res.status === 404) return null // یعنی کاربر پیدا نشد یا این بخش از پروفایلش خصوصیه
    throw new Error(`Trakt API error ${res.status}`)
  }
  return res.json()
}

// یه ورودی خام از Trakt (چه فیلم چه سریال) رو به شکل ساده‌ی
// {title, year, imdbId} در میاره.
function extractMedia(entry) {
  const media = entry.movie || entry.show
  if (!media) return null
  return {
    title: media.title || '',
    year: media.year || null,
    imdbId: media.ids && media.ids.imdb ? media.ids.imdb : null,
  }
}

export async function fetchTraktLibrary(username, clientId) {
  const [ratingMovies, ratingShows, watchedMovies, watchedShows] = await Promise.all([
    fetchTrakt(`/users/${encodeURIComponent(username)}/ratings/movies`, clientId),
    fetchTrakt(`/users/${encodeURIComponent(username)}/ratings/shows`, clientId),
    fetchTrakt(`/users/${encodeURIComponent(username)}/watched/movies`, clientId),
    fetchTrakt(`/users/${encodeURIComponent(username)}/watched/shows`, clientId),
  ])

  // اگه هر ۴ تا null باشن، یعنی یوزرنیم اصلاً پیدا نشد (نه اینکه فقط خصوصیه)
  if (!ratingMovies && !ratingShows && !watchedMovies && !watchedShows) {
    return null
  }

  const ratings = new Map() // key: imdbId یا title::year -> rating (0-5)
  const watched = new Set()

  for (const list of [ratingMovies, ratingShows]) {
    for (const entry of list || []) {
      const media = extractMedia(entry)
      if (!media) continue
      const key = media.imdbId || `${media.title.toLowerCase()}::${media.year}`
      // امتیاز Trakt از ۱ تا ۱۰ه؛ به مقیاس ۰ تا ۵ ستاره‌ی خودمون تبدیل می‌کنیم.
      ratings.set(key, { stars: Math.round((entry.rating || 0) / 2), ...media })
    }
  }
  for (const list of [watchedMovies, watchedShows]) {
    for (const entry of list || []) {
      const media = extractMedia(entry)
      if (!media) continue
      const key = media.imdbId || `${media.title.toLowerCase()}::${media.year}`
      watched.add(key)
    }
  }

  return { ratings, watched }
}
