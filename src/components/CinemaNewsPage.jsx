import { useEffect, useState } from 'react'
import { IconCake, IconClapperPlay, IconNewspaper, IconSun, IconMoon } from './icons.jsx'

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

// صفحه‌ی «اخبار سینما» — چهار بخش موازی از /api/cinema-news: تیترهای مهم
// (انگلیسی + فارسی، با تب جدا)، تولدهای امروزِ اهالی کالکشن، فیلم/سریال‌های
// در راه‌شون، و تریلرهای تازه‌ی هالیوود. همه‌چیز سمت سرور کش می‌شه.
export default function CinemaNewsPage({ onBack, onSelectPerson, theme, setTheme }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState('en')

  useEffect(() => {
    let cancelled = false
    fetch('/api/cinema-news')
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ birthdays: [], upcoming: [], trailers: [], headlines: [], headlinesFa: [] }))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const birthdays = data?.birthdays || []
  const upcoming = data?.upcoming || []
  const trailers = data?.trailers || []
  const headlinesEn = data?.headlines || []
  const headlinesFa = data?.headlinesFa || []
  const headlines = lang === 'fa' ? headlinesFa : headlinesEn
  const nothingFound =
    !loading && !birthdays.length && !upcoming.length && !trailers.length && !headlinesEn.length && !headlinesFa.length

  return (
    <div className="dashboard-panel cinema-news-page">
      <div className="container">
        <div className="dashboard-topbar">
          <button className="btn btn-ghost folder-back" onClick={onBack}>
            ← Back
          </button>
          {setTheme && (
            <button
              className="btn btn-ghost theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle dark / light"
            >
              {theme === 'dark' ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
            </button>
          )}
        </div>
        <p className="dashboard-eyebrow">Now showing</p>
        <h1 className="dashboard-title">
          <IconNewspaper width={28} height={28} style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} />
          Cinema News
        </h1>
        <p className="person-subtitle" style={{ marginBottom: 20 }}>
          Birthdays, what's coming, and new trailers — built from your own collection
        </p>

        {loading && <p className="person-extras-loading">Loading cinema news…</p>}

        {nothingFound && (
          <p className="person-subtitle" style={{ marginTop: 12 }}>
            Nothing to show yet — birthdays fill in as you open actor/director pages, and TMDB keys are needed for
            upcoming titles &amp; trailers.
          </p>
        )}

        {(headlinesEn.length > 0 || headlinesFa.length > 0) && (
          <div className="cinema-news-section cinema-news-section-first">
            <div className="cinema-news-headline-header">
              <h4 className="person-extras-title" style={{ margin: 0 }}>
                <IconNewspaper width={15} height={15} /> Top headlines
              </h4>
              <div className="cinema-news-lang-toggle">
                <button
                  type="button"
                  className={lang === 'en' ? 'active' : ''}
                  onClick={() => setLang('en')}
                  disabled={!headlinesEn.length}
                >
                  English
                </button>
                <button
                  type="button"
                  className={lang === 'fa' ? 'active' : ''}
                  onClick={() => setLang('fa')}
                  disabled={!headlinesFa.length}
                >
                  فارسی
                </button>
              </div>
            </div>
            <ul className={lang === 'fa' ? 'cinema-news-headline-list cinema-news-headline-list-rtl' : 'cinema-news-headline-list'}>
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

        <div className="cinema-news-columns">
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
        </div>

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
