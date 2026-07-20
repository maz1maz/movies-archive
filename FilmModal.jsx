import { useEffect } from 'react'
import { IconClose, IconStar, IconPin } from './icons.jsx'

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

  const hasLocation = film.shelf || film.row

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose width={15} height={15} />
        </button>

        <div className="modal-poster">
          <img
            src={film.poster}
            alt={film.title}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>

        <div className="modal-info">
          <h2 className="modal-title">{film.title}</h2>
          {film.originalTitle && (
            <p className="modal-original">{film.originalTitle}</p>
          )}

          <div className="modal-tags">
            {film.year && <span className="tag">{film.year}</span>}
            {typeof film.rating === 'number' && (
              <span className="tag tag-accent">
                <IconStar width={12} height={12} /> {film.rating.toFixed(1)}
              </span>
            )}
            {film.runtime && <span className="tag">{film.runtime} min</span>}
            {film.country && <span className="tag">{film.country}</span>}
          </div>

          {film.genre?.length > 0 && (
            <div className="modal-genres">
              {film.genre.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
            </div>
          )}

          {hasLocation && (
            <div className="location-box">
              <span className="location-icon">
                <IconPin width={15} height={15} />
              </span>
              <div>
                <div className="location-label">Physical location</div>
                <div className="location-value">
                  Shelf <strong>{film.shelf || '—'}</strong> · Row{' '}
                  <strong>{film.row || '—'}</strong>
                </div>
              </div>
            </div>
          )}

          {film.director && (
            <p className="modal-line">
              <span className="modal-line-label">Director:</span> {film.director}
            </p>
          )}

          {film.cast?.length > 0 && (
            <div className="modal-cast">
              <div className="modal-line-label">Main cast:</div>
              <div className="cast-list">
                {film.cast.map((name, i) => (
                  <span key={i} className="cast-pill">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {film.synopsis && (
            <p className="modal-synopsis">{film.synopsis}</p>
          )}
        </div>
      </div>
    </div>
  )
}
