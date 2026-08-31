import { useMemo, useState } from 'react'
import { IconLayers, IconTV, IconBarChart, IconDisc, IconStar, IconFilm, IconSearch, IconClose, IconSparkles, IconBookshelf, IconNewspaper, IconHardDrive, IconChevronRight } from './icons.jsx'
import PosterCollage from './PosterCollage.jsx'

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// جستجوی «at» قبلاً کلی فیلم بی‌ربط می‌آورد چون فقط substring ساده بود —
// حتی تو اسم بازیگرها («Natalie»، «Matt») یا هرجای دیگه. حالا امتیازدهی
// می‌کنیم: عنوان دقیق/شروع‌شونده بالاترین امتیاز، match با مرز کلمه بعدی،
// substring ساده تو عنوان بعدش، و فقط برای عبارت‌های ۳+ حرفی توی
// بازیگر/کارگردان/ژانر هم می‌گرده (تا کوئری‌های کوتاه شلوغ نشن).
function matchScore(film, q) {
  const title = (film.title || '').toLowerCase()
  const origTitle = (film.originalTitle || '').toLowerCase()
  if (title === q || origTitle === q) return 100
  if (title.startsWith(q) || origTitle.startsWith(q)) return 80
  const wordBoundaryRe = new RegExp(`\\b${escapeRegex(q)}`, 'i')
  if (wordBoundaryRe.test(title) || wordBoundaryRe.test(origTitle)) return 60
  if (title.includes(q) || origTitle.includes(q)) return 40
  // فاصله‌ها رو نادیده می‌گیریم تا «Davinci» هم با «Da Vinci» match بشه —
  // کاربر دقیقاً یادش نمی‌مونه کجای عنوان فاصله داشت.
  const noSpace = (s) => s.replace(/\s+/g, '')
  if (q.length >= 4 && (noSpace(title).includes(noSpace(q)) || noSpace(origTitle).includes(noSpace(q)))) return 30
  if (q.length >= 3) {
    const otherFields = [
      film.director,
      film.producer,
      film.studio,
      Array.isArray(film.cast) ? film.cast.join(' ') : film.cast,
      Array.isArray(film.genre) ? film.genre.join(' ') : film.genre,
    ]
    if (otherFields.some((h) => h && String(h).toLowerCase().includes(q))) return 20
  }
  return 0
}

function badgeFor(film, hasBoth) {
  if (hasBoth) return `Physical + Digital · ${film.itemType === 'series' ? 'Series' : 'Movie'}`
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
  // رو دسکتاپ (صفحه‌ی عریض)، چیدمان کنار-هم (brand + grid) طراحی شده بود؛
  // اگه پیش‌فرض بسته باشه، فقط یه ستون کوچیک وسط یه صفحه‌ی خالی می‌مونه.
  // پس فقط رو موبایل (صفحه‌ی باریک) پیش‌فرض بسته‌ست، دسکتاپ همیشه بازه.
  const [browseOpen, setBrowseOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 860px)').matches
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || !Array.isArray(allFilms)) return []
    const scored = allFilms
      .map((f) => ({ film: f, score: matchScore(f, q) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
    const matched = scored.map((s) => s.film)
    // فیزیکال و دیجیتالِ همون عنوان (همون سال) دو ردیف جدا تو نتایج بودن —
    // یکی می‌کنیم، بج «Physical + Digital» نشون می‌ده و به رکورد فیزیکال
    // لینک می‌ده (FilmModal خودش نسخه‌ی دیگه رو هم از sibling lookup نشون می‌ده).
    const groups = new Map()
    const order = []
    for (const f of matched) {
      const key = `${(f.title || '').trim().toLowerCase()}|${f.year || ''}`
      if (!groups.has(key)) {
        groups.set(key, [])
        order.push(key)
      }
      groups.get(key).push(f)
    }
    const deduped = []
    for (const key of order) {
      const group = groups.get(key)
      const physical = group.find((f) => f.mediaType !== 'digital')
      const digital = group.find((f) => f.mediaType === 'digital')
      const primary = physical || digital
      deduped.push({ ...primary, __hasBoth: Boolean(physical && digital) })
    }
    return deduped.slice(0, 30)
  }, [query, allFilms])

  const searching = query.trim().length >= 2

  const yearRange = useMemo(() => {
    const minYear = counts && counts.minYear
    if (!minYear) return null
    return `${minYear}–${new Date().getFullYear()}`
  }, [counts])

  return (
    <div className="folder-nav">
      <span className="stage-curtain" aria-hidden="true" />
      <PosterCollage posters={posters} />
      <div className="folder-nav-content">
        <div className="folder-nav-search-outer reveal-item reveal-4">
          <div className="search-box">
            <span className="search-icon">
              <IconSearch width={16} height={16} />
            </span>
            <input
              type="search"
              placeholder="Search the archive…"
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
                      <span className="folder-nav-search-badge">{badgeFor(f, f.__hasBoth)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="marquee-band">
          <div className="marquee-brand">
            <img src="/logo.png" alt="Cinefilm Archive" className="folder-nav-logo reveal-item reveal-1" />
            <p className="marquee-eyebrow reveal-item reveal-2">Now showing</p>
            <h1 className="folder-nav-title reveal-item reveal-3">Cinefilm Archive</h1>

            <button
              type="button"
              className="folder-nav-stats reveal-item reveal-3"
              onClick={() => setBrowseOpen((v) => !v)}
              aria-expanded={browseOpen}
            >
              <div className="folder-nav-stat">
                <span className="folder-nav-stat-value">{counts.physical || 0}</span>
                <span className="folder-nav-stat-label">Blu-ray</span>
              </div>
              <div className="folder-nav-stat">
                <span className="folder-nav-stat-value">{(counts.digitalMovies || 0) + (counts.digitalSeries || 0)}</span>
                <span className="folder-nav-stat-label">Digital</span>
              </div>
              <div className="folder-nav-stat">
                <span className="folder-nav-stat-value">{(counts.digitalSeries || 0) + (counts.physicalSeries || 0)}</span>
                <span className="folder-nav-stat-label">Series</span>
              </div>
              <IconChevronRight width={16} height={16} className={browseOpen ? 'folder-nav-stats-chevron folder-nav-stats-chevron-open' : 'folder-nav-stats-chevron'} />
            </button>
          </div>

          {!searching && (
            <div className={browseOpen ? 'folder-grid folder-grid-open' : 'folder-grid folder-grid-collapsed'}>
              <button className="folder-card folder-card-physical reveal-item reveal-4" onClick={onSelectPhysical}>
                <span className="folder-icon">
                  <IconDisc width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Blu-ray Movies</h2>
                  <p>Physical · {counts.physical} items</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card folder-card-physical reveal-item reveal-5" onClick={onSelectPhysicalSeries}>
                <span className="folder-icon">
                  <IconLayers width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Blu-ray Series</h2>
                  <p>Physical · {counts.physicalSeries || 0} items</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card folder-card-physical reveal-item reveal-6" onClick={onOpenBookshelf}>
                <span className="folder-icon">
                  <IconBookshelf width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>3D Bookshelf</h2>
                  <p>Physical · {counts.physical} items</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card folder-card-digital reveal-item reveal-7" onClick={() => onSelectDigitalType('movie')}>
                <span className="folder-icon">
                  <IconFilm width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Digital Movies</h2>
                  <p>Drive · {counts.digitalMovies} items</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card folder-card-digital reveal-item reveal-8" onClick={() => onSelectDigitalType('series')}>
                <span className="folder-icon">
                  <IconTV width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Digital Series</h2>
                  <p>Drive · {counts.digitalSeries} items</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card folder-card-digital reveal-item reveal-8" onClick={onOpenDriveBrowser}>
                <span className="folder-icon">
                  <IconHardDrive width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Browse by Drive</h2>
                  <p>Digital · {(counts.digitalMovies || 0) + (counts.digitalSeries || 0)} items</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card reveal-item reveal-8" onClick={onSelectSpecialCollections}>
                <span className="folder-icon">
                  <IconStar width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Special Collections</h2>
                  <p>Coming soon</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card reveal-item reveal-9" onClick={onSelectDashboard}>
                <span className="folder-icon">
                  <IconBarChart width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Dashboard</h2>
                  <p>Info &amp; Statistics</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card reveal-item reveal-9" onClick={onSelectGallery}>
                <span className="folder-icon">
                  <IconSparkles width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Gallery</h2>
                  <p>Visual poster wall</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
              <button className="folder-card reveal-item reveal-9" onClick={onSelectCinemaNews}>
                <span className="folder-icon">
                  <IconNewspaper width={32} height={32} />
                </span>
                <span className="folder-card-text">
                  <h2>Cinema News</h2>
                  <p>Birthdays &amp; what's coming</p>
                </span>
                <IconChevronRight width={18} height={18} className="folder-card-chevron" />
              </button>
            </div>
          )}
          <p className="marquee-footer reveal-item reveal-9">
            One ticket, infinite stories{yearRange ? ` · ${yearRange}` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
