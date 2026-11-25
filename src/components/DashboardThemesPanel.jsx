import { useMemo, useState } from 'react'
import DashboardPosterCard from './DashboardPosterCard.jsx'
import { periodRange, formatRange, centuryBucket } from '../utils/periodYears.js'
import PeriodMindMap from './PeriodMindMap.jsx'

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
      // گره‌های بی‌نام Wikidata (genid) برچسب ندارن و URL خام برمی‌گردونن
      if (!label || label.startsWith('http')) continue
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

// خط زمان دوره‌ها: هر دوره با سال شروعش مرتب می‌شه و زیر سرفصل قرن خودش
// میاد؛ طول نوار = تعداد فیلم. دوره‌ی بلندتر (قرن) قبل از کوتاه‌تر (دهه/سال)
// با همون شروع. اونایی که سال‌شون معلوم نیست آخر، زیر «Other».
function PeriodTimeline({ periods, onPick }) {
  const { buckets, other, max } = useMemo(() => {
    const dated = []
    const other = []
    for (const g of periods) {
      const range = periodRange(g.label)
      if (range) dated.push({ ...g, range })
      else other.push(g)
    }
    dated.sort((a, b) => a.range[0] - b.range[0] || b.range[1] - b.range[0] - (a.range[1] - a.range[0]) || b.films.length - a.films.length)
    const buckets = []
    for (const g of dated) {
      const b = centuryBucket(g.range[0])
      let last = buckets[buckets.length - 1]
      if (!last || last.key !== b.key) buckets.push((last = { ...b, rows: [] }))
      last.rows.push(g)
    }
    const max = Math.max(1, ...dated.map((g) => g.films.length))
    return { buckets, other, max }
  }, [periods])

  const spanClass = ([a, b]) => (b - a >= 90 ? 'span-long' : b - a >= 9 ? 'span-mid' : 'span-short')

  return (
    <div className="period-timeline">
      <div className="period-legend">
        <span><i className="span-long" /> Century / era</span>
        <span><i className="span-mid" /> Decade / long event</span>
        <span><i className="span-short" /> Year / event</span>
      </div>
      {buckets.map((b) => (
        <div key={b.key} className="period-bucket">
          <div className="period-bucket-label">{b.label}</div>
          {b.rows.map((g) => (
            <button key={g.label} className="period-row" onClick={() => onPick(g)} title={`${g.label} — ${g.films.length}`}>
              <span className="period-range">{formatRange(g.range)}</span>
              <span className="period-name">{g.label}</span>
              <span className="period-bar-track">
                <span className={`period-bar ${spanClass(g.range)}`} style={{ width: `${Math.max(2, (g.films.length / max) * 100)}%` }} />
              </span>
              <span className="period-count">{g.films.length}</span>
            </button>
          ))}
        </div>
      ))}
      {other.length > 0 && (
        <div className="period-bucket">
          <div className="period-bucket-label">Other</div>
          <div className="countries-list-grid">
            {other.map((g) => (
              <button key={g.label} className="countries-list-item" onClick={() => onPick(g)}>
                <span className="countries-list-name">{g.label}</span>
                <span className="countries-list-count">{g.films.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardThemesPanel({ films, onOpenFilm }) {
  const [view, setView] = useState('subjects') // subjects | periods | bw | money
  const [picked, setPicked] = useState(null) // { label, films }
  // نمای دوره‌ها: مایند مپ یا فهرست خط زمان. وضعیت مایند مپ (گره‌های باز و
  // زوم) این‌جا نگه داشته می‌شه تا بعد از برگشت از فهرست فیلم‌ها از دست نره.
  const [periodView, setPeriodView] = useState('map')
  const [mindMap, setMindMap] = useState({ expanded: new Set(['root']), view: null })

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
          {withData.length} فیلم داده‌ی Wikidata دارن. روی هر مورد کلیک کن تا فیلم‌هاش رو ببینی.
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
        {view === 'periods' && (
          <>
            <div className="countries-map-modes" style={{ marginBottom: 12 }}>
              <button className={`btn ${periodView === 'map' ? '' : 'btn-ghost'}`} onClick={() => setPeriodView('map')}>Mind map</button>
              <button className={`btn ${periodView === 'list' ? '' : 'btn-ghost'}`} onClick={() => setPeriodView('list')}>Timeline list</button>
            </div>
            {periodView === 'map' ? (
              <PeriodMindMap periods={periods} onPick={setPicked} state={mindMap} setState={setMindMap} />
            ) : (
              <PeriodTimeline periods={periods} onPick={setPicked} />
            )}
          </>
        )}
        {view === 'subjects' && (
          <div className="countries-list-grid">
            {subjects.slice(0, 80).map((g) => (
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
