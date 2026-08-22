import { useEffect, useRef, useState } from 'react'
import AlphabetBar from './AlphabetBar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  IconSearch,
  IconUpload,
  IconDownload,
  IconSun,
  IconMoon,
  IconSparkles,
  IconArchive,
  IconDisc,
  IconClapper,
  IconBookshelf,
  IconPin,
  IconCamera,
} from './icons.jsx'

function IconHamburger(props) {
  return (
    <svg width={props.width || 18} height={props.height || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function getPageNumbers(page, pageCount) {
  const delta = 1
  const range = []
  const withDots = []
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || (i >= page - delta && i <= page + delta)) {
      range.push(i)
    }
  }
  let prev
  for (const i of range) {
    if (prev !== undefined && i - prev > 1) withDots.push('…')
    withDots.push(i)
    prev = i
  }
  return withDots
}

function IconFilter(props) {
  return (
    <svg width={props.width || 15} height={props.height || 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16M7 12h10M10 19h4" />
    </svg>
  )
}

export default function Header({
  query,
  setQuery,
  genre,
  setGenre,
  genres,
  loanedOnly,
  setLoanedOnly,
  watched,
  setWatched,
  minRating,
  setMinRating,
  decade,
  setDecade,
  decades,
  drive,
  setDrive,
  drives,
  sort,
  setSort,
  total,
  section,
  onImport,
  onImportRatings,
  onAddFilm,
  onAddViaPhoto,
  onEnrichCatalog,
  enrichingCatalog,
  enrichRemaining,
  enrichScopeLabel,
  onOpenExport,
  onOpenLocationBrowser,
  onOpenBookshelf,
  onSyncLetterboxd,
  onFetchSeasonCounts,
  fetchingSeasonCounts,
  view,
  setView,
  alpha,
  setAlpha,
  theme,
  setTheme,
  onGoToLibrary,
  page,
  pageCount,
  setPage,
  showPagination,
}) {
  const fileRef = useRef(null)
  const ratingsFileRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [azOpen, setAzOpen] = useState(false)
  const [condensed, setCondensed] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const { user, isGuest, isAdmin, logout, openLogin, setAdminOpen } = useAuth()

  // برای مهمان‌ها، به‌جای اجرای عملیات نوشتنی، مدال ورود باز می‌شه.
  const guarded = (fn) => () => {
    if (isGuest) {
      openLogin()
      return
    }
    fn()
  }

  // موقع اسکرول به پایین، هدر جمع‌وجورتر بشه (زیرعنوان‌ها مخفی، پدینگ کمتر)
  // تا فضای بیشتری به محتوا بده. همچنین اگه پنل فیلتر/منو/A-Z باز بود، با
  // اسکرول بسته بشه — وگرنه رو پوسترها معلق می‌مونه و جلوی دیدشون رو می‌گیره.
  useEffect(() => {
    const onScroll = () => {
      setCondensed(window.scrollY > 40)
      setFiltersOpen(false)
      setMenuOpen(false)
      setAzOpen(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onImport(file)
    e.target.value = ''
  }

  const onRatingsFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onImportRatings(file)
    e.target.value = ''
  }

  const anyPopoverOpen = menuOpen || filtersOpen || azOpen
  const closeAllPopovers = () => {
    setMenuOpen(false)
    setFiltersOpen(false)
    setAzOpen(false)
  }

  return (
    <header className={condensed ? 'header header-condensed' : 'header'}>
      {anyPopoverOpen && <div className="menu-backdrop" onClick={closeAllPopovers} />}

      <div className="container header-inner">
        <div className="header-brand-group">
        <button type="button" className="brand brand-clickable" onClick={onGoToLibrary} title="Back to Library">
          <img src="/logo.png" alt="Cinefilm Archive" className="brand-logo" />
          <div className="brand-text">
            <div className="brand-title-row">
              <h1 className="brand-title">CINEFILM ARCHIVE</h1>
              <div className={`section-badge section-badge-${section === 'digital-movie' || section === 'digital-series' ? 'digital' : 'physical'}`}>
                {section === 'digital-movie' ? (
                  <>
                    <IconClapper width={13} height={13} /> Digital Movies
                  </>
                ) : section === 'digital-series' ? (
                  <>
                    <IconBookshelf width={13} height={13} /> Digital Series
                  </>
                ) : section === 'physical-series' ? (
                  <>
                    <IconDisc width={13} height={13} /> Blu-ray Series
                  </>
                ) : (
                  <>
                    <IconArchive width={13} height={13} /> Blu-ray Movies
                  </>
                )}
              </div>
            </div>
            <p className="brand-meta">
              <span className="brand-owner">Alireza Mazlaghani</span>
              <span className="brand-meta-sep">·</span>
              <span className="brand-sub">
                {total}{' '}
                {section === 'digital-movie'
                  ? 'digital movies'
                  : section === 'digital-series'
                  ? 'digital series'
                  : section === 'physical-series'
                  ? 'Blu-ray series'
                  : 'physical films'}
              </span>
            </p>
          </div>
        </button>
        </div>

        <div className="actions">
          <div className="filters-wrap">
            <button
              type="button"
              className="btn btn-ghost filters-toggle"
              onClick={() => {
                setFiltersOpen((v) => !v)
                setMenuOpen(false)
                setAzOpen(false)
              }}
              aria-expanded={filtersOpen}
              title="Filters"
            >
              <IconFilter width={14} height={14} /> <span className="btn-label">Filters</span>
            </button>

            <div className={filtersOpen ? 'controls-filters open' : 'controls-filters'}>
              <p className="filters-panel-label">Refine the archive</p>
              <div className="filters-grid">
                <select className="select" value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <option value="">All genres</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <select className="select" value={watched} onChange={(e) => setWatched(e.target.value)}>
                  <option value="">All watch statuses</option>
                  <option value="0">Unwatched</option>
                  <option value="1">Watched</option>
                </select>
                <select className="select" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                  <option value="">Any rating</option>
                  <option value="7">Rating 7+</option>
                  <option value="8">Rating 8+</option>
                  <option value="9">Rating 9+</option>
                </select>
                <select className="select" value={decade} onChange={(e) => setDecade(e.target.value)}>
                  <option value="">All decades</option>
                  {decades.map((d) => (
                    <option key={d} value={d}>
                      {d}s
                    </option>
                  ))}
                </select>
                {(section === 'digital-movie' || section === 'digital-series') && (
                  <select className="select" value={drive} onChange={(e) => setDrive(e.target.value)}>
                    <option value="">All drives</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={`Drive ${d}`}>
                        Drive {d}
                      </option>
                    ))}
                  </select>
                )}
                <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="random">Random</option>
                  <option value="title_az">A–Z</option>
                  <option value="shelf">By shelf</option>
                  <option value="year_desc">Newest</option>
                  <option value="year_asc">Oldest</option>
                  <option value="rating">Top rated</option>
                </select>
                <label className="loan-filter">
                  <input type="checkbox" checked={loanedOnly} onChange={(e) => setLoanedOnly(e.target.checked)} />
                  Loaned only
                </label>
              </div>
            </div>
          </div>

          {(section === 'physical' || section === 'physical-series') && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                onOpenLocationBrowser()
                setFiltersOpen(false)
                setMenuOpen(false)
                setAzOpen(false)
              }}
              title="Browse by closet / row / section"
            >
              <IconPin width={14} height={14} /> <span className="btn-label">Location</span>
            </button>
          )}

          {onOpenBookshelf && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                onOpenBookshelf()
                setFiltersOpen(false)
                setMenuOpen(false)
                setAzOpen(false)
              }}
              title="3D Physical Bookshelf view (pure exhibition without edit buttons)"
            >
              <IconBookshelf width={14} height={14} /> <span className="btn-label">Bookshelf</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations()
                for (const r of regs) await r.unregister()
              }
              if ('caches' in window) {
                const keys = await caches.keys()
                for (const k of keys) await caches.delete(k)
              }
              window.location.reload(true)
            }}
            title="Force refresh & clear offline cache"
            style={{ fontSize: '12px', padding: '6px 10px' }}
          >
            ↻ <span className="btn-label">Refresh App</span>
          </button>

          <button
            className="btn btn-ghost theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle dark / light"
          >
            {theme === 'dark' ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
          </button>

          <div className="header-menu-wrap">
            <button
              type="button"
              className="btn btn-ghost menu-toggle"
              onClick={() => {
                setMenuOpen((v) => !v)
                setFiltersOpen(false)
                setAzOpen(false)
              }}
              aria-expanded={menuOpen}
              title="Menu"
            >
              <IconHamburger width={17} height={17} />
            </button>

            <div className={menuOpen ? 'header-menu-panel open' : 'header-menu-panel'}>
              <div className="header-menu-section">
                <button
                  type="button"
                  className="header-menu-primary"
                  onClick={guarded(() => {
                    onAddFilm()
                    setMenuOpen(false)
                  })}
                >
                  + Add Film
                </button>
                <button
                  type="button"
                  onClick={guarded(() => {
                    onAddViaPhoto()
                    setMenuOpen(false)
                  })}
                  title="Take or upload a photo of your Blu-ray/DVD spines — Claude reads the titles for you"
                >
                  <IconCamera width={15} height={15} /> Add via Photo
                </button>
              </div>
              <div className="header-menu-section">
                <div className="header-menu-section-title">Tools</div>
                <button
                  type="button"
                  onClick={guarded(() => {
                    onEnrichCatalog()
                    setMenuOpen(false)
                  })}
                  disabled={enrichingCatalog}
                  title={
                    enrichScopeLabel
                      ? `Fill missing posters, cast, genres, and other public metadata — ${enrichScopeLabel} only`
                      : 'Fill missing posters, cast, genres, and other public metadata'
                  }
                >
                  <IconSparkles width={15} height={15} />{' '}
                  {enrichingCatalog
                    ? 'Completing metadata…'
                    : enrichRemaining > 0
                    ? `Fill missing details${enrichScopeLabel ? ` (${enrichScopeLabel})` : ''} (${enrichRemaining} left)`
                    : `Fill missing details${enrichScopeLabel ? ` (${enrichScopeLabel})` : ''}`}
                </button>
                <button
                  type="button"
                  onClick={guarded(() => {
                    onSyncLetterboxd()
                    setMenuOpen(false)
                  })}
                  title="Pull your own diary entries/reviews from your public Letterboxd RSS feed"
                >
                  <IconSparkles width={15} height={15} /> Sync Letterboxd Reviews
                </button>
                <button
                  type="button"
                  onClick={guarded(() => {
                    onFetchSeasonCounts()
                    setMenuOpen(false)
                  })}
                  disabled={fetchingSeasonCounts}
                  title="Look up how many seasons have been produced so far for series missing that number"
                >
                  <IconSparkles width={15} height={15} />{' '}
                  {fetchingSeasonCounts ? 'Fetching season counts…' : 'Fetch Season Counts'}
                </button>
              </div>

              <div className="header-menu-section">
                <div className="header-menu-section-title">Import / Export</div>
                <button
                  type="button"
                  onClick={guarded(() => {
                    fileRef.current?.click()
                    setMenuOpen(false)
                  })}
                >
                  <IconUpload width={15} height={15} /> Import Excel
                </button>
                <a className="header-menu-link" href="/api/template" onClick={() => setMenuOpen(false)}>
                  <IconDownload width={15} height={15} /> Download Template
                </a>
                <button
                  type="button"
                  onClick={guarded(() => {
                    onOpenExport()
                    setMenuOpen(false)
                  })}
                  title="Export Catalog / PDF / Excel Backup"
                >
                  <IconDownload width={15} height={15} /> Export / Backup
                </button>
                <button
                  type="button"
                  onClick={guarded(() => {
                    ratingsFileRef.current?.click()
                    setMenuOpen(false)
                  })}
                  title="Import ratings and watched status from a Letterboxd or IMDb export CSV"
                >
                  <IconUpload width={15} height={15} /> Import Ratings (Letterboxd/IMDb)
                </button>
              </div>

              <div className="header-menu-section">
                <div className="header-menu-section-title">Account</div>
                {isGuest ? (
                  <button type="button" onClick={() => { openLogin(); setMenuOpen(false) }}>
                    Log in
                  </button>
                ) : (
                  <>
                    <div style={{ padding: '4px 12px', color: 'var(--muted)', fontSize: 13 }}>
                      {user.username} {isAdmin ? '(Admin)' : ''}
                    </div>
                    {isAdmin && (
                      <button type="button" onClick={() => { setAdminOpen(true); setMenuOpen(false) }}>
                        Manage Users
                      </button>
                    )}
                    <button type="button" onClick={() => { logout(); setMenuOpen(false) }}>
                      Log out
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onFile} />
          <input ref={ratingsFileRef} type="file" accept=".csv" hidden onChange={onRatingsFile} />
        </div>
      </div>

      <div className="container controls">
        <div className="search-box">
          <span className="search-icon">
            <IconSearch width={16} height={16} />
          </span>
          <input
            type="search"
            placeholder="Search title, director or actor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="az-popover-wrap">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setAzOpen((v) => !v)
              setMenuOpen(false)
              setFiltersOpen(false)
            }}
            aria-expanded={azOpen}
          >
            {alpha ? alpha.toUpperCase() : 'A–Z'}
          </button>
          <div className={azOpen ? 'az-popover open' : 'az-popover'}>
            <AlphabetBar
              alpha={alpha}
              setAlpha={(v) => {
                setAlpha(v)
                setSort('title_az')
                setAzOpen(false)
              }}
            />
          </div>
        </div>
      </div>

      {showPagination && (
        <div className="container pagination pagination-top">
          <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
          <div className="pagination-numbers">
            {getPageNumbers(page, pageCount).map((p, idx) =>
              p === '…' ? (
                <span key={`dots-${idx}`} className="pagination-dots">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={p === page ? 'pagination-num pagination-num-active' : 'pagination-num'}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
          </div>
          <form
            className="pagination-jump"
            onSubmit={(e) => {
              e.preventDefault()
              const n = parseInt(jumpValue, 10)
              if (n >= 1 && n <= pageCount) setPage(n)
              setJumpValue('')
            }}
          >
            <input
              type="number"
              min={1}
              max={pageCount}
              placeholder={`Go to…`}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              className="pagination-jump-input"
            />
          </form>
          <button type="button" disabled={page === pageCount} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </header>
  )
}
