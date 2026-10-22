// لینک IMDb برای فیلمی که تو آرشیو نیست (جاهایی که دکمه‌ی «Order» هست):
// اگه شناسه‌ی IMDb داریم مستقیم صفحه‌ی فیلم، وگرنه جست‌وجوی عنوان + سال
// (فیلم معمولاً اولین نتیجه‌ست).
export function imdbUrl({ imdbId, title, year } = {}) {
  if (imdbId && /^tt\d+$/.test(imdbId)) return `https://www.imdb.com/title/${imdbId}/`
  const q = `${title || ''} ${year || ''}`.trim()
  return `https://www.imdb.com/find/?q=${encodeURIComponent(q)}&s=tt`
}
