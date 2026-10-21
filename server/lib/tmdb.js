// TMDB_API_KEY ممکنه کلید کلاسیک v3 (پارامتر api_key تو URL) باشه یا توکن
// v4 Read Access (هدر Authorization: Bearer). از ۲۱ سپتامبر ۲۰۲۶ هیچ جواب
// TMDB‌ای (پوستر جایگزین، مجموعه‌ها) کش نشده بود چون این‌جاها فقط api_key
// امتحان می‌شد؛ حالا اگه 401 بیاد، همون درخواست با Bearer تکرار می‌شه.
export async function tmdbFetch(url, env) {
  const res = await fetch(url)
  if (res.status !== 401 || !env?.TMDB_API_KEY) return res
  const u = new URL(url)
  u.searchParams.delete('api_key')
  return fetch(u.toString(), {
    headers: { Authorization: `Bearer ${env.TMDB_API_KEY}`, accept: 'application/json' },
  })
}
