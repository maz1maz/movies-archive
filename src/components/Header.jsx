import { useRef } from 'react'
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
  IconBarChart,
} from './icons.jsx'

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

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onImport(file)
    e.target.value = ''
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-icon">
            <IconArchive width={19} height={19} />
          </span>
          <div>
            <h1 className="brand-title">CINEFILIO ARCHIVE</h1>
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
          <button type="button" className="btn btn-ghost" onClick={onRandomFilm}>
            🎲 Pick for tonight
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onOpenStats}
            title="View Collection Statistics & Analytics"
          >
            <IconBarChart width={15} height={15} /> Stats
          </button>
          <button
            className="btn btn-ghost"
            onClick={onOpenExport}
            title="Export Catalog / PDF / Excel Backup"
          >
            <IconDownload width={15} height={15} /> Export / Backup
          </button>
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload width={15} height={15} /> Import Excel
          </button>
          <a className="btn btn-ghost" href="/api/template">
            <IconDownload width={15} height={15} /> Template
          </a>
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

        <div className="view-toggle" role="group" aria-label="View mode">
            <button
            type="button"
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
            title="Poster grid"
          >
            <IconGrid width={15} height={15} /> Thumbnails
          </button>
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
            title="List"
          >
            <IconList width={15} height={15} /> List
          </button>
        </div>
      </div>
    </header>
  )
}
