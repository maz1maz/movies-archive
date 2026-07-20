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
} from './icons.jsx'

export default function Header({
  query,
  setQuery,
  genre,
  setGenre,
  genres,
  decade,
  setDecade,
  decades,
  sort,
  setSort,
  total,
  onImport,
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
    e.target.value = '' // allow re-selecting the same file
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-icon">
            <IconArchive width={19} height={19} />
          </span>
          <div>
            <h1 className="brand-title">My Film Archive</h1>
            <p className="brand-sub">{total} films</p>
          </div>
        </div>

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload width={15} height={15} /> Import Excel
          </button>
          <a className="btn btn-ghost" href="/api/template">
            <IconDownload width={15} height={15} /> Download Template
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
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
            title="Poster grid"
          >
            <IconGrid width={15} height={15} /> Posters
          </button>
          <button
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
