import { IconFilm, IconPin, IconStar, IconEdit, IconDisc, IconClapper } from './icons.jsx'
import { parseDriveNumbers, driveLabel, driveSortValue } from '../utils/driveDisplay.js'

function seriesDriveDisplay(f) {
  if (f.itemType === 'series' && Array.isArray(f.seasonDrives) && f.seasonDrives.length) {
    const set = new Set()
    f.seasonDrives.forEach((sd) => parseDriveNumbers(sd.drive).forEach((d) => set.add(d)))
    if (set.size) return [...set].sort((a, b) => driveSortValue(a) - driveSortValue(b)).map((d) => `Drive ${d}`).join(', ')
  }
  return f.driveNumber ? driveLabel(f.driveNumber) : ''
}

export default function FilmList({ films, onSelect, onEdit, hasBluray, hasDigital }) {
  return (
    <div className="list">
      {films.map((f) => (
        <div
          className={hasBluray && hasBluray(f) ? 'list-row list-row-has-bluray' : 'list-row'}
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
              {hasBluray && hasBluray(f) && (
                <span className="bluray-badge bluray-badge-list" title="Blu-ray copy also owned">
                  <IconDisc width={10} height={10} /> BLU-RAY
                </span>
              )}
              {hasDigital && hasDigital(f) && (
                <span className="digital-badge digital-badge-list" title="Digital copy also owned">
                  <IconClapper width={10} height={10} /> DIGITAL
                </span>
              )}
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
                ? seriesDriveDisplay(f) || '–'
                : `C${f.closet || '–'} R${f.row || '–'} S${f.shelf || '–'}`}
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
