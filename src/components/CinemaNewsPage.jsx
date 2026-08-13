import { useEffect, useMemo, useState } from 'react'
import {
  IconCake,
  IconClapperPlay,
  IconNewspaper,
  IconSun,
  IconMoon,
  IconBarChart,
  IconUser,
  IconClapper,
} from './icons.jsx'

const TABS = [
  { key: 'news', label: 'News', icon: IconNewspaper },
  { key: 'people', label: 'People', icon: IconUser },
  { key: 'comingsoon', label: 'Coming Soon', icon: IconClapperPlay },
  { key: 'trending', label: 'Trending', icon: IconBarChart },
  { key: 'boxoffice', label: 'Box Office', icon: IconBarChart },
  { key: 'trailers', label: 'New Trailers', icon: IconClapper },
]

function formatUpdatedAt(sqliteDatetime) {
  if (!sqliteDatetime) return null
  try {
    const d = new Date(sqliteDatetime.replace(' ', 'T') + 'Z')
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return null
  }
}

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

// دسته‌بندی تقریبیِ هر تیتر به فیلم/سریال، فقط بر اساس چند کلیدواژه‌ی رایج
// (انگلیسی + فارسی). چون این سایت‌ها بیشتر خبر سینما می‌ذارن، پیش‌فرض «فیلم»
// هست مگر کلیدواژه‌ی سریال توش باشه — این‌طوری هیچ تیتری حذف نمی‌شه.
const SERIES_WORDS = [
  'series', 'season', 'episode', 'tv show', 'streaming series', 'renewed', 'canceled', 'cancelled', 'spinoff', 'spin-off',
  'سریال', 'فصل', 'قسمت',
]
function classifyHeadline(title) {
  const t = (title || '').toLowerCase()
  return SERIES_WORDS.some((w) => t.includes(w)) ? 'series' : 'movie'
}

// چک می‌کنه که آیا یه عنوان از قبل تو آرشیو (بلوری یا دیجیتال) هست یا نه —
// برای بج/قاب قرمزِ «تو آرشیو نیست» رو بخش‌های Coming Soon.
function titleInArchive(films, title) {
  const t = (title || '').trim().toLowerCase()
  if (!t || !Array.isArray(films)) return false
  return films.some((f) => (f.title || '').trim().toLowerCase() === t)
}

function exportMissingCsv(items, filename) {
  if (!items.length) return
  const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const header = ['Title', 'Release date', 'Person / Role']
  const rows = items.map((it) => [it.title, it.releaseDate || '', [it.role, it.personName].filter(Boolean).join(' · ')])
  const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\r\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function ExportMissingButton({ items, films, filename }) {
  const missing = items.filter((it) => !titleInArchive(films, it.title))
  return (
    <button
      type="button"
      className="btn btn-danger-outline cinema-news-export-btn"
      disabled={!missing.length}
      onClick={() => exportMissingCsv(missing, filename)}
      title="Download a CSV of titles here that aren't in your archive"
    >
      Export missing ({missing.length})
    </button>
  )
}

function HeadlineList({ items, rtl }) {
  if (!items.length) return <p className="cinema-news-headline-meta">Nothing here right now.</p>
  return (
    <ul className={rtl ? 'cinema-news-headline-list cinema-news-headline-list-rtl' : 'cinema-news-headline-list'}>
      {items.map((h) => (
        <li key={h.link}>
          <a href={h.link} target="_blank" rel="noopener noreferrer" className="cinema-news-headline-link">
            {h.title}
          </a>
          {h.titleFa && <p className="cinema-news-headline-translation">{h.titleFa}</p>}
          <span className="cinema-news-headline-meta">
            {h.source} · {timeAgo(h.pubDate)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function UpcomingList({ items, onSelectPerson, films }) {
  if (!items.length) return <p className="cinema-news-headline-meta">Nothing here right now.</p>
  return (
    <ul className="person-recommendations-list">
      {items.map((u) => {
        const missing = !titleInArchive(films, u.title)
        return (
          <li
            key={`${u.title}-${u.releaseDate}`}
            className={`person-recommendation-item cinema-news-upcoming-item${missing ? ' cinema-news-missing' : ''}`}
          >
            <a
              href={u.infoUrl || `https://www.themoviedb.org/search?query=${encodeURIComponent(u.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cinema-news-upcoming-link"
            >
              {u.poster && <img src={u.poster} alt={u.title} className="person-recommendation-poster" />}
              <span className="person-recommendation-info">
                <span className="person-recommendation-title">{u.title}</span>
                <span className="cinema-news-headline-meta">{formatDate(u.releaseDate)}</span>
              </span>
            </a>
            {u.personName && (
              <button type="button" className="cinema-news-person-link cinema-news-person-link-inline" onClick={() => onSelectPerson(u.personName)}>
                {u.role ? `${u.role} · ` : ''}
                {u.personName}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function PosterGrid({ items, films }) {
  if (!items.length) return <p className="cinema-news-headline-meta">Nothing here right now.</p>
  return (
    <div className="cinema-news-trailer-grid">
      {items.map((g) => {
        const missing = !titleInArchive(films, g.title)
        const cardClass = `cinema-news-trailer-card cinema-news-poster-card${missing ? ' cinema-news-missing' : ''}`
        return g.infoUrl ? (
          <a key={`${g.title}-${g.releaseDate}`} className={cardClass} href={g.infoUrl} target="_blank" rel="noopener noreferrer">
            {g.poster && <img src={g.poster} alt={g.title} className="cinema-news-trailer-poster" />}
            {g.rating != null && <span className="cinema-news-rating-badge">★ {g.rating}</span>}
            <span className="cinema-news-trailer-title">{g.title}</span>
            <span className="cinema-news-trailer-date">{formatDate(g.releaseDate)}</span>
          </a>
        ) : (
          <div key={`${g.title}-${g.releaseDate}`} className={cardClass}>
            {g.poster && <img src={g.poster} alt={g.title} className="cinema-news-trailer-poster" />}
            {g.rating != null && <span className="cinema-news-rating-badge">★ {g.rating}</span>}
            <span className="cinema-news-trailer-title">{g.title}</span>
            <span className="cinema-news-trailer-date">{formatDate(g.releaseDate)}</span>
          </div>
        )
      })}
    </div>
  )
}

function formatMoney(n) {
  if (!n) return null
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n}`
}

function BoxOfficeChart({ items }) {
  if (!items.length) return null
  const max = Math.max(...items.map((m) => m.revenue || 0))
  return (
    <div className="stats-bars cinema-news-boxoffice-chart">
      {items.map((m) => {
        const pct = max ? Math.round(((m.revenue || 0) / max) * 100) : 0
        return (
          <div key={m.title} className="stats-bar-item">
            <div className="stats-bar-meta">
              <span className="stats-bar-name">{m.title}</span>
              <span className="stats-bar-val">{formatMoney(m.revenue)}</span>
            </div>
            <div className="stats-bar-track">
              <div className="stats-bar-fill cinema-news-boxoffice-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BoxOfficeTable({ items }) {
  if (!items.length) return <p className="cinema-news-headline-meta">Nothing here right now.</p>
  return (
    <ol className="cinema-news-boxoffice-list">
      {items.map((m, i) => (
        <li key={m.title} className="cinema-news-boxoffice-row">
          <span className="cinema-news-boxoffice-rank">{i + 1}</span>
          {m.poster && <img src={m.poster} alt={m.title} className="cinema-news-boxoffice-poster" />}
          <a href={m.infoUrl} target="_blank" rel="noopener noreferrer" className="cinema-news-boxoffice-title">
            {m.title}
          </a>
          <span className="cinema-news-boxoffice-revenue">{formatMoney(m.revenue)}</span>
        </li>
      ))}
    </ol>
  )
}

function PeopleGrid({ items, subtitleKey }) {
  if (!items.length) return <p className="cinema-news-headline-meta">Nothing here right now.</p>
  return (
    <div className="cinema-news-birthday-grid">
      {items.map((p) =>
        p.infoUrl ? (
          <a key={p.name} href={p.infoUrl} target="_blank" rel="noopener noreferrer" className="cinema-news-birthday-card">
            <span className="person-avatar-circle cinema-news-birthday-avatar">
              {p.photo ? <img src={p.photo} alt={p.name} className="person-avatar-photo" /> : p.name[0]?.toUpperCase()}
            </span>
            <span className="cinema-news-birthday-info">
              <span className="cinema-news-birthday-name">{p.name}</span>
              {p[subtitleKey] && <span className="cinema-news-birthday-films">{p[subtitleKey]}</span>}
            </span>
          </a>
        ) : (
          <div key={p.name} className="cinema-news-birthday-card">
            <span className="person-avatar-circle cinema-news-birthday-avatar">
              {p.photo ? <img src={p.photo} alt={p.name} className="person-avatar-photo" /> : p.name[0]?.toUpperCase()}
            </span>
            <span className="cinema-news-birthday-info">
              <span className="cinema-news-birthday-name">{p.name}</span>
              {p[subtitleKey] && <span className="cinema-news-birthday-films">{p[subtitleKey]}</span>}
            </span>
          </div>
        )
      )}
    </div>
  )
}

// صفحه‌ی «اخبار سینما». همه‌چیز جدا جدا نمایش داده می‌شه (بدون تب "All"):
// خبر سینما / خبر سریال / اخبار فارسی هرکدوم بخش خودشونو دارن، همین‌طور
// «در راه» کالکشن و «در راه» عمومی هم فیلم/سریال جداست. دیتا از
// /api/cinema-news، سمت سرور کش می‌شه.
export default function CinemaNewsPage({ onBack, onSelectPerson, theme, setTheme, films }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('news')

  useEffect(() => {
    let cancelled = false
    fetch('/api/cinema-news')
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(
        () =>
          !cancelled &&
          setData({ birthdays: [], upcoming: [], trailers: [], headlines: [], headlinesFa: [], generalUpcoming: { movies: [], series: [] } })
      )
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
  const generalMovies = data?.generalUpcoming?.movies || []
  const generalSeries = data?.generalUpcoming?.series || []
  const trendingMoviesWeek = data?.trending?.trendingMoviesWeek || []
  const trendingSeriesWeek = data?.trending?.trendingSeriesWeek || []
  const popularMonth = data?.trending?.popularMonth || []
  const boxOffice = data?.trending?.boxOffice || []
  const trendingPeople = data?.trendingPeople || []
  const newsUpdatedAt = formatUpdatedAt(data?.newsUpdatedAt)
  const bornTodayGeneral = useMemo(
    () =>
      (data?.bornTodayGeneral || []).map((p) => ({
        ...p,
        subtitle: p.age != null ? `Age ${p.age}` : p.birthYear ? String(p.birthYear) : null,
      })),
    [data]
  )

  const movieHeadlines = useMemo(() => headlinesEn.filter((h) => classifyHeadline(h.title) === 'movie'), [headlinesEn])
  const seriesHeadlines = useMemo(() => headlinesEn.filter((h) => classifyHeadline(h.title) === 'series'), [headlinesEn])

  const collectionMovies = useMemo(() => upcoming.filter((u) => u.mediaType !== 'series'), [upcoming])
  const collectionSeries = useMemo(() => upcoming.filter((u) => u.mediaType === 'series'), [upcoming])

  const nothingFound =
    !loading &&
    !birthdays.length &&
    !upcoming.length &&
    !trailers.length &&
    !headlinesEn.length &&
    !headlinesFa.length &&
    !generalMovies.length &&
    !generalSeries.length &&
    !trendingMoviesWeek.length &&
    !trendingSeriesWeek.length &&
    !popularMonth.length &&
    !boxOffice.length &&
    !trendingPeople.length &&
    !bornTodayGeneral.length

  const tabHasContent = {
    news: movieHeadlines.length > 0 || seriesHeadlines.length > 0 || headlinesFa.length > 0,
    people: trendingPeople.length > 0 || birthdays.length > 0 || bornTodayGeneral.length > 0,
    comingsoon: upcoming.length > 0 || generalMovies.length > 0 || generalSeries.length > 0,
    trending: trendingMoviesWeek.length > 0 || trendingSeriesWeek.length > 0 || popularMonth.length > 0,
    boxoffice: boxOffice.length > 0,
    trailers: trailers.length > 0,
  }

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

        <nav className="dashboard-subnav">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)} title={t.label}>
                <Icon width={14} height={14} />
                <span className="dashboard-tab-label">{t.label}</span>
              </button>
            )
          })}
        </nav>

        {loading && <p className="person-extras-loading">Loading cinema news…</p>}

        {nothingFound && (
          <p className="person-subtitle" style={{ marginTop: 12 }}>
            Nothing to show yet — birthdays fill in as you open actor/director pages, and TMDB keys are needed for
            upcoming titles &amp; trailers.
          </p>
        )}

        {!loading && !nothingFound && !tabHasContent[tab] && (
          <p className="person-subtitle" style={{ marginTop: 12 }}>
            Nothing here yet.
          </p>
        )}

        <div className="cinema-news-stack">
          {tab === 'news' && (movieHeadlines.length > 0 || seriesHeadlines.length > 0 || headlinesFa.length > 0) && (
            <>
              <p className="cinema-news-updated-meta">
                {newsUpdatedAt ? `Updated ${newsUpdatedAt}` : 'Updated recently'} · refreshes every 6 hours
              </p>
              <div className="stats-section-row cinema-news-row-3">
              <div className="stats-box">
                <h3>
                  <IconNewspaper width={15} height={15} /> Movie news
                </h3>
                <HeadlineList items={movieHeadlines} />
              </div>
              <div className="stats-box">
                <h3>
                  <IconNewspaper width={15} height={15} /> Series news
                </h3>
                <HeadlineList items={seriesHeadlines} />
              </div>
              <div className="stats-box">
                <h3>
                  <IconNewspaper width={15} height={15} /> اخبار فارسی
                </h3>
                <HeadlineList items={headlinesFa} rtl />
              </div>
              </div>
            </>
          )}

          {tab === 'people' && trendingPeople.length > 0 && (
            <div className="stats-box">
              <h3>Trending people</h3>
              <PeopleGrid items={trendingPeople} subtitleKey="knownFor" />
            </div>
          )}

          {tab === 'people' && birthdays.length > 0 && (
            <div className="stats-box">
              <h3>
                <IconCake width={15} height={15} /> Birthdays today (your collection)
              </h3>
              <div className="cinema-news-birthday-grid">
                {birthdays.map((b) => (
                  <button key={b.name} type="button" className="cinema-news-birthday-card" onClick={() => onSelectPerson(b.name)}>
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

          {tab === 'people' && bornTodayGeneral.length > 0 && (
            <div className="stats-box">
              <h3>
                <IconCake width={15} height={15} /> Born today (everywhere)
              </h3>
              <PeopleGrid items={bornTodayGeneral} subtitleKey="subtitle" />
            </div>
          )}

          {tab === 'comingsoon' && upcoming.length > 0 && (
            <div className="stats-section-row">
              <div className="stats-box">
                <div className="cinema-news-headline-header">
                  <h3 style={{ margin: 0 }}>
                    <IconClapperPlay width={15} height={15} /> Coming soon (your collection) — Movies
                  </h3>
                  <ExportMissingButton items={collectionMovies} films={films} filename="coming-soon-collection-movies-missing.csv" />
                </div>
                <UpcomingList items={collectionMovies} onSelectPerson={onSelectPerson} films={films} />
              </div>
              <div className="stats-box">
                <div className="cinema-news-headline-header">
                  <h3 style={{ margin: 0 }}>
                    <IconClapperPlay width={15} height={15} /> Coming soon (your collection) — Series
                  </h3>
                  <ExportMissingButton items={collectionSeries} films={films} filename="coming-soon-collection-series-missing.csv" />
                </div>
                <UpcomingList items={collectionSeries} onSelectPerson={onSelectPerson} films={films} />
              </div>
            </div>
          )}

          {tab === 'comingsoon' && (generalMovies.length > 0 || generalSeries.length > 0) && (
            <div className="stats-section-row">
              <div className="stats-box">
                <div className="cinema-news-headline-header">
                  <h3 style={{ margin: 0 }}>
                    <IconClapperPlay width={15} height={15} /> Coming soon (everywhere) — Movies
                  </h3>
                  <ExportMissingButton items={generalMovies} films={films} filename="coming-soon-everywhere-movies-missing.csv" />
                </div>
                <PosterGrid items={generalMovies} films={films} />
              </div>
              <div className="stats-box">
                <div className="cinema-news-headline-header">
                  <h3 style={{ margin: 0 }}>
                    <IconClapperPlay width={15} height={15} /> Coming soon (everywhere) — Series
                  </h3>
                  <ExportMissingButton items={generalSeries} films={films} filename="coming-soon-everywhere-series-missing.csv" />
                </div>
                <PosterGrid items={generalSeries} films={films} />
              </div>
            </div>
          )}

          {tab === 'trending' && (trendingMoviesWeek.length > 0 || trendingSeriesWeek.length > 0) && (
            <div className="stats-section-row">
              <div className="stats-box">
                <h3>Trending this week — Movies</h3>
                <PosterGrid items={trendingMoviesWeek} />
              </div>
              <div className="stats-box">
                <h3>Trending this week — Series</h3>
                <PosterGrid items={trendingSeriesWeek} />
              </div>
            </div>
          )}

          {tab === 'trending' && popularMonth.length > 0 && (
            <div className="stats-box">
              <h3>Popular this month</h3>
              <PosterGrid items={popularMonth} />
            </div>
          )}

          {tab === 'boxoffice' && boxOffice.length > 0 && (
            <div className="stats-section-row">
              <div className="stats-box">
                <h3>Top box office — chart</h3>
                <BoxOfficeChart items={boxOffice} />
              </div>
              <div className="stats-box">
                <h3>Top box office (worldwide revenue)</h3>
                <BoxOfficeTable items={boxOffice} />
              </div>
            </div>
          )}

          {tab === 'trailers' && trailers.length > 0 && (
            <div className="stats-box">
              <h3>New trailers</h3>
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
    </div>
  )
}
