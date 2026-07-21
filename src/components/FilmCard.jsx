import { IconStar, IconPin } from './icons.jsx'

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

export default function FilmCard({ film, onSelect }) {
  const [c1, c2] = PALETTE[hashCode(String(film.id)) % PALETTE.length]
  const hasLocation = film.shelf || film.row

  return (
    <button
      type="button"
      className="card"
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
        <span className="poster-fallback">{film.title}</span>
        {typeof film.rating === 'number' && (
          <span className="rating-badge">
            <IconStar width={11} height={11} /> {film.rating.toFixed(1)}
          </span>
        )}
        <span className="watched-badge">{film.watched ? '✓ Watched' : 'Unwatched'}</span>
        {hasLocation && (
          <span className="location-badge">
            <IconPin width={11} height={11} /> {film.shelf || '–'}-{film.row || '–'}
          </span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{film.title}</h3>
        <p className="card-meta">
          {film.year || '—'} · {(film.genre || []).slice(0, 2).join('، ')}
        </p>
      </div>
    </button>
  )
}
