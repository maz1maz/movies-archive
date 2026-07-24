import { IconFilm, IconPin, IconStar, IconEdit } from './icons.jsx'

export default function FilmList({ films, onSelect, onEdit }) {
  return (
    <div className="list">
      {films.map((f) => (
        <div
          className="list-row"
          key={f.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(f)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelect(f)
          }}
        >
          <div className="list-thumb">
            {f.poster ? (
              <img
                src={f.poster}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span className="list-thumb-fallback">
                <IconFilm width={16} height={16} />
              </span>
            )}
          </div>

          <div className="list-left">
            <div className="list-line1">
              <span className="list-title">{f.title}</span>
              {f.year && <span className="list-year">{f.year}</span>}
            </div>
            {f.director && (
              <div className="list-dir">
                <IconFilm width={12} height={12} /> {f.director}
              </div>
            )}
          </div>

          <div className="list-right">
            {((Array.isArray(f.genre) ? f.genre : f.genre ? [f.genre] : []).length > 0) && (
              <span className="list-genres">
                {(Array.isArray(f.genre) ? f.genre : [f.genre]).join(', ')}
              </span>
            )}
            <span className="list-loc">
              <IconPin width={11} height={11} />{' '}
              {f.mediaType === 'digital'
                ? f.driveNumber || '–'
                : `${f.shelf || '–'}-${f.row || '–'}`}
            </span>
            {typeof f.rating === 'number' && (
              <span className="tag tag-accent">
                <IconStar width={11} height={11} /> {f.rating.toFixed(1)}
              </span>
            )}
            <span className={`tag ${f.watched ? 'tag-watched' : 'tag-unwatched'}`}>
              {f.watched ? '✓ Watched' : 'Unwatched'}
            </span>
          </div>

          <button
            className="icon-btn"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(f)
            }}
          >
            <IconEdit width={14} height={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
