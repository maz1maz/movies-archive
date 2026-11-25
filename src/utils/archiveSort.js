// همون ترتیب الفبایی پیش‌فرض سرور (worker.js، /api/films)، سمت مرورگر:
// «The» ابتدای عنوان نادیده گرفته می‌شه و عنوان‌هایی که با عدد شروع می‌شن آخر میان.
// برای بارگذاری کل آرشیو با ?order=none که مرتب‌سازی رو از D1 برداشته.
function sortKey(title) {
  const t = String(title || '')
  const key = t.toLowerCase().startsWith('the ') ? t.slice(4) : t
  return { digit: /^[0-9]/.test(key) ? 1 : 0, key: key.toLowerCase() }
}

export function sortArchiveByTitle(films) {
  const keyed = films.map((f) => ({ f, k: sortKey(f.title) }))
  keyed.sort((a, b) => a.k.digit - b.k.digit || (a.k.key < b.k.key ? -1 : a.k.key > b.k.key ? 1 : 0))
  return keyed.map((x) => x.f)
}
