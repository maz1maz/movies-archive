import { useMemo, useState } from 'react'
import DashboardPosterCard from './DashboardPosterCard.jsx'
import { toTodayDollars, INFLATION_BASE_YEAR } from '../utils/inflation.js'

// بخش Box office تب Themes. منبع فروش، به ترتیب اولویت:
//   ۱) revenue از TMDB (جهانی)
//   ۲) wikidata.boxOfficeWorld (Wikidata با قید «worldwide»)
//   ۳) wikidata.boxOffice بدون قید (معلوم نیست جهانیه یا آمریکا) → «?»
//   ۴) wikidata.boxOfficeUS یا boxOffice خودِ فیلم (OMDb) → «US»
// بودجه: budget خود فیلم (TMDB/OMDb) یا wikidata.budget.

const num = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function moneyOf(f) {
  const wd = f.wikidata && typeof f.wikidata === 'object' ? f.wikidata : {}
  const budget = num(f.budget) || num(wd.budget)
  let gross = null
  let scope = null
  if (num(f.revenue)) [gross, scope] = [num(f.revenue), 'world']
  else if (num(wd.boxOfficeWorld)) [gross, scope] = [num(wd.boxOfficeWorld), 'world']
  else if (num(wd.boxOffice) && wd.boxOffice !== wd.boxOfficeUS) [gross, scope] = [num(wd.boxOffice), 'unknown']
  else if (num(wd.boxOfficeUS)) [gross, scope] = [num(wd.boxOfficeUS), 'us']
  else if (num(f.boxOffice)) [gross, scope] = [num(f.boxOffice), 'us']
  return { gross, scope, budget }
}

function formatUsd(n) {
  if (!n) return '—'
  const short = (v, digits) => v.toFixed(digits).replace(/\.0$/, '')
  if (n >= 1e9) return `$${short(n / 1e9, n >= 1e10 ? 0 : 1)}B`
  if (n >= 1e6) return `$${short(n / 1e6, n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`
  return `$${Math.round(n)}`
}
const scopeTag = (s) => (s === 'us' ? ' (US)' : s === 'unknown' ? ' (?)' : '')

function median(list) {
  if (!list.length) return 0
  const s = [...list].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function Grid({ rows, onOpenFilm, subtitle }) {
  if (!rows.length) return <p className="oscars-intro">—</p>
  return (
    <div className="grid">
      {rows.map((r) => (
        <DashboardPosterCard
          key={r.film.id}
          title={r.film.title}
          subtitle={subtitle(r)}
          poster={r.film.poster}
          inArchive
          clickable
          showMissingBadge={false}
          onClick={() => onOpenFilm(r.film)}
        />
      ))}
    </div>
  )
}

function Bars({ rows, onPick, valueLabel }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="bo-bars">
      {rows.map((r) => (
        <button key={r.label} className="bo-bar-row" onClick={() => onPick?.(r)} title={`${r.label} — ${r.films.length} films`}>
          <span className="bo-bar-label">{r.label}</span>
          <span className="bo-bar-track">
            <span className="bo-bar" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />
          </span>
          <span className="bo-bar-value">{valueLabel(r)}</span>
        </button>
      ))}
    </div>
  )
}

// نمودار پراکندگی لگاریتمی بودجه/فروش. خط مورب پررنگ: فروش = بودجه؛
// خط‌چین: ۲.۵ برابر (تقریب رایج سر به سر با هزینه‌ی تبلیغات).
const W = 900
const H = 540
const PAD = { l: 64, r: 18, t: 16, b: 46 }
const LOG_MIN_X = 4 // $10K
const LOG_MAX_X = 9 // $1B
const LOG_MIN_Y = 3 // $1K
const LOG_MAX_Y = 10 // $10B
const sx = (v) => PAD.l + ((Math.log10(v) - LOG_MIN_X) / (LOG_MAX_X - LOG_MIN_X)) * (W - PAD.l - PAD.r)
const sy = (v) => H - PAD.b - ((Math.log10(v) - LOG_MIN_Y) / (LOG_MAX_Y - LOG_MIN_Y)) * (H - PAD.t - PAD.b)
const clampX = (v) => Math.min(Math.max(v, 10 ** LOG_MIN_X), 10 ** LOG_MAX_X)
const clampY = (v) => Math.min(Math.max(v, 10 ** LOG_MIN_Y), 10 ** LOG_MAX_Y)

function Scatter({ rows, onOpenFilm }) {
  const [hover, setHover] = useState(null)
  const ticksX = [1e4, 1e5, 1e6, 1e7, 1e8, 1e9]
  const ticksY = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10]
  const line = (k) => {
    const x1 = 10 ** LOG_MIN_X
    const x2 = 10 ** LOG_MAX_X
    return `M${sx(x1)},${sy(clampY(x1 * k))} L${sx(x2)},${sy(clampY(x2 * k))}`
  }
  return (
    <div className="bo-scatter-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="bo-scatter" onMouseLeave={() => setHover(null)}>
        {ticksX.map((t) => (
          <g key={`x${t}`}>
            <line className="bo-grid" x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} />
            <text className="bo-tick" x={sx(t)} y={H - PAD.b + 18} textAnchor="middle">{formatUsd(t)}</text>
          </g>
        ))}
        {ticksY.map((t) => (
          <g key={`y${t}`}>
            <line className="bo-grid" x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} />
            <text className="bo-tick" x={PAD.l - 8} y={sy(t) + 4} textAnchor="end">{formatUsd(t)}</text>
          </g>
        ))}
        <text className="bo-axis" x={(PAD.l + W - PAD.r) / 2} y={H - 6} textAnchor="middle">Budget →</text>
        <text className="bo-axis" transform={`translate(14, ${(PAD.t + H - PAD.b) / 2}) rotate(-90)`} textAnchor="middle">Box office →</text>
        <path className="bo-line-even" d={line(1)} />
        <path className="bo-line-real" d={line(2.5)} />
        <text className="bo-line-label" x={sx(3e8)} y={sy(3e8) + 16}>gross = budget</text>
        <text className="bo-line-label" x={sx(1.2e8)} y={sy(3e8) - 10}>×2.5</text>
        {rows.map((r) => (
          <circle
            key={r.film.id}
            className={`bo-dot ${r.gross >= r.budget * 2.5 ? 'hit' : r.gross >= r.budget ? 'even' : 'flop'}${hover?.film.id === r.film.id ? ' active' : ''}`}
            cx={sx(clampX(r.budget))}
            cy={sy(clampY(r.gross))}
            r={hover?.film.id === r.film.id ? 6 : 3.2}
            onMouseEnter={() => setHover(r)}
            onClick={() => onOpenFilm(r.film)}
          />
        ))}
      </svg>
      {hover && (
        <div className="bo-tooltip">
          <strong>{hover.film.title}</strong> {hover.film.year ? `(${hover.film.year})` : ''}
          <br />
          {formatUsd(hover.budget)} → {formatUsd(hover.gross)}
          {scopeTag(hover.scope)} · ×{(hover.gross / hover.budget).toFixed(1)}
        </div>
      )}
      <div className="bo-legend">
        <span><i className="hit" /> Hit (×2.5+)</span>
        <span><i className="even" /> Covered budget</span>
        <span><i className="flop" /> Flop</span>
      </div>
    </div>
  )
}

const VIEWS = [
  ['chart', 'Budget vs gross'],
  ['top', 'Top grossing'],
  ['flops', 'Biggest flops'],
  ['miracles', 'Low-budget miracles'],
  ['return', 'Best return'],
  ['groups', 'Decades & genres'],
  ['directors', 'Directors'],
  ['taste', 'Your taste vs box office'],
]

export default function BoxOfficePanel({ films, onOpenFilm, onPick }) {
  const [view, setView] = useState('chart')
  const [adjust, setAdjust] = useState(false) // احتساب تورم

  // یه ردیف برای هر فیلم (بلوری و دیجیتال یکی)، با مبلغ‌های تورم‌گرفته یا خام
  const rows = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const f of films) {
      const key = f.imdbId || `${(f.title || '').toLowerCase()}::${f.year || ''}`
      if (seen.has(key)) continue
      const m = moneyOf(f)
      if (!m.gross && !m.budget) continue
      seen.add(key)
      const k = adjust ? (v) => (v ? toTodayDollars(v, f.year) : v) : (v) => v
      out.push({ film: f, gross: k(m.gross), budget: k(m.budget), scope: m.scope })
    }
    return out
  }, [films, adjust])

  const withGross = useMemo(() => rows.filter((r) => r.gross), [rows])
  const withBoth = useMemo(() => rows.filter((r) => r.gross && r.budget), [rows])

  const data = useMemo(() => {
    const top = [...withGross].sort((a, b) => b.gross - a.gross).slice(0, 36)
    const flops = withBoth.filter((r) => r.gross < r.budget).sort((a, b) => b.budget - b.gross - (a.budget - a.gross)).slice(0, 36)
    const miracles = withBoth.filter((r) => r.budget < 1e6 && r.gross >= r.budget * 10).sort((a, b) => b.gross / b.budget - a.gross / a.budget).slice(0, 36)
    const ret = withBoth.filter((r) => r.budget >= 1e5).sort((a, b) => b.gross / b.budget - a.gross / a.budget).slice(0, 36)

    const group = (pick) => {
      const map = new Map()
      for (const r of withGross) {
        for (const label of pick(r.film)) {
          if (!label) continue
          if (!map.has(label)) map.set(label, [])
          map.get(label).push(r)
        }
      }
      return [...map.entries()].map(([label, list]) => ({ label, rows: list, films: list.map((x) => x.film), value: median(list.map((x) => x.gross)), total: list.reduce((s, x) => s + x.gross, 0) }))
    }
    const decades = group((f) => (f.year ? [`${Math.floor(f.year / 10) * 10}s`] : [])).sort((a, b) => a.label.localeCompare(b.label))
    const genres = group((f) => (Array.isArray(f.genre) ? f.genre : [])).filter((g) => g.rows.length >= 5).sort((a, b) => b.value - a.value)
    const directors = group((f) => String(f.director || '').split(',').map((d) => d.trim()))
      .map((d) => ({ ...d, value: d.total }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)

    // سلیقه: امتیاز شخصی (۰ تا ۵) اگه هست، وگرنه امتیاز IMDb
    const score = (f) => (f.myRating ? f.myRating * 2 : typeof f.rating === 'number' ? f.rating : null)
    const gems = withGross.filter((r) => score(r.film) >= 7.8 && r.gross < 5e6).sort((a, b) => score(b.film) - score(a.film)).slice(0, 24)
    const overrated = withGross.filter((r) => score(r.film) != null && score(r.film) < 6 && r.gross >= 1e8).sort((a, b) => b.gross - a.gross).slice(0, 24)
    return { top, flops, miracles, ret, decades, genres, directors, gems, overrated }
  }, [withGross, withBoth])

  const counts = { world: withGross.filter((r) => r.scope === 'world').length, other: withGross.filter((r) => r.scope !== 'world').length }
  const grossSub = (r) => `${formatUsd(r.gross)}${scopeTag(r.scope)}`

  return (
    <div className="bo-panel">
      <div className="bo-head">
        <div className="countries-map-modes">
          {VIEWS.map(([key, label]) => (
            <button key={key} className={`btn ${view === key ? '' : 'btn-ghost'}`} onClick={() => setView(key)}>
              {label}
            </button>
          ))}
        </div>
        <label className="bo-adjust">
          <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
          Adjust for inflation ({INFLATION_BASE_YEAR} dollars)
        </label>
      </div>
      <p className="oscars-intro" dir="rtl">
        فروش جهانی برای {counts.world} فیلم؛ {counts.other} فیلم فقط فروش آمریکا (US) یا نامشخص (?) دارن. منبع: TMDB و Wikidata.
      </p>

      {view === 'chart' && (
        <>
          <Scatter rows={withBoth} onOpenFilm={onOpenFilm} />
          <p className="oscars-intro">{withBoth.length} films with both budget and box office. Hover a dot for details, click to open.</p>
        </>
      )}
      {view === 'top' && <Grid rows={data.top} onOpenFilm={onOpenFilm} subtitle={grossSub} />}
      {view === 'flops' && (
        <Grid rows={data.flops} onOpenFilm={onOpenFilm} subtitle={(r) => `−${formatUsd(r.budget - r.gross)} · ${formatUsd(r.budget)} → ${formatUsd(r.gross)}${scopeTag(r.scope)}`} />
      )}
      {view === 'miracles' && (
        <Grid rows={data.miracles} onOpenFilm={onOpenFilm} subtitle={(r) => `×${Math.round(r.gross / r.budget)} · ${formatUsd(r.budget)} → ${formatUsd(r.gross)}`} />
      )}
      {view === 'return' && (
        <Grid rows={data.ret} onOpenFilm={onOpenFilm} subtitle={(r) => `×${Math.round(r.gross / r.budget)} · ${formatUsd(r.budget)} → ${formatUsd(r.gross)}`} />
      )}
      {view === 'groups' && (
        <div className="bo-two-col">
          <section>
            <h2>Median box office by decade</h2>
            <Bars rows={data.decades} onPick={onPick} valueLabel={(r) => `${formatUsd(r.value)} · ${r.rows.length}`} />
          </section>
          <section>
            <h2>Median box office by genre</h2>
            <Bars rows={data.genres} onPick={onPick} valueLabel={(r) => `${formatUsd(r.value)} · ${r.rows.length}`} />
          </section>
        </div>
      )}
      {view === 'directors' && (
        <section>
          <h2>Total box office of directors in your archive</h2>
          <Bars rows={data.directors} onPick={onPick} valueLabel={(r) => `${formatUsd(r.value)} · ${r.rows.length} films`} />
        </section>
      )}
      {view === 'taste' && (
        <>
          <h2>Hidden gems — rated 7.8+, earned under $5M</h2>
          <Grid rows={data.gems} onOpenFilm={onOpenFilm} subtitle={(r) => `★ ${r.film.myRating ? `${r.film.myRating}/5` : r.film.rating} · ${grossSub(r)}`} />
          <h2>Big hits, low ratings — $100M+, rated under 6</h2>
          <Grid rows={data.overrated} onOpenFilm={onOpenFilm} subtitle={(r) => `★ ${r.film.myRating ? `${r.film.myRating}/5` : r.film.rating} · ${grossSub(r)}`} />
        </>
      )}
    </div>
  )
}
