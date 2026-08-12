import { useEffect, useState } from 'react'
import { IconClose, IconCake, IconClapperPlay, IconNewspaper } from './icons.jsx'

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function timeAgo(pubDate) {
  if (!pubDate) return ''
  const then = new Date(pubDate).getTime()
  if (Number.isNaN(then)) return ''
  const diffH = Math.max(1, Math.round((Date.now() - then) / 3600000))
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.round(diffH / 24)}d ago`
}

// بخش «اخبار سینما» — سه بخش موازی از /api/cinema-news: تولدهای امروزِ اهالی
// کالکشن، فیلم/سریال‌های در راه‌شون، و تریلرهای تازه‌ی هالیوود. همه‌چیز سمت
// سرور کش می‌شه، اینجا فقط نمایشه.
export default function CinemaNewsModal({ onClose, onSelectPerson, onSelectFilmTitle }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    fetch('/api/cinema-news')
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ birthdays: [], upcoming: [], trailers: [] }))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const birthdays = data?.birthdays || []
  const upcoming = data?.upcoming || []
  const trailers = data?.trailers || []
  const headlines = data?.headlines || []
  const nothingFound = !loading && !birthdays.length && !upcoming.length && !trailers.length && !headlines.length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-person modal-cinema-news" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        <div className="cinema-news-header">
          <span className="cinema-news-header-icon">
            <IconNewspaper width={26} height={26} />
          </span>
          <div>
            <h2 className="person-title" style={{ marginBottom: 2 }}>
              Cinema News
            </h2>
            <p className="person-subtitle">Birthdays, what's coming, and new trailers — built from your own collection</p>
          </div>
        </div>

        {loading && <p className="person-extras-loading">Loading cinema news…</p>}

        {nothingFound && (
          <p className="person-subtitle" style={{ marginTop: 12 }}>
            Nothing to show yet — birthdays fill in as you open actor/director pages, and TMDB keys are needed for
            upcoming titles &amp; trailers.
          </p>
        )}

        {headlines.length > 0 && (
          <div className="cinema-news-section">
            <h4 className="person-extras-title">
              <IconNewspaper width={15} height={15} /> Top headlines
            </h4>
            <ul className="cinema-news-headline-list">
              {headlines.map((h) => (
                <li key={h.link}>
                  <a href={h.link} target="_blank" rel="noopener noreferrer" className="cinema-news-headline-link">
                    {h.title}
                  </a>
                  <span className="cinema-news-headline-meta">
                    {h.source} · {timeAgo(h.pubDate)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {birthdays.length > 0 && (
          <div className="cinema-news-section">
            <h4 className="person-extras-title">
              <IconCake width={15} height={15} /> Birthdays today
            </h4>
            <div className="cinema-news-birthday-grid">
              {birthdays.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className="cinema-news-birthday-card"
                  onClick={() => onSelectPerson(b.name)}
                >
                  <span className="person-avatar-circle cinema-news-birthday-avatar">
                    {b.photo ? <img src={b.photo} alt={b.name} className="person-avatar-photo" /> : b.name[0]?.toUpperCase()}
                  </span>
                  <span className="cinema-news-birthday-info">
                    <span className="cinema-news-birthday-name">
                      {b.name} {b.age != null ? <span className="person-recommendation-year">({b.age})</span> : null}
                    </span>
                    <span className="cinema-news-birthday-films">{b.films.join(', ')}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="cinema-news-section">
            <h4 className="person-extras-title">
              <IconClapperPlay width={15} height={15} /> Coming soon from your collection
            </h4>
            <ul className="person-recommendations-list">
              {upcoming.map((u) => (
                <li key={`${u.title}-${u.releaseDate}`} className="person-recommendation-item">
                  {u.poster && <img src={u.poster} alt={u.title} className="person-recommendation-poster" />}
                  <span className="person-recommendation-info">
                    <span className="person-recommendation-title">{u.title}</span>
                    <span className="person-recommendation-ratings">
                      <span className="badge-imdb">{formatDate(u.releaseDate)}</span>
                      <button
                        type="button"
                        className="cinema-news-person-link"
                        onClick={() => onSelectPerson(u.personName)}
                      >
                        {u.role ? `${u.role} · ` : ''}
                        {u.personName}
                      </button>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {trailers.length > 0 && (
          <div className="cinema-news-section">
            <h4 className="person-extras-title">New trailers</h4>
            <div className="cinema-news-trailer-grid">
              {trailers.map((t) => (
                <a
                  key={t.title}
                  className="cinema-news-trailer-card"
                  href={`https://www.youtube.com/watch?v=${t.youtubeKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.poster && <img src={t.poster} alt={t.title} className="cinema-news-trailer-poster" />}
                  <span className="cinema-news-trailer-play">▶</span>
                  <span className="cinema-news-trailer-title">{t.title}</span>
                  <span className="cinema-news-trailer-date">{formatDate(t.releaseDate)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
