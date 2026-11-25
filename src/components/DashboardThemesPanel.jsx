import { useMemo, useState } from 'react'
import DashboardPosterCard from './DashboardPosterCard.jsx'

// تب «Themes» — همه از ستون wikidata (Wikidata):
// موضوع اصلی (P921)، دوره‌ی زمانی داستان (P2408)، سیاه‌وسفید (P462)،
// گیشه/بودجه (P2142/P2130، فقط دلاری). پوشش ناقصه؛ فیلم بی‌داده شمرده نمی‌شه.

function formatUsd(n) {
  if (!n) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`
  return `$${n}`
}

// بلوری و دیجیتالِ یه فیلم دو ردیف جدان؛ برای شمارش یکی حسابشون می‌کنیم.
function dedupe(films) {
  const seen = new Set()
  return films.filter((f) => {
    const key = f.imdbId || `${(f.title || '').toLowerCase()}::${f.year || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function groupBy(films, pick) {
  const map = new Map()
  for (const f of films) {
    for (const label of pick(f) || []) {
      if (!map.has(label)) map.set(label, [])
      map.get(label).push(f)
    }
  }
  return [...map.entries()].map(([label, list]) => ({ label, films: list })).sort((a, b) => b.films.length - a.films.length)
}

function FilmGrid({ films, onOpenFilm, subtitleFor }) {
  return (
    <div className="grid">
      {films.map((film) => (
        <DashboardPosterCard
          key={film.id}
          title={film.title}
          subtitle={subtitleFor ? subtitleFor(film) : film.year ? String(film.year) : ''}
          poster={film.poster}
          inArchive
          clickable
          showMissingBadge={false}
          onClick={() => onOpenFilm(film)}
        />
      ))}
    </div>
  )
}

export default function DashboardThemesPanel({ films, onOpenFilm }) {
  const [view, setView] = useState('subjects') // subjects | periods | bw | money
  const [picked, setPicked] = useState(null) // { label, films }

  const withData = useMemo(() => dedupe(films.filter((f) => f.wikidata && typeof f.wikidata === 'object')), [films])
  const subjects = useMemo(() => groupBy(withData, (f) => f.wikidata.subjects), [withData])
  const periods = useMemo(() => groupBy(withData, (f) => f.wikidata.periods), [withData])
  const bw = useMemo(() => withData.filter((f) => f.wikidata.color === 'black-and-white').sort((a, b) => (a.year || 0) - (b.year || 0)), [withData])
  const money = useMemo(() => {
    const rows = withData.filter((f) => f.wikidata.boxOffice)
    const topGross = [...rows].sort((a, b) => b.wikidata.boxOffice - a.wikidata.boxOffice).slice(0, 24)
    // نسبت فروش به بودجه — فقط وقتی هر دو هست؛ بودجه‌ی خیلی کم (<۱۰۰هزار) نسبت‌های بی‌معنی می‌سازه.
    const topRatio = rows
      .filter((f) => f.wikidata.budget >= 100000)
      .map((f) => ({ film: f, ratio: f.wikidata.boxOffice / f.wikidata.budget }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 24)
    return { topGross, topRatio }
  }, [withData])

  const tabs = [
    ['subjects', `Themes (${subjects.length})`],
    ['periods', `Periods (${periods.length})`],
    ['bw', `Black & white (${bw.length})`],
    ['money', 'Box office'],
  ]

  if (picked) {
    return (
      <div className="oscars-panel">
        <div className="card oscars-controls">
          <button className="btn btn-ghost" onClick={() => setPicked(null)}>← Back</button>
        </div>
        <section>
          <h2>{picked.label} — {picked.films.length} film{picked.films.length === 1 ? '' : 's'}</h2>
          <FilmGrid films={picked.films} onOpenFilm={onOpenFilm} />
        </section>
      </div>
    )
  }

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro" dir="rtl">
          {withData.length} فیلم داده‌ی Wikidata دارن. برای پر کردن بقیه، از تب Countries دکمه‌ی «پر کردن از Wikidata» رو بزن.
        </p>
        <div className="countries-map-modes">
          {tabs.map(([key, label]) => (
            <button key={key} className={`btn ${view === key ? '' : 'btn-ghost'}`} onClick={() => setView(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <section>
        {(view === 'subjects' || view === 'periods') && (
          <div className="countries-list-grid">
            {(view === 'subjects' ? subjects : periods).slice(0, 80).map((g) => (
              <button key={g.label} className="countries-list-item" onClick={() => setPicked(g)}>
                <span className="countries-list-name">{g.label}</span>
                <span className="countries-list-count">{g.films.length}</span>
              </button>
            ))}
          </div>
        )}
        {view === 'bw' && <FilmGrid films={bw} onOpenFilm={onOpenFilm} />}
        {view === 'money' && (
          <>
            <h2>پرفروش‌ترین‌ها</h2>
            <FilmGrid films={money.topGross} onOpenFilm={onOpenFilm} subtitleFor={(f) => formatUsd(f.wikidata.boxOffice)} />
            <h2>بیشترین سود نسبت به بودجه</h2>
            <FilmGrid
              films={money.topRatio.map((r) => r.film)}
              onOpenFilm={onOpenFilm}
              subtitleFor={(f) => `×${Math.round(f.wikidata.boxOffice / f.wikidata.budget)} · ${formatUsd(f.wikidata.budget)} → ${formatUsd(f.wikidata.boxOffice)}`}
            />
          </>
        )}
        {withData.length === 0 && <p className="oscars-intro" dir="rtl">هنوز داده‌ای نیست.</p>}
      </section>
    </div>
  )
}
