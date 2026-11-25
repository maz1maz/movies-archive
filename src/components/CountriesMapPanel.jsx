import { useMemo, useState, useCallback } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldTopo from 'world-atlas/countries-110m.json'
import { aggregateFilmsByCountry } from '../utils/countryGeo.js'
import DashboardPosterCard from './DashboardPosterCard.jsx'

const WIDTH = 960
const HEIGHT = 500

const worldGeo = feature(worldTopo, worldTopo.objects.countries)
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], worldGeo)
const pathGenerator = geoPath(projection)

// بلوری و دیجیتالِ یه فیلم یک بار شمرده بشه
const sameFilm = (a, b) => (a.imdbId && a.imdbId === b.imdbId) || a.id === b.id

// نقطه‌ی هر مکان؛ فیلم‌های هم‌مکان زیر یک نقطه جمع می‌شن. دو منبع از Wikidata:
// مکان فیلم‌برداری (P915 → shootingCoords) و محل داستان (P840 → wikidata.setIn)،
// هر دو با مختصات P625؛ مکانِ بی‌مختصات نمایش داده نمی‌شه.
function buildPlaces(films, pick) {
  const map = new Map()
  for (const film of films) {
    const list = pick(film)
    if (!Array.isArray(list)) continue
    for (const c of list) {
      if (typeof c.lat !== 'number' || typeof c.lon !== 'number') continue
      const key = `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`
      const entry = map.get(key) || { key, label: c.label, lat: c.lat, lon: c.lon, films: [] }
      if (!entry.films.some((f) => sameFilm(f, film))) entry.films.push(film)
      map.set(key, entry)
    }
  }
  return map
}

export default function CountriesMapPanel({ films, onOpenFilm, onFilmsChanged }) {
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null) // alpha2 در حال نمایش جزئیات
  const [mode, setMode] = useState('countries') // countries | locations | setin
  const [pin, setPin] = useState(null) // لوکیشن انتخاب‌شده روی نقشه
  const [fill, setFill] = useState({ running: false, remaining: null })

  // نقطه‌ی هر مکان؛ فیلم‌های هم‌مکان زیر یک نقطه جمع می‌شن. دو منبع از Wikidata:
  // locations = مکان فیلم‌برداری (P915)، setin = محل داستان (P840). هر دو با
  // مختصات P625؛ پوشش ناقصه و مکانِ بی‌مختصات نمایش داده نمی‌شه.
  const filmedPlaces = useMemo(() => buildPlaces(films, (f) => f.shootingCoords), [films])
  const setInPlaces = useMemo(() => buildPlaces(films, (f) => f.wikidata?.setIn), [films])
  const locations = useMemo(() => {
    const map = mode === 'setin' ? setInPlaces : filmedPlaces
    return [...map.values()].sort((a, b) => b.films.length - a.films.length)
  }, [mode, filmedPlaces, setInPlaces])

  // با کلیک روی یه نقطه، هر دو فهرست همون مکان کنار هم: «داستانش اینجاست»
  // و «اینجا فیلم‌برداری شده». تطبیق با مختصات گردشده یا اسم یکسان.
  const pinLists = useMemo(() => {
    if (!pin) return null
    const collect = (map) => {
      const out = []
      for (const entry of map.values()) {
        if (entry.key !== pin.key && entry.label !== pin.label) continue
        for (const f of entry.films) if (!out.some((x) => sameFilm(x, f))) out.push(f)
      }
      return out
    }
    return { setHere: collect(setInPlaces), filmedHere: collect(filmedPlaces) }
  }, [pin, filmedPlaces, setInPlaces])

  const fillCoords = useCallback(async () => {
    setFill({ running: true, remaining: null })
    let last = Infinity
    for (let i = 0; i < 200; i++) {
      try {
        const res = await fetch('/api/films/wikidata?limit=8', { method: 'POST' })
        if (!res.ok) break
        const data = await res.json()
        setFill({ running: true, remaining: data.remaining })
        // هر چند دسته یه بار لیست فیلم‌ها رو تازه می‌کنیم تا نقطه‌ها کم‌کم بیان
        if (i % 5 === 4) onFilmsChanged?.()
        if (!data.processed || data.remaining >= last) break
        last = data.remaining
      } catch {
        break
      }
    }
    setFill((f) => ({ ...f, running: false }))
    onFilmsChanged?.()
  }, [onFilmsChanged])

  const byAlpha2 = useMemo(() => aggregateFilmsByCountry(films), [films])

  const byNumericId = useMemo(() => {
    const map = new Map()
    for (const entry of byAlpha2.values()) {
      if (entry.numericId) map.set(entry.numericId, entry)
    }
    return map
  }, [byAlpha2])

  const maxCount = useMemo(() => {
    let max = 0
    for (const entry of byAlpha2.values()) max = Math.max(max, entry.count)
    return max
  }, [byAlpha2])

  const rankedCountries = useMemo(
    () => [...byAlpha2.values()].sort((a, b) => b.count - a.count),
    [byAlpha2]
  )

  const opacityForCount = (count) => {
    if (!count || !maxCount) return 0
    // مقیاس لگاریتمی چون آمریکا/انگلیس معمولاً چند برابر بقیه‌ی کشورها فیلم
    // دارن؛ با مقیاس خطی تقریباً همه‌جا به‌جز چندتا کشور کم‌رنگ می‌موند.
    const value = Math.log1p(count) / Math.log1p(maxCount)
    return 0.18 + value * 0.82
  }

  const selectedEntry = selected ? byAlpha2.get(selected) : null

  if (selectedEntry) {
    return (
      <div className="oscars-panel">
        <div className="card oscars-controls">
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            ← Back to map
          </button>
        </div>
        <section>
          <h2>
            {selectedEntry.name} — {selectedEntry.count} film{selectedEntry.count === 1 ? '' : 's'}
          </h2>
          <div className="grid">
            {selectedEntry.films.map((film) => (
              <DashboardPosterCard
                key={film.id}
                title={film.title}
                subtitle={film.year ? String(film.year) : ''}
                poster={film.poster}
                inArchive
                clickable
                showMissingBadge={false}
                onClick={() => onOpenFilm(film)}
              />
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro" dir="rtl">
          {mode === 'countries'
            ? `${rankedCountries.length} کشور در آرشیو — روی هر کشور کلیک کن تا فیلم‌هاش رو ببینی.`
            : `${locations.length} ${mode === 'setin' ? 'محل داستان' : 'مکان فیلم‌برداری'} (از Wikidata) — روی هر نقطه کلیک کن.`}
        </p>
        <div className="countries-map-modes">
          <button className={`btn ${mode === 'countries' ? '' : 'btn-ghost'}`} onClick={() => setMode('countries')}>
            Countries
          </button>
          <button className={`btn ${mode === 'locations' ? '' : 'btn-ghost'}`} onClick={() => { setMode('locations'); setPin(null) }}>
            Filming locations
          </button>
          <button className={`btn ${mode === 'setin' ? '' : 'btn-ghost'}`} onClick={() => { setMode('setin'); setPin(null) }}>
            Set in
          </button>
          {mode !== 'countries' && (
            <button className="btn btn-ghost" onClick={fillCoords} disabled={fill.running}>
              {fill.running ? `در حال پر کردن… ${fill.remaining ?? ''}` : 'پر کردن از Wikidata'}
            </button>
          )}
        </div>
      </div>
      <section>
        <div className="countries-map-wrap">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="countries-map-svg" role="img">
            {worldGeo.features.map((f) => {
              // چند تا فیچر (N. Cyprus, Somaliland, Kosovo) توی world-atlas
              // آی‌دی عددی ISO ندارن؛ برای key و hover از اسمشون به‌عنوان
              // fallback استفاده می‌کنیم تا با هم قاطی نشن.
              const featureKey = f.id || f.properties.name
              const entry = byNumericId.get(f.id)
              const count = entry ? entry.count : 0
              return (
                <path
                  key={featureKey}
                  d={pathGenerator(f)}
                  className={`countries-map-country${entry ? ' has-films' : ''}${hovered === featureKey ? ' hovered' : ''}`}
                  style={entry ? { fillOpacity: opacityForCount(count) } : undefined}
                  onMouseEnter={() => setHovered(featureKey)}
                  onMouseLeave={() => setHovered((h) => (h === featureKey ? null : h))}
                  onClick={() => entry && setSelected(entry.alpha2)}
                >
                  <title>{entry ? `${entry.name} — ${count} film${count === 1 ? '' : 's'}` : f.properties.name}</title>
                </path>
              )
            })}
            {mode !== 'countries' &&
              locations.map((loc) => {
                const pt = projection([loc.lon, loc.lat])
                if (!pt) return null
                return (
                  <circle
                    key={loc.key}
                    cx={pt[0]}
                    cy={pt[1]}
                    r={Math.min(3 + Math.sqrt(loc.films.length) * 1.5, 12)}
                    className={`countries-map-pin${mode === 'setin' ? ' setin' : ''}${pin?.key === loc.key ? ' active' : ''}`}
                    onClick={() => setPin(loc)}
                  >
                    <title>{`${loc.label} — ${loc.films.length}`}</title>
                  </circle>
                )
              })}
          </svg>
        </div>
        {mode !== 'countries' && pin && pinLists && (
          <>
            <h2>{pin.label}</h2>
            {[
              ['setHere', 'Set here'], // داستانش اینجاست
              ['filmedHere', 'Filmed here'], // اینجا فیلم‌برداری شده
            ].map(([key, en]) => (
              <section key={key} className="pin-list">
                <h3 className="pin-list-title">
                  {en} — {pinLists[key].length}
                </h3>
                {pinLists[key].length === 0 ? (
                  <p className="oscars-intro">—</p>
                ) : (
                  <div className="grid">
                    {pinLists[key].map((film) => (
                      <DashboardPosterCard
                        key={film.id}
                        title={film.title}
                        subtitle={film.year ? String(film.year) : ''}
                        poster={film.poster}
                        inArchive
                        clickable
                        showMissingBadge={false}
                        onClick={() => onOpenFilm(film)}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </>
        )}
        {mode !== 'countries' && locations.length === 0 && (
          <p className="oscars-intro" dir="rtl">هنوز مکانی ثبت نشده؛ «پر کردن از Wikidata» رو بزن. پوشش Wikidata ناقصه.</p>
        )}
        <div className="countries-map-legend">
          <span>کم</span>
          <span className="countries-map-legend-bar" />
          <span>زیاد</span>
        </div>
        <h2>پرتکرارترین کشورها</h2>
        <div className="countries-list-grid">
          {rankedCountries.slice(0, 24).map((entry) => (
            <button key={entry.alpha2} className="countries-list-item" onClick={() => setSelected(entry.alpha2)}>
              <span className="countries-list-name">{entry.name}</span>
              <span className="countries-list-count">{entry.count}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
