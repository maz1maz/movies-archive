import { useEffect } from 'react'
import { IconClose, IconPin, IconStar } from './icons.jsx'

export default function FilmModal({ film, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!film) return null

  const formatRuntime = (min) => {
    if (!min) return null
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const castList = Array.isArray(film.cast) ? film.cast : []
  const genreText = Array.isArray(film.genre) ? film.genre.join(', ') : film.genre || ''
  const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    (film.originalTitle || film.title) + ' official trailer'
  )}`

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-clz" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        {/* Top Header Title */}
        <div className="clz-header">
          <h2 className="clz-title">{film.title}</h2>
          {film.originalTitle && film.originalTitle !== film.title && (
            <span className="clz-subtitle">({film.originalTitle})</span>
          )}
        </div>

        {/* Top Section: Poster + Main Specs & Synopsis */}
        <div className="clz-top-section">
          <div className="clz-poster-wrap">
            <img
              src={film.poster}
              alt={film.title}
              className="clz-poster-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="clz-poster-fallback">{film.title}</div>
          </div>

          <div className="clz-info-body">
            <div className="clz-meta-line">
              {film.country && <span className="clz-studio">{film.country}</span>}
              {film.year && <span className="clz-year">({film.year})</span>}
            </div>

            {film.synopsis && (
              <p className="clz-synopsis">{film.synopsis}</p>
            )}

            <div className="clz-badges-row">
              {typeof film.rating === 'number' && (
                <div className="imdb-badge" title="IMDb Rating">
                  <span className="imdb-logo">IMDb</span>
                  <span className="imdb-score">{film.rating.toFixed(1)}</span>
                </div>
              )}

              {(film.shelf || film.row) && (
                <div className="clz-location-badge" title="Physical Storage Location">
                  <IconPin width={14} height={14} />
                  <span>
                    Shelf <strong>{film.shelf || '—'}</strong> / Row <strong>{film.row || '—'}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="clz-specs-box">
              {genreText && <div className="clz-spec-item font-semibold">{genreText}</div>}
              <div className="clz-spec-item muted">
                {[
                  film.country,
                  'English',
                  'Color',
                  film.runtime ? formatRuntime(film.runtime) + ` (${film.runtime}m)` : null,
                ]
                  .filter(Boolean)
                  .join(' | ')}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 3 Columns: Cast | Crew | Trailer */}
        <div className="clz-bottom-grid">
          {/* Column 1: Cast */}
          <div className="clz-col">
            <div className="clz-col-header">
              <h3>Cast</h3>
              {castList.length > 4 && <span className="clz-view-all">View all ▾</span>}
            </div>
            <div className="clz-table">
              {castList.length === 0 ? (
                <div className="clz-empty-row">No cast info</div>
              ) : (
                castList.slice(0, 5).map((actor, idx) => (
                  <div key={idx} className="clz-table-row">
                    <div className="clz-actor-info">
                      <span className="clz-avatar">{actor[0]}</span>
                      <span className="clz-actor-name">{actor}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Crew */}
          <div className="clz-col">
            <div className="clz-col-header">
              <h3>Crew</h3>
              <span className="clz-view-all">View all ▾</span>
            </div>
            <div className="clz-table">
              {film.director && (
                <div className="clz-table-row crew-row">
                  <span className="crew-label">Director</span>
                  <span className="crew-value">{film.director}</span>
                </div>
              )}
              <div className="clz-table-row crew-row">
                <span className="crew-label">Writer</span>
                <span className="crew-value">{film.director || '—'}</span>
              </div>
              <div className="clz-table-row crew-row">
                <span className="crew-label">Country</span>
                <span className="crew-value">{film.country || '—'}</span>
              </div>
              {film.runtime && (
                <div className="clz-table-row crew-row">
                  <span className="crew-label">Runtime</span>
                  <span className="crew-value">{film.runtime} minutes</span>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Trailer */}
          <div className="clz-col">
            <div className="clz-col-header">
              <h3>Trailer</h3>
            </div>
            <a
              href={trailerSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="clz-trailer-card"
            >
              <div className="clz-trailer-thumb">
                <img src={film.poster} alt="Trailer preview" />
                <div className="clz-play-btn">
                  <span>▶</span>
                </div>
                <div className="clz-trailer-label">FEATURETTE HD</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
