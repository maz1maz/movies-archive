import { useEffect } from 'react'
import { IconClose } from './icons.jsx'

export default function PersonModal({ personName, allFilms, onSelectFilm, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!personName) return null

  const target = personName.trim().toLowerCase()

  // Filter matching films where personName appears in director, cast, writer, musician, producer, etc.
  const matchingFilms = allFilms.filter((f) => {
    if ((f.director || '').toLowerCase().includes(target)) return true
    if ((f.writer || '').toLowerCase().includes(target)) return true
    if ((f.producer || '').toLowerCase().includes(target)) return true
    if ((f.musician || f.composer || '').toLowerCase().includes(target)) return true

    const castList = Array.isArray(f.cast) ? f.cast : []
    return castList.some((actor) => {
      const name = typeof actor === 'object' ? actor.name : actor
      return (name || '').toLowerCase().includes(target)
    })
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-person" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        <div className="person-header">
          <div className="person-avatar-circle">
            {personName[0]?.toUpperCase() || '👤'}
          </div>
          <div>
            <h2 className="person-title">{personName}</h2>
            <p className="person-subtitle">
              Found <strong>{matchingFilms.length}</strong> film(s) in your archive
            </p>
          </div>
        </div>

        <div className="person-films-grid">
          {matchingFilms.length === 0 ? (
            <div className="person-empty">No other films found for {personName}</div>
          ) : (
            matchingFilms.map((film) => (
              <button
                key={film.id}
                className="person-film-card"
                onClick={() => {
                  onSelectFilm(film)
                }}
              >
                <div className="person-film-poster">
                  <img
                    src={film.poster}
                    alt={film.title}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <div className="person-poster-fallback">{film.title}</div>
                  {(film.shelf || film.row) && (
                    <span className="person-location-badge">
                      📍 {film.shelf || '—'} / {film.row || '—'}
                    </span>
                  )}
                </div>
                <div className="person-film-meta">
                  <h4 className="person-film-title">{film.title}</h4>
                  <p className="person-film-year">
                    {film.year || '—'} · {(film.genre || []).slice(0, 2).join(', ')}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
