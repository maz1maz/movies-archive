import { useRef, useState } from 'react'
import AlphabetBar from './AlphabetBar.jsx'
import {
  IconArchive,
  IconSearch,
  IconUpload,
  IconDownload,
  IconSun,
  IconMoon,
  IconGrid,
  IconList,
  IconDisc,
  IconBookshelf,
  IconBarChart,
} from './icons.jsx'

function IconMore(props) {
  return (
    <svg width={props.width || 18} height={props.height || 18} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
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
  onRandomFilm,
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
  onImport,
  onAddFilm,
  onEnrichCatalog,
  enrichingCatalog,
  onOpenStats,
  onOpenExport,
  view,
  setView,
  alpha,
  setAlpha,
  theme,
  setTheme,
}) {
  const fileRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onImport(file)
    e.target.value = ''
  }

  return (
    <header className="header">
      {(menuOpen || filtersOpen) && (
        <div
          className="menu-backdrop"
          onClick={() => {
            setMenuOpen(false)
            setFiltersOpen(false)
          }}
        />
      )}
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-icon">
            <IconArchive width={19} height={19} />
          </span>
          <div>
            <h1 className="brand-title">CINEFILIO ARCHIVE</h1>
            <p className="brand-owner">Alireza Mazlaghani</p>
            <p className="brand-sub">{total} physical films</p>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAddFilm}
          >
            + Add Film
          </button>
          <button
            className="btn btn-primary actions-import-btn"
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload width={15} height={15} /> Import Excel
          </button>

          <div className="actions-more-wrap">
            <button
              type="button"
              className="btn btn-ghost menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              title="More actions"
            >
              <IconMore width={16} height={16} />
            </button>

            <div className={menuOpen ? 'actions-extra open' : 'actions-extra'}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  onEnrichCatalog()
                  setMenuOpen(false)
                }}
                disabled={enrichingCatalog}
                title="Fill missing posters, cast, genres, and other public metadata"
              >
                {enrichingCatalog ? 'Completing metadata…' : '✨ Fill missing details'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  onRandomFilm()
                  setMenuOpen(false)
                }}
              >
                🎲 Pick for tonight
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  onOpenStats()
                  setMenuOpen(false)
                }}
                title="View Collection Statistics & Analytics"
              >
                <IconBarChart width={15} height={15} /> Stats
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  onOpenExport()
                  setMenuOpen(false)
                }}
                title="Export Catalog / PDF / Excel Backup"
              >
                <IconDownload width={15} height={15} /> Export / Backup
              </button>
              <a className="btn btn-ghost" href="/api/template">
                <IconDownload width={15} height={15} /> Template
              </a>
            </div>
          </div>

          <button
            className="btn btn-ghost theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle dark / light"
          >
            {theme === 'dark' ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={onFile}
          />
        </div>
      </div>

      <div className="container alpha-wrap">
        <AlphabetBar alpha={alpha} setAlpha={setAlpha} />
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

        <button
          type="button"
          className="btn btn-ghost filters-toggle"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          <IconFilter width={14} height={14} /> Filters
        </button>

        <div className="view-toggle view-toggle-standalone" role="group" aria-label="View mode">
          <button
            type="button"
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
            title="Poster grid"
          >
            <IconGrid width={15} height={15} /> <span className="view-toggle-label">Thumbnails</span>
          </button>
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
            title="List"
          >
            <IconList width={15} height={15} /> <span className="view-toggle-label">List</span>
          </button>
          <button
            type="button"
            className={view === 'digital' ? 'active' : ''}
            onClick={() => setView('digital')}
            title="Digital copies"
          >
            <IconDisc width={15} height={15} /> <span className="view-toggle-label">Digital</span>
          </button>
          <button
            type="button"
            className={view === 'collections' ? 'active' : ''}
            onClick={() => setView('collections')}
            title="Collections (by hard drive)"
          >
            <IconBookshelf width={15} height={15} /> <span className="view-toggle-label">Collections</span>
          </button>
        </div>

        <div className={filtersOpen ? 'controls-filters open' : 'controls-filters'}>
          <select
            className="select"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          >
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
          <select
            className="select"
            value={decade}
            onChange={(e) => setDecade(e.target.value)}
          >
            <option value="">All decades</option>
            {decades.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>

          <select
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
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
