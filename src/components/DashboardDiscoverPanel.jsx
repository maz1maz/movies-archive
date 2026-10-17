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

// mediaMap: key → Set(mediaType) — تا معلوم باشه بلوری داری، دیجیتال یا هردو
function PosterGrid({ films, onOpenFilm, mediaMap }) {
  return (
    <div className="grid">
      {films.map((f) => {
        const types = mediaMap?.get(keyOf(f)) || new Set([f.mediaType === 'digital' ? 'digital' : 'physical'])
        return (
          <DashboardPosterCard
            key={f.id}
            title={f.title}
            subtitle={[f.year, f.director].filter(Boolean).join(' — ')}
            poster={f.poster}
            media={{ bluray: types.has('physical'), digital: types.has('digital') }}
            inArchive
            clickable
            showMissingBadge={false}
            onClick={() => onOpenFilm(f)}
          />
        )
      })}
    </div>
  )
}

// only: 'year' | 'tags' — فقط همون بخش رو نشون بده (برای صفحه‌ی اصلی)؛ بدونش کل تب Discover
export default function DashboardDiscoverPanel({ films = [], onOpenFilm, onFilmsChanged, only = null, title = null }) {
  const show = (k) => !only || only === k
  const unique = useMemo(() => dedupe(films.filter((f) => f.itemType !== 'series')), [films])

  // همه‌ی سال‌ها از امسال تا قدیمی‌ترین فیلمِ آرشیو (نه فقط سال‌هایی که فیلم داری)
  const years = useMemo(() => {
    const now = new Date().getFullYear()
    const min = Math.min(now, ...unique.map((f) => Number(f.year)).filter((y) => y > 1880))
    return Array.from({ length: now - min + 1 }, (_, i) => now - i)
  }, [unique])
  const [year, setYear] = useState(null)
  const activeYear = year ?? new Date().getFullYear()

  // بهترین‌های جهانیِ همون سال از TMDB؛ اونایی که داری قابل کلیکن، بقیه Order دارن
  const [worldTop, setWorldTop] = useState(null)
  useEffect(() => {
    if (!activeYear || !show('year')) return
    setWorldTop(null)
    let cancelled = false
    fetch(`/api/top-of-year?year=${activeYear}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setWorldTop(Array.isArray(d.films) ? d.films : []) })
      .catch(() => { if (!cancelled) setWorldTop([]) })
    return () => { cancelled = true }
  }, [activeYear])
  const archiveIndex = useMemo(() => {
    const m = new Map()
    for (const f of unique) {
      const y = Number(f.year)
      for (const t of [f.title, f.originalTitle]) {
        const n = normTitle(t)
        if (!n) continue
        for (const yy of [y - 1, y, y + 1]) if (!m.has(`${n}::${yy}`)) m.set(`${n}::${yy}`, f)
      }
    }
    return m
  }, [unique])
  const worldWithArchive = useMemo(
    () =>
      (worldTop || []).map((w) => ({
        ...w,
        owned: archiveIndex.get(`${normTitle(w.title)}::${w.year}`) || archiveIndex.get(`${normTitle(w.originalTitle)}::${w.year}`) || null,
      })),
    [worldTop, archiveIndex]
  )
  // فیلم‌های خودت از همون سال که تو لیست TMDB نیستن (برتر بر اساس امتیاز خودت)
  const extraFilms = useMemo(() => {
    const ownedIds = new Set(worldWithArchive.filter((w) => w.owned).map((w) => w.owned.id))
    return unique
      .filter((f) => Number(f.year) === activeYear && !ownedIds.has(f.id))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 10)
  }, [unique, activeYear, worldWithArchive])

  // IMDb ≥ 7.8 یا Letterboxd ≥ 3.9، و هنوز دیده نشده
  const acclaimedUnwatched = useMemo(
    () =>
      unique
        .filter((f) => !f.watched && ((Number(f.rating) || 0) >= 7.8 || (Number(f.letterboxdRating) || 0) >= 3.9))
        .sort((a, b) => score(b) - score(a))
        .slice(0, 24),
    [unique]
  )


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

  // سالِ درست هر گروه از TMDB (۴تا هم‌زمان، نتیجه سمت سرور کش می‌شه)
  const [rightYears, setRightYears] = useState({})
  useEffect(() => {
    if (!yearMismatches.length) return
    let cancelled = false
    const queue = [...yearMismatches]
    const worker = async () => {
      while (queue.length && !cancelled) {
        const g = queue.shift()
        const years = [...new Set(g.map((f) => Number(f.year)).filter(Boolean))].join(',')
        try {
          const r = await fetch(`/api/release-year?title=${encodeURIComponent(g[0].title)}&years=${years}&type=${g[0].itemType || 'movie'}`)
          const d = await r.json()
          if (!cancelled) setRightYears((prev) => ({ ...prev, [g[0].id]: d.year ?? 'unknown' }))
        } catch {
          if (!cancelled) setRightYears((prev) => ({ ...prev, [g[0].id]: 'unknown' }))
        }
      }
    }
    Promise.all([worker(), worker(), worker(), worker()])
    return () => { cancelled = true }
  }, [yearMismatches])

  const exportYearCheck = async () => {
    const XLSX = await import('xlsx')
    const rows = []
    for (const g of yearMismatches) {
      const right = rightYears[g[0].id]
      for (const f of g) {
        rows.push({
          Title: f.title,
          Director: f.director || '',
          'Entry year': f.year || '',
          'Correct year (TMDB)': typeof right === 'number' ? right : '',
          Status: typeof right !== 'number' ? 'Unknown' : Number(f.year) === right ? 'OK' : 'WRONG',
          Media: f.mediaType === 'digital' ? 'Digital' : 'Blu-ray',
          Location: f.mediaType === 'digital' ? f.driveNumber || '' : [f.closet, f.row, f.shelf].filter(Boolean).join(' / '),
          'IMDb id': f.imdbId || '',
          'Film id': f.id,
        })
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 36 }, { wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 12 }, { wch: 38 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Year check')
    XLSX.writeFile(wb, `year-check-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  // اصلاحِ سال با یه کلیک (PATCH)؛ تا رفرش لیست، سالِ جدید همین‌جا نشون داده می‌شه
  const [fixedYears, setFixedYears] = useState({})
  const [fixing, setFixing] = useState(null)
  const fixYear = async (f, year) => {
    const gap = Math.abs(Number(f.year) - year)
    const msg = gap > 2
      ? `${f.title}: ${f.year} → ${year}?\n\nThe gap is ${gap} years — this might be a different film (remake). Change anyway?`
      : `${f.title}: ${f.year} → ${year}?`
    if (!window.confirm(msg)) return
    setFixing(f.id)
    try {
      const res = await fetch(`/api/films/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status)
      setFixedYears((prev) => ({ ...prev, [f.id]: year }))
      if (onFilmsChanged) onFilmsChanged()
    } catch (e) {
      alert(`Failed: ${e.message}`)
    }
    setFixing(null)
  }
  const resolvedCount = yearMismatches.filter((g) => rightYears[g[0].id] !== undefined).length

  // برچسب‌های TMDB (کالت/تجربی/…) + حدسِ جنبش از کارگردان/کشور/سال
  const [tmdbTagMap, setTmdbTagMap] = useState({})
  useEffect(() => {
    if (!show('tags')) return
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
  const mediaMap = useMemo(() => {
    const m = new Map()
    for (const f of films) {
      const k = keyOf(f)
      if (!m.has(k)) m.set(k, new Set())
      m.get(k).add(f.mediaType === 'digital' ? 'digital' : 'physical')
    }
    return m
  }, [films])
  // مثل صفحه‌های اصلی: دسکتاپ ۴۹ (۷ ستون)، موبایل ۴۸
  const [PAGE] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 900px)').matches ? 48 : 49
  )
  const [tagPage, setTagPage] = useState(1)
  const [activeTag, setActiveTag] = useState(null)
  const shownTag = activeTag || byTag[0]?.[0]
  const [tagQuery, setTagQuery] = useState('')
  const shownFilmsAll = byTag.find(([t]) => t === shownTag)?.[1] || []
  const tq = tagQuery.trim().toLowerCase()
  const shownFilms = tq
    ? shownFilmsAll.filter((f) => `${f.title || ''} ${f.originalTitle || ''} ${f.director || ''} ${f.year || ''}`.toLowerCase().includes(tq))
    : shownFilmsAll

  return (
    <div className={only ? 'oscars-panel discover-panel discover-home' : 'oscars-panel discover-panel'}>
      {title && <h2 className="discover-home-title">{title}</h2>}
      {show('year') && (
      <section>
        <div className="discover-head">
          <h2>Best of {activeYear || '—'}</h2>
          <select className="input discover-year" value={activeYear || ''} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <p className="oscars-intro">
          Highest rated on TMDB, numbered in that order. Then your top films of the year from your own ratings.{' '}
          {worldTop && `You own ${worldWithArchive.filter((w) => w.owned).length} of ${worldWithArchive.length}.`}
        </p>
        {worldTop === null ? (
          <div className="empty">Loading…</div>
        ) : worldWithArchive.length || extraFilms.length ? (
          <div className="grid">
            {worldWithArchive.map((w, i) =>
              w.owned ? (
                <DashboardPosterCard
                  key={w.title}
                  title={`${i + 1}. ${w.owned.title}`}
                  subtitle={[w.owned.year, w.owned.director].filter(Boolean).join(' — ')}
                  poster={w.owned.poster || w.poster}
                  badgeText="In archive"
                  badgeVariant="owned"
                  media={(() => {
                    const t = mediaMap.get(keyOf(w.owned)) || new Set()
                    return { bluray: t.has('physical'), digital: t.has('digital') }
                  })()}
                  inArchive
                  clickable
                  showMissingBadge={false}
                  onClick={() => onOpenFilm(w.owned)}
                />
              ) : (
                <DashboardPosterCard
                  key={w.title}
                  title={`${i + 1}. ${w.title}`}
                  subtitle={[w.year, w.rating ? `★ ${w.rating}` : null].filter(Boolean).join(' — ')}
                  poster={w.poster}
                  inArchive={false}
                />
              )
            )}
            {extraFilms.map((f, j) => (
              <DashboardPosterCard
                key={f.id}
                title={`${worldWithArchive.length + j + 1}. ${f.title}`}
                subtitle={[f.year, f.director].filter(Boolean).join(' — ')}
                poster={f.poster}
                media={(() => {
                  const t = mediaMap.get(keyOf(f)) || new Set()
                  return { bluray: t.has('physical'), digital: t.has('digital') }
                })()}
                inArchive
                clickable
                showMissingBadge={false}
                onClick={() => onOpenFilm(f)}
              />
            ))}
          </div>
        ) : (
          <div className="empty">No data for this year.</div>
        )}
      </section>
      )}

      {!only && (
      <section style={{ marginTop: 28 }}>
        <h2>Acclaimed, not watched yet ({acclaimedUnwatched.length})</h2>
        <p className="oscars-intro">In your archive with IMDb ≥ 7.8 or Letterboxd ≥ 3.9 — still unwatched.</p>
        {acclaimedUnwatched.length ? <PosterGrid films={acclaimedUnwatched} onOpenFilm={onOpenFilm} mediaMap={mediaMap} /> : <div className="empty">You've seen them all.</div>}
      </section>
      )}

      {show('tags') && (
      <section style={{ marginTop: 28 }}>
        <h2>Cult, experimental &amp; movements</h2>
        <p className="oscars-intro">Tagged automatically from TMDB keywords, plus movement guesses from director, country and year. Fills in over the next few weeks.</p>
        <div className="row row-wrap" style={{ gap: 6, margin: '8px 0 14px' }}>
          {byTag.map(([tag, list]) => (
            <button key={tag} className={`btn ${tag === shownTag ? 'btn-primary' : ''}`} onClick={() => { setActiveTag(tag); setTagPage(1) }}>
              {TAG_LABELS[tag] || tag} ({list.length})
            </button>
          ))}
        </div>
        <input
          className="input discover-search"
          placeholder={`Search in ${TAG_LABELS[shownTag] || 'this list'}… (title, director, year)`}
          value={tagQuery}
          onChange={(e) => { setTagQuery(e.target.value); setTagPage(1) }}
        />
        {shownFilms.length ? (
          <>
            <PosterGrid films={shownFilms.slice((tagPage - 1) * PAGE, tagPage * PAGE)} onOpenFilm={onOpenFilm} mediaMap={mediaMap} />
            {shownFilms.length > PAGE && (
              <div className="discover-pager">
                <button className="btn" disabled={tagPage <= 1} onClick={() => setTagPage((p) => p - 1)}>← Prev</button>
                <span>
                  Page {tagPage} / {Math.ceil(shownFilms.length / PAGE)}
                </span>
                <button className="btn" disabled={tagPage >= Math.ceil(shownFilms.length / PAGE)} onClick={() => setTagPage((p) => p + 1)}>Next →</button>
              </div>
            )}
          </>
        ) : (
          <div className="empty">{tq ? 'No matches.' : 'No tagged films yet.'}</div>
        )}
      </section>
      )}

      {!only && (
      <section style={{ marginTop: 28 }}>
        <div className="discover-head">
          <h2>Year check</h2>
          <button className="btn btn-primary" onClick={() => setScanOn(true)}>
            Scan for wrong years
          </button>
          {yearMismatches.length > 0 && (
            <button className="btn" onClick={exportYearCheck}>
              Download Excel
            </button>
          )}
        </div>
        <p className="oscars-intro">
          Same title and director, different year. <span className="year-ok-text">Green</span> = correct year (from TMDB),{' '}
          <span className="year-bad-text">red</span> = wrong.
          {yearMismatches.length > 0 && ` Checked ${resolvedCount} of ${yearMismatches.length}.`}
        </p>
        {scanOn && yearMismatches.length === 0 && <div className="empty">No mismatches found.</div>}
        {yearMismatches.map((group) => (
          <div key={group[0].id} className="discover-mismatch">
            <strong>{group[0].title}</strong>
            {group.map((f) => {
              const right = rightYears[group[0].id]
              const shownYear = fixedYears[f.id] ?? f.year
              const state = typeof right === 'number' ? (Number(shownYear) === right ? ' is-right' : ' is-wrong') : ''
              return (
                <span key={f.id} className="discover-mismatch-cell">
                  <button type="button" className={`discover-mismatch-item${state}`} onClick={() => onOpenFilm(f)}>
                    {shownYear || '—'} · {f.mediaType === 'digital' ? 'Digital' : 'Blu-ray'}
                    {f.director ? ` · ${f.director}` : ''}
                  </button>
                  {state === ' is-wrong' && (
                    <button type="button" className="discover-fix-btn" disabled={fixing === f.id} onClick={() => fixYear(f, right)}>
                      {fixing === f.id ? '…' : `Fix → ${right}`}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        ))}
      </section>
      )}
    </div>
  )
}
