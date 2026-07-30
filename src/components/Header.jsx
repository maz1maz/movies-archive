import { useEffect, useRef, useState } from 'react'
import AlphabetBar from './AlphabetBar.jsx'
import {
  IconSearch,
  IconUpload,
  IconDownload,
  IconSun,
  IconMoon,
  IconSparkles,
} from './icons.jsx'

function IconHamburger(props) {
  return (
    <svg width={props.width || 18} height={props.height || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
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
  sort,
  setSort,
  total,
  section,
  onImport,
  onImportRatings,
  onAddFilm,
  onEnrichCatalog,
  enrichingCatalog,
  onOpenExport,
  onSyncLetterboxd,
  view,
  setView,
  alpha,
  setAlpha,
  theme,
  setTheme,
  onGoToLibrary,
}) {
  const fileRef = useRef(null)
  const ratingsFileRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [azOpen, setAzOpen] = useState(false)
  const [condensed, setCondensed] = useState(false)

  // موقع اسکرول به پایین، هدر جمع‌وجورتر بشه (زیرعنوان‌ها مخفی، پدینگ کمتر)
  // تا فضای بیشتری به محتوا بده.
  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 40)
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
        <button type="button" className="brand brand-clickable" onClick={onGoToLibrary} title="Back to Library">
          <img src="/logo.png" alt="Cinefilm Archive" className="brand-logo" />
          <div className="brand-text">
            <h1 className="brand-title">CINEFILM ARCHIVE</h1>
            <p className="brand-owner">Alireza Mazlaghani</p>
            <p className="brand-sub">
              {total} {section === 'digital-movie' ? 'digital movies' : section === 'digital-series' ? 'digital series' : 'physical films'}
            </p>
          </div>
        </button>

        <div className="actions">
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
                  onClick={() => {
                    onAddFilm()
                    setMenuOpen(false)
                  }}
                >
                  + Add Film
                </button>
              </div>
              <div className="header-menu-section">
                <div className="header-menu-section-title">Tools</div>
                <button
                  type="button"
                  onClick={() => {
                    onEnrichCatalog()
                    setMenuOpen(false)
                  }}
                  disabled={enrichingCatalog}
                  title="Fill missing posters, cast, genres, and other public metadata"
                >
                  <IconSparkles width={15} height={15} /> {enrichingCatalog ? 'Completing metadata…' : 'Fill missing details'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSyncLetterboxd()
                    setMenuOpen(false)
                  }}
                  title="Pull your own diary entries/reviews from your public Letterboxd RSS feed"
                >
                  <IconSparkles width={15} height={15} /> Sync Letterboxd Reviews
                </button>
              </div>

              <div className="header-menu-section">
                <div className="header-menu-section-title">Import / Export</div>
                <button
                  type="button"
                  onClick={() => {
                    fileRef.current?.click()
                    setMenuOpen(false)
                  }}
                >
                  <IconUpload width={15} height={15} /> Import Excel
                </button>
                <a className="header-menu-link" href="/api/template" onClick={() => setMenuOpen(false)}>
                  <IconDownload width={15} height={15} /> Download Template
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onOpenExport()
                    setMenuOpen(false)
                  }}
                  title="Export Catalog / PDF / Excel Backup"
                >
                  <IconDownload width={15} height={15} /> Export / Backup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ratingsFileRef.current?.click()
                    setMenuOpen(false)
                  }}
                  title="Import ratings and watched status from a Letterboxd or IMDb export CSV"
                >
                  <IconUpload width={15} height={15} /> Import Ratings (Letterboxd/IMDb)
                </button>
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

        <button
          type="button"
          className="btn btn-ghost filters-toggle"
          onClick={() => {
            setFiltersOpen((v) => !v)
            setMenuOpen(false)
            setAzOpen(false)
          }}
          aria-expanded={filtersOpen}
        >
          <IconFilter width={14} height={14} /> Filters
        </button>

        <div className={filtersOpen ? 'controls-filters open' : 'controls-filters'}>
          <select className="select" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <label className="loan-filter">
            <input type="checkbox" checked={loanedOnly} onChange={(e) => setLoanedOnly(e.target.checked)} />
            Loaned only
          </label>

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

          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="random">Random</option>
            <option value="title_az">A–Z</option>
            <option value="shelf">By shelf</option>
            <option value="year_desc">Newest</option>
            <option value="year_asc">Oldest</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
      </div>
    </header>
  )
}
