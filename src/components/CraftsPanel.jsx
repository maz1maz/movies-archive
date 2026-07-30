import { useMemo, useState } from 'react'
import { getCraftTops } from '../data/craftTopsData.js'
import DashboardPosterCard from './DashboardPosterCard.jsx'

const CRAFT_TOPS_DATA = getCraftTops()
const CRAFT_KEYS = Object.keys(CRAFT_TOPS_DATA)

function findInArchive(films, title) {
  const t = (title || '').trim().toLowerCase()
  if (!t) return null
  return films.find((f) => (f.title || '').trim().toLowerCase() === t) || null
}

export default function CraftsPanel({ films, onOpenFilm }) {
  const [craft, setCraft] = useState(CRAFT_KEYS[0])

  const movies = useMemo(() => CRAFT_TOPS_DATA[craft]?.movies || [], [craft])

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          The best films for a specific craft — not tied to Oscar wins. Based on broader critical and industry consensus (Rotten Tomatoes, Metacritic, Letterboxd, IMDb and critics' picks). Year isn't a factor in the ranking.
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field">
            <label>Craft</label>
            <select className="input" value={craft} onChange={(e) => setCraft(e.target.value)}>
              {CRAFT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section>
        <h2>Best {craft}</h2>
        <div className="grid">
          {movies.map((m, idx) => {
            const archiveMovie = findInArchive(films, m.title)
            const inArchive = !!archiveMovie
            const subtitle = [m.craftPerson, m.year].filter(Boolean).join(' — ')
            return (
              <DashboardPosterCard
                key={idx}
                title={m.title}
                subtitle={subtitle}
                poster={inArchive ? archiveMovie.poster : null}
                inArchive={inArchive}
                clickable={inArchive}
                showMissingBadge={!inArchive}
                onClick={() => onOpenFilm(archiveMovie)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
