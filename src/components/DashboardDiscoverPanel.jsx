import { useEffect, useMemo, useState } from 'react'
import { guessMovements, TAG_LABELS } from '../utils/movements.js'
import DashboardPosterCard from './DashboardPosterCard.jsx'

// تب «Discover» — همه‌چیز خودکار از دیتای موجود، بدون ورود دستی:
// Top 10 هر سال، تحسین‌شده‌های ندیده، ژانر غالب هر دهه، و اسکن سال‌های مشکوک.

const toArr = (g) => (Array.isArray(g) ? g : (g || '').split(',').map((x) => x.trim()).filter(Boolean))
const keyOf = (f) => `${(f.title || '').trim().toLowerCase()}::${f.year || ''}`
const normTitle = (t) =>
  (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// بلوری+دیجیتالِ یه فیلم یکی حساب می‌شه
function dedupe(films) {
  const seen = new Map()
  for (const f of films) {
    const k = keyOf(f)
    if (!seen.has(k)) seen.set(k, f)
  }
  return [...seen.values()]
}

const score = (f) => (f.myRating ? f.myRating * 2 : 0) + (Number(f.rating) || 0) + (Number(f.letterboxdRating) || 0) * 2

function PosterGrid({ films, onOpenFilm }) {
  return (
    <div className="grid">
      {films.map((f) => (
        <DashboardPosterCard
          key={f.id}
          title={f.title}
          subtitle={[f.year, f.director].filter(Boolean).join(' — ')}
          poster={f.poster}
          inArchive
          clickable
          showMissingBadge={false}
          onClick={() => onOpenFilm(f)}
        />
      ))}
    </div>
  )
}

export default function DashboardDiscoverPanel({ films = [], onOpenFilm }) {
  const unique = useMemo(() => dedupe(films.filter((f) => f.itemType !== 'series')), [films])

  const years = useMemo(
    () => [...new Set(unique.map((f) => Number(f.year)).filter(Boolean))].sort((a, b) => b - a),
    [unique]
  )
  const [year, setYear] = useState(null)
  const activeYear = year ?? years[0]
  const topOfYear = useMemo(
    () => unique.filter((f) => Number(f.year) === activeYear).sort((a, b) => score(b) - score(a)).slice(0, 10),
    [unique, activeYear]
  )

  // IMDb ≥ 7.8 یا Letterboxd ≥ 3.9، و هنوز دیده نشده
  const acclaimedUnwatched = useMemo(
    () =>
      unique
        .filter((f) => !f.watched && ((Number(f.rating) || 0) >= 7.8 || (Number(f.letterboxdRating) || 0) >= 3.9))
        .sort((a, b) => score(b) - score(a))
        .slice(0, 24),
    [unique]
  )

  const decades = useMemo(() => {
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
  }, [unique])

  // هم‌نام با سال‌های خیلی متفاوت (۳+ سال) — معمولاً یکی‌شون سالش اشتباه ثبت شده
  // (ریمیک‌های واقعی هم ممکنه بیان؛ فقط برای بررسی)
  const [scanOn, setScanOn] = useState(false)
  const yearMismatches = useMemo(() => {
    if (!scanOn) return []
    const groups = new Map()
    for (const f of films) {
      const k = `${normTitle(f.title)}::${f.itemType || 'movie'}`
      if (!normTitle(f.title)) continue
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(f)
    }
    const out = []
    for (const list of groups.values()) {
      const ys = [...new Set(list.map((f) => Number(f.year)).filter(Boolean))]
      if (ys.length < 2) continue
      const directors = new Set(list.map((f) => (f.director || '').toLowerCase()).filter(Boolean))
      // کارگردان یکی ولی سال فرق داره → تقریباً حتماً اشتباه
      if (directors.size <= 1 && Math.max(...ys) - Math.min(...ys) >= 1) out.push(list)
    }
    return out.sort((a, b) => (a[0].title || '').localeCompare(b[0].title || ''))
  }, [films, scanOn])

  const maxDecadeTotal = Math.max(1, ...decades.map((d) => d.total))

  // برچسب‌های TMDB (کالت/تجربی/…) + حدسِ جنبش از کارگردان/کشور/سال
  const [tmdbTagMap, setTmdbTagMap] = useState({})
  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then((d) => setTmdbTagMap(d.tags || {}))
      .catch(() => {})
  }, [])
  const byTag = useMemo(() => {
    const idToFilm = new Map(films.map((f) => [String(f.id), f]))
    const map = new Map()
    const add = (tag, f) => {
      if (!f) return
      if (!map.has(tag)) map.set(tag, new Map())
      map.get(tag).set(keyOf(f), f)
    }
    for (const [tag, ids] of Object.entries(tmdbTagMap)) ids.forEach((id) => add(tag, idToFilm.get(String(id))))
    for (const f of films) guessMovements(f).forEach((t) => add(t, f))
    return [...map.entries()]
      .map(([tag, m]) => [tag, [...m.values()].sort((a, b) => score(b) - score(a))])
      .sort((a, b) => b[1].length - a[1].length)
  }, [films, tmdbTagMap])
  const [activeTag, setActiveTag] = useState(null)
  const shownTag = activeTag || byTag[0]?.[0]
  const shownFilms = byTag.find(([t]) => t === shownTag)?.[1] || []

  return (
    <div className="oscars-panel discover-panel">
      <section>
        <div className="discover-head">
          <h2>Top 10 of {activeYear || '—'}</h2>
          <select className="input discover-year" value={activeYear || ''} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <p className="oscars-intro">Ranked by your own rating first, then IMDb and Letterboxd.</p>
        {topOfYear.length ? <PosterGrid films={topOfYear} onOpenFilm={onOpenFilm} /> : <div className="empty">No films from this year.</div>}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Acclaimed, not watched yet ({acclaimedUnwatched.length})</h2>
        <p className="oscars-intro">In your archive with IMDb ≥ 7.8 or Letterboxd ≥ 3.9 — still unwatched.</p>
        {acclaimedUnwatched.length ? <PosterGrid films={acclaimedUnwatched} onOpenFilm={onOpenFilm} /> : <div className="empty">You've seen them all.</div>}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Cult, experimental &amp; movements</h2>
        <p className="oscars-intro">Tagged automatically from TMDB keywords, plus movement guesses from director, country and year. Fills in over the next few weeks.</p>
        <div className="row row-wrap" style={{ gap: 6, margin: '8px 0 14px' }}>
          {byTag.map(([tag, list]) => (
            <button key={tag} className={`btn ${tag === shownTag ? 'btn-primary' : ''}`} onClick={() => setActiveTag(tag)}>
              {TAG_LABELS[tag] || tag} ({list.length})
            </button>
          ))}
        </div>
        {shownFilms.length ? <PosterGrid films={shownFilms.slice(0, 48)} onOpenFilm={onOpenFilm} /> : <div className="empty">No tagged films yet.</div>}
      </section>

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

      <section style={{ marginTop: 28 }}>
        <div className="discover-head">
          <h2>Year check</h2>
          <button className="btn btn-primary" onClick={() => setScanOn(true)}>
            Scan for wrong years
          </button>
        </div>
        <p className="oscars-intro">Same title and director, different year — usually one entry has a wrong year.</p>
        {scanOn && yearMismatches.length === 0 && <div className="empty">No mismatches found.</div>}
        {yearMismatches.map((group) => (
          <div key={group[0].id} className="discover-mismatch">
            <strong>{group[0].title}</strong>
            {group.map((f) => (
              <button key={f.id} type="button" className="discover-mismatch-item" onClick={() => onOpenFilm(f)}>
                {f.year || '—'} · {f.mediaType === 'digital' ? 'Digital' : 'Blu-ray'}
                {f.director ? ` · ${f.director}` : ''}
              </button>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
