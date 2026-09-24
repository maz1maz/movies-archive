import { useMemo, useState } from 'react'
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

export default function CountriesMapPanel({ films, onOpenFilm }) {
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null) // alpha2 در حال نمایش جزئیات

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
        <p className="oscars-intro">
          {rankedCountries.length} کشور در آرشیو — روی هر کشور کلیک کن تا فیلم‌هاش رو ببینی.
        </p>
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
          </svg>
        </div>
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
