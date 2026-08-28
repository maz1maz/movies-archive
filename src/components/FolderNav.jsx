import { useMemo, useState } from 'react'
import { IconLayers, IconTV, IconBarChart, IconDisc, IconStar, IconFilm, IconSearch, IconClose, IconSparkles, IconBookshelf, IconNewspaper, IconHardDrive } from './icons.jsx'
import PosterCollage from './PosterCollage.jsx'

function matchesQuery(film, q) {
  const haystacks = [
    film.title,
    film.originalTitle,
    film.director,
    film.producer,
    film.studio,
    Array.isArray(film.cast) ? film.cast.join(' ') : film.cast,
    Array.isArray(film.genre) ? film.genre.join(' ') : film.genre,
  ]
  return haystacks.some((h) => h && String(h).toLowerCase().includes(q))
}

function badgeFor(film) {
  const media = film.mediaType === 'digital' ? 'Digital' : 'Physical'
  const kind = film.itemType === 'series' ? 'Series' : 'Movie'
  return `${media} · ${kind}`
}

// صفحه‌ی اول: مسیرهای مستقیم — فیزیکی فیلم/سریال، دیجیتال فیلم/سریال،
// مجموعه‌های ویژه، داشبورد — به‌علاوه یه سرچ سراسری که بدون توجه به بخش،
// کل آرشیو (فیزیکی+دیجیتال، فیلم+سریال) رو با هم می‌گرده
export default function FolderNav({
  onSelectPhysical,
  onSelectPhysicalSeries,
  onSelectDigitalType,
  onSelectSpecialCollections,
  onOpenBookshelf,
  onOpenDriveBrowser,
  onSelectDashboard,
  onSelectGallery,
  onSelectCinemaNews,
  counts,
  posters,
  allFilms,
  onOpenFilm,
}) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || !Array.isArray(allFilms)) return []
    return allFilms.filter((f) => matchesQuery(f, q)).slice(0, 30)
  }, [query, allFilms])

  const searching = query.trim().length >= 2

  return (
    <div className="folder-nav">
      <span className="stage-curtain" aria-hidden="true" />
      <PosterCollage posters={posters} />
      <div className="folder-nav-content">
        <div className="marquee-band">
          <div className="marquee-brand">
            <img src="/logo.png" alt="Cinefilm Archive" className="folder-nav-logo reveal-item reveal-1" />
            <p className="marquee-eyebrow reveal-item reveal-2">Now showing</p>
            <h1 className="folder-nav-title reveal-item reveal-3">Cinefilm Archive</h1>

            <div className="folder-nav-search reveal-item reveal-4">
              <div className="search-box">
                <span className="search-icon">
                  <IconSearch width={16} height={16} />
                </span>
                <input
                  type="search"
                  placeholder="Search the whole archive — title, director, actor…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                    <IconClose width={14} height={14} />
                  </button>
                )}
              </div>

              {searching && (
                <div className="folder-nav-search-results">
                  {results.length === 0 ? (
                    <p className="folder-nav-search-empty">No matches in the whole archive.</p>
                  ) : (
                    results.map((f) => (
                      <button key={f.id} type="button" className="folder-nav-search-row" onClick={() => onOpenFilm(f)}>
                        {f.poster ? (
                          <img src={f.poster} alt="" className="folder-nav-search-poster" />
                        ) : (
                          <span className="folder-nav-search-poster folder-nav-search-poster-empty" />
                        )}
                        <span className="folder-nav-search-info">
                          <span className="folder-nav-search-title">
                            {f.title} {f.year ? <span className="folder-nav-search-year">({f.year})</span> : null}
                          </span>
                          <span className="folder-nav-search-badge">{badgeFor(f)}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {!searching && (
            <div className="folder-grid">
              <button className="folder-card folder-card-physical reveal-item reveal-4" onClick={onSelectPhysical}>
                <span className="folder-icon">
                  <IconDisc width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Blu-ray Movies</h2>
                  <p>Physical · {counts.physical} items</p>
                </span>
              </button>
              <button className="folder-card folder-card-physical reveal-item reveal-5" onClick={onSelectPhysicalSeries}>
                <span className="folder-icon">
                  <IconLayers width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Blu-ray Series</h2>
                  <p>Physical · {counts.physicalSeries || 0} items</p>
                </span>
              </button>
              <button className="folder-card folder-card-digital reveal-item reveal-6" onClick={() => onSelectDigitalType('movie')}>
                <span className="folder-icon">
                  <IconFilm width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Digital Movies</h2>
                  <p>Drive · {counts.digitalMovies} items</p>
                </span>
              </button>
              <button className="folder-card folder-card-digital reveal-item reveal-7" onClick={() => onSelectDigitalType('series')}>
                <span className="folder-icon">
                  <IconTV width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Digital Series</h2>
                  <p>Drive · {counts.digitalSeries} items</p>
                </span>
              </button>
              <button className="folder-card folder-card-physical reveal-item reveal-8" onClick={onOpenBookshelf}>
                <span className="folder-icon">
                  <IconBookshelf width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>3D Bookshelf</h2>
                  <p>Physical · {counts.physical} items</p>
                </span>
              </button>
              <button className="folder-card folder-card-digital reveal-item reveal-8" onClick={onOpenDriveBrowser}>
                <span className="folder-icon">
                  <IconHardDrive width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Browse by Drive</h2>
                  <p>Digital · {(counts.digitalMovies || 0) + (counts.digitalSeries || 0)} items</p>
                </span>
              </button>
              <button className="folder-card reveal-item reveal-8" onClick={onSelectSpecialCollections}>
                <span className="folder-icon">
                  <IconStar width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Special Collections</h2>
                  <p>Coming soon</p>
                </span>
              </button>
              <button className="folder-card folder-card-dashboard reveal-item reveal-9" onClick={onSelectDashboard}>
                <span className="folder-icon">
                  <IconBarChart width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Dashboard</h2>
                  <p>Info &amp; Statistics</p>
                </span>
              </button>
              <button className="folder-card reveal-item reveal-9" onClick={onSelectGallery}>
                <span className="folder-icon">
                  <IconSparkles width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Gallery</h2>
                  <p>Visual poster wall</p>
                </span>
              </button>
              <button className="folder-card reveal-item reveal-9" onClick={onSelectCinemaNews}>
                <span className="folder-icon">
                  <IconNewspaper width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Cinema News</h2>
                  <p>Birthdays &amp; what's coming</p>
                </span>
              </button>
            </div>
          )}
          <p className="marquee-footer reveal-item reveal-9">Admit one · no refunds · enjoy the show</p>
        </div>
      </div>
    </div>
  )
}
