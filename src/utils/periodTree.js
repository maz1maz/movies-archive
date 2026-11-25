import { periodRange, centuryBucket } from './periodYears.js'

// درخت دوره‌ها (مشترک بین آکاردئون و مایند مپ تب Themes → Periods):
//   Periods ← قرن ← { Decades ← دهه ← سال/رویداد ، Eras & events ← دوره‌های بلند/اسم‌دار }
// دوره‌های بلند (۲۰ سال به بالا، مثل «Cold War» یا «interwar period») زیر هیچ دهه‌ای
// نمی‌رن؛ قبلاً بین دهه‌ها قاطی می‌شدن و گیج‌کننده بود، حالا شاخه‌ی جدا دارن.
// قرنی که فقط یکی از این دو نوع رو داره، بدون شاخه‌ی میانی نشون داده می‌شه.
// برچسب‌هایی که سال ندارن (ماه بدون سال، دنیای خیالی) آخر، زیر «Undated / fictional».

const sameFilm = (a, b) => (a.imdbId && a.imdbId === b.imdbId) || a.id === b.id
function mergeFilms(lists) {
  const out = []
  for (const list of lists) for (const f of list) if (!out.some((x) => sameFilm(x, f))) out.push(f)
  return out
}

const byStart = (a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0) || (b.range?.[1] ?? 0) - (a.range?.[1] ?? 0)

export function buildPeriodTree(periods) {
  const buckets = new Map()
  const other = []
  for (const g of periods) {
    const range = periodRange(g.label)
    if (!range) {
      other.push({ id: `o:${g.label}`, label: g.label, films: g.films })
      continue
    }
    const b = centuryBucket(range[0])
    if (!buckets.has(b.key)) buckets.set(b.key, { key: b.key, label: b.label, long: [], decades: new Map() })
    const bucket = buckets.get(b.key)
    const leaf = { id: `p:${g.label}`, label: g.label, films: g.films, range }
    const span = range[1] - range[0]
    const groupByDecade = span < 20 && range[0] >= 1500 && range[0] <= 2100
    if (!groupByDecade) {
      bucket.long.push(leaf)
      continue
    }
    const dk = Math.floor(range[0] / 10) * 10
    if (!bucket.decades.has(dk)) bucket.decades.set(dk, { id: `d:${dk}`, label: `${dk}s`, range: [dk, dk + 9], children: [] })
    const decade = bucket.decades.get(dk)
    // برچسب خودِ دهه («1940s») برگ اول گروهش می‌شه
    if (g.label === `${dk}s`) decade.children.unshift({ ...leaf, label: 'Whole decade', fullLabel: g.label })
    else decade.children.push(leaf)
  }

  const children = [...buckets.values()]
    .sort((a, b) => a.key - b.key)
    .map((b) => {
      const decades = [...b.decades.values()]
        .map((d) => {
          if (d.children.length === 1) {
            const only = d.children[0]
            return only.fullLabel ? { ...only, label: only.fullLabel } : only
          }
          d.children.sort((x, y) => (x.label === 'Whole decade' ? -1 : y.label === 'Whole decade' ? 1 : byStart(x, y)))
          return d
        })
        .sort(byStart)
      const eras = [...b.long].sort(byStart)
      let kids
      if (decades.length && eras.length) {
        kids = [
          { id: `g:${b.key}:dec`, label: 'Decades', children: decades },
          { id: `g:${b.key}:era`, label: 'Eras & events', children: eras },
        ]
      } else kids = decades.length ? decades : eras
      return { id: `b:${b.key}`, label: b.label, children: kids }
    })
  if (other.length) {
    children.push({ id: 'b:other', label: 'Undated / fictional', children: other.sort((a, b) => b.films.length - a.films.length) })
  }

  const root = { id: 'root', label: 'Periods', children }
  // تعداد فیلم یکتا برای هر گره (بلوری و دیجیتال یکی)
  const fill = (n) => {
    if (n.children) n.films = mergeFilms(n.children.map(fill))
    return n.films
  }
  fill(root)
  return root
}
