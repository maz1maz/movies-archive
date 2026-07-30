import { useMemo, useState } from 'react'
import { getGenreTops } from '../data/genreTopsData.js'

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
          Curated all-time best films by genre. Click a poster or title to open it if it's already in your archive.
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
        <div className="card oscars-flat-list">
          {movies.map((m, idx) => {
            const archiveMovie = findInArchive(films, m.title)
            const inArchive = !!archiveMovie
            const clickable = inArchive
            return (
              <div
                className={`oscar-row oscar-row-flat${clickable ? ' oscar-row-clickable' : ''}`}
                key={idx}
                onClick={clickable ? () => onOpenFilm(archiveMovie) : undefined}
              >
                <div className="oscar-row-main">
                  <div className="oscar-poster">
                    {inArchive && archiveMovie.poster ? (
                      <img src={archiveMovie.poster} loading="lazy" alt="" onError={(e) => (e.currentTarget.parentElement.style.display = 'none')} />
                    ) : (
                      <span className="oscar-poster-placeholder">{idx + 1}</span>
                    )}
                  </div>
                  <div className="oscar-row-text">
                    <span className="oscar-cat-label">#{idx + 1}</span>
                    <span className="oscar-nominee-name">{m.title} ({m.year})</span>
                    <span className="oscar-film-sub">Dir. {m.director}</span>
                  </div>
                </div>
                <div className="oscar-row-actions">
                  {inArchive ? (
                    <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); onOpenFilm(archiveMovie) }}>
                      In Archive ✓
                    </button>
                  ) : (
                    <span className="oscar-not-in-archive">Not in archive</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
