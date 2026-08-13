import { IconStar, IconPin, IconDisc, IconClapper } from './icons.jsx'
import StarRating from './StarRating.jsx'

// پالت رنگی برای کارت‌هایی که پوستر ندارن
const PALETTE = [
  ['#3a2f5b', '#1f1830'],
  ['#5b3a3a', '#301f1f'],
  ['#2f5b4f', '#183026'],
  ['#5b4f2f', '#302618'],
  ['#2f3f5b', '#182330'],
  ['#4f2f5b', '#261830'],
]

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export default function FilmCard({ film, onSelect, onToggleWatch, hasBluray, hasDigital }) {
  const [c1, c2] = PALETTE[hashCode(String(film.id)) % PALETTE.length]
  // چرخش ملایم و ثابت (بر اساس id) برای حس آلبوم عکس/پولاروید تو گرید پوسترها
  const tiltDeg = (hashCode(String(film.id) + 'tilt') % 7) - 3
  const isDigital = film.mediaType === 'digital'
  const hasLocation = isDigital ? film.driveNumber : film.closet || film.shelf || film.row

  // چرخه‌ی وضعیت تماشا با کلیک روی بج: ندیده → واچ‌لیست‌شده (زرد) →
  // دیده‌شده (سبز) → دوباره ندیده
  const status = film.watched ? 'watched' : film.watchlisted ? 'watchlisted' : 'unwatched'
  const statusLabel = status === 'watched' ? '✓ Watched' : status === 'watchlisted' ? '☆ Watchlisted' : 'Unwatched'
  const handleBadgeClick = (e) => {
    e.stopPropagation()
    if (!onToggleWatch) return
    if (status === 'unwatched') onToggleWatch(film, { watchlisted: true, watched: false })
    else if (status === 'watchlisted') onToggleWatch(film, { watchlisted: false, watched: true })
    else onToggleWatch(film, { watchlisted: false, watched: false })
  }

  return (
    <button
      type="button"
      className={[
        'card',
        film.criterion && 'card-criterion',
        hasBluray && 'card-has-bluray',
        hasDigital && 'card-has-digital',
      ].filter(Boolean).join(' ')}
      style={{ '--tilt': `${tiltDeg}deg` }}
      data-film-id={film.id}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(film)
      }}
    >
      <div
        className="poster"
        style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}
      >
        <img
          src={film.poster}
          alt={film.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        {typeof film.rating === 'number' && (
          <span className="rating-badge">
            <IconStar width={11} height={11} /> {film.rating.toFixed(1)}
          </span>
        )}
        <span
          className={`watched-badge ${status}`}
          onClick={handleBadgeClick}
          title="Click to change watch status"
        >
          {statusLabel}
        </span>
        {hasLocation && (
          <div className="poster-badge-stack poster-badge-stack-right">
            <span className="location-badge">
              <IconPin width={11} height={11} />{' '}
              {isDigital ? film.driveNumber : `C${film.closet || '–'} R${film.row || '–'} S${film.shelf || '–'}`}
            </span>
            {hasDigital && (
              <span className="digital-badge" title="Digital copy also owned">
                <IconClapper width={11} height={11} /> DIGITAL
              </span>
            )}
          </div>
        )}
        {!hasLocation && hasDigital && (
          <div className="poster-badge-stack poster-badge-stack-right">
            <span className="digital-badge" title="Digital copy also owned">
              <IconClapper width={11} height={11} /> DIGITAL
            </span>
          </div>
        )}
        {(film.criterion || hasBluray) && (
          <div className="poster-badge-stack poster-badge-stack-left">
            {film.criterion && (
              <span className="criterion-badge">
                CRITERION{film.criterionCopies > 1 ? ` ×${film.criterionCopies}` : ''}
              </span>
            )}
            {hasBluray && (
              <span className="bluray-badge" title="Blu-ray copy also owned">
                <IconDisc width={11} height={11} /> BLU-RAY
              </span>
            )}
          </div>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">
          {film.title}
          {film.copies > 1 && <span className="copies-badge">×{film.copies}</span>}
        </h3>
        <p className="card-meta">
          {film.year || '—'} · {(Array.isArray(film.genre) ? film.genre : (film.genre || '').split(',').map(g => g.trim()).filter(Boolean)).slice(0, 2).join(', ')}
        </p>
        {film.myRating > 0 && <StarRating value={film.myRating} size={13} />}
      </div>
    </button>
  )
}
