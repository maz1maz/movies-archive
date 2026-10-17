import { useMemo } from 'react'

const toArr = (g) => (Array.isArray(g) ? g : (g || '').split(',').map((x) => x.trim()).filter(Boolean))
const keyOf = (f) => `${(f.title || '').trim().toLowerCase()}::${f.year || ''}`

function dedupe(films) {
  const seen = new Map()
  for (const f of films) {
    const k = keyOf(f)
    if (!seen.has(k)) seen.set(k, f)
  }
  return [...seen.values()]
}

// ژانرهای هر دهه (سهم درصدی از فیلم‌های همان دهه) — بدون سریال، بدون نسخه‌ی تکراری
export default function GenresByDecade({ films = [] }) {
  const decades = useMemo(() => {
    const unique = dedupe(films.filter((f) => f.itemType !== 'series'))
    const map = new Map()
    for (const f of unique) {
      const y = Number(f.year)
      if (!y) continue
      const d = Math.floor(y / 10) * 10
      if (!map.has(d)) map.set(d, new Map())
      const g = map.get(d)
      for (const genre of toArr(f.genre)) g.set(genre, (g.get(genre) || 0) + 1)
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([d, g]) => {
        const total = [...g.values()].reduce((s, n) => s + n, 0)
        const top = [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        return { decade: d, total, top }
      })
  }, [films])

  const maxDecadeTotal = Math.max(1, ...decades.map((d) => d.total))

  return (
    <section style={{ marginTop: 28 }}>
      <h2>Genres by decade</h2>
      <div className="discover-decades">
        {decades.map((d) => (
          <div key={d.decade} className="discover-decade-row">
            <span className="discover-decade">{d.decade}s</span>
            <div className="discover-decade-bar" style={{ width: `${(d.total / maxDecadeTotal) * 100}%` }} />
            <span className="discover-decade-genres">
              {d.top.map(([g, n]) => `${g} ${Math.round((n / d.total) * 100)}%`).join(' · ')}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
