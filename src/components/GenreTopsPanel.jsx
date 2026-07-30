import { useMemo, useState } from 'react'
import { getGenreTops } from '../data/genreTopsData.js'
import DashboardPosterCard from './DashboardPosterCard.jsx'

const GENRE_TOPS_DATA = getGenreTops()
const GENRE_KEYS = Object.keys(GENRE_TOPS_DATA)

function findInArchive(films, title) {
  const t = (title || '').trim().toLowerCase()
  if (!t) return null
  return films.find((f) => (f.title || '').trim().toLowerCase() === t) || null
}

export default function GenreTopsPanel({ films, onOpenFilm }) {
  const [genre, setGenre] = useState(GENRE_KEYS[0])

  const movies = useMemo(() => GENRE_TOPS_DATA[genre]?.movies || [], [genre])

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          Curated all-time best films by genre. Click a poster to open it if it's already in your archive.
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field">
            <label>Genre</label>
            <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
              {GENRE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section>
        <h2>Best of {genre}</h2>
        <div className="grid">
          {movies.map((m, idx) => {
            const archiveMovie = findInArchive(films, m.title)
            const inArchive = !!archiveMovie
            return (
              <DashboardPosterCard
                key={idx}
                title={`${m.title} (${m.year})`}
                subtitle={`Dir. ${m.director}`}
                poster={inArchive ? archiveMovie.poster : null}
                badgeText={`#${idx + 1}`}
                badgeVariant="rank"
                inArchive={inArchive}
                onClick={() => onOpenFilm(archiveMovie)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
