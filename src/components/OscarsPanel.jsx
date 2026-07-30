import { useMemo, useState } from 'react'
import { buildOscarData } from '../data/oscarData.js'

const OSCAR_DATA = buildOscarData()
const ALL_YEARS = Object.keys(OSCAR_DATA).map(Number).sort((a, b) => b - a)

function findInArchive(films, title) {
  const t = (title || '').trim().toLowerCase()
  if (!t) return null
  return films.find((f) => (f.title || '').trim().toLowerCase() === t) || null
}

function NomineeRow({ nom, isMovieCategory, categoryLabel, archiveMovie, onOpenFilm, flat }) {
  const inArchive = !!archiveMovie

  return (
    <div
      className={`${flat ? 'oscar-row oscar-row-flat' : 'oscar-row'}${inArchive ? ' oscar-row-clickable' : ''}`}
      onClick={inArchive ? () => onOpenFilm(archiveMovie) : undefined}
    >
      <div className="oscar-row-main">
        {inArchive && archiveMovie.poster && (
          <div className="oscar-poster">
            <img src={archiveMovie.poster} loading="lazy" alt="" onError={(e) => (e.currentTarget.parentElement.style.display = 'none')} />
          </div>
        )}
        <div className="oscar-row-text">
          {flat && <span className="oscar-cat-label">{categoryLabel}</span>}
          <span className={`oscar-nominee-name${nom.winner ? ' oscar-winner' : ''}`}>
            {nom.winner ? '🏆 ' : ''}
            {isMovieCategory ? nom.title : nom.name}
          </span>
          {!isMovieCategory && (
            <span className="oscar-film-sub">
              Film: <em>{nom.title}</em>
            </span>
          )}
        </div>
      </div>
      <div className="oscar-row-actions">
        {nom.winner && !flat && <span className="tag oscar-winner-tag">Winner</span>}
        {inArchive ? (
          <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); onOpenFilm(archiveMovie) }}>
            In Archive ✓
          </button>
        ) : (
          <span className="oscar-not-in-archive">Not in archive</span>
        )}
      </div>
    </div>
  )
}

export default function OscarsPanel({ films, onOpenFilm }) {
  const [year, setYear] = useState(String(ALL_YEARS[0]))
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const categories = useMemo(() => {
    const seen = new Set()
    Object.values(OSCAR_DATA).forEach((data) => {
      data.categories.forEach((cat) => seen.add(cat.name))
    })
    return Array.from(seen)
  }, [])

  const isAllYears = year === '__all__'
  const yearData = !isAllYears ? OSCAR_DATA[year] : null

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    const matches = []
    for (const y in OSCAR_DATA) {
      OSCAR_DATA[y].categories.forEach((cat) => {
        cat.nominees.forEach((nom) => {
          const titleMatch = (nom.title || '').toLowerCase().includes(q)
          const nameMatch = (nom.name || '').toLowerCase().includes(q)
          if (titleMatch || nameMatch) {
            matches.push({ year: y, ceremony: OSCAR_DATA[y].ceremony, category: cat, nominee: nom })
          }
        })
      })
    }
    matches.sort((a, b) => b.year - a.year)
    return matches.slice(0, 60)
  }, [search])

  // "All years" mode: winners only (otherwise the list would be huge)
  const allYearsWinnerRows = useMemo(() => {
    if (!isAllYears) return []
    const rows = []
    ALL_YEARS.forEach((y) => {
      const data = OSCAR_DATA[y]
      data.categories.forEach((cat) => {
        if (category && cat.name !== category) return
        const winner = cat.nominees.find((n) => n.winner)
        if (!winner) return
        rows.push({ year: y, cat, nom: winner })
      })
    })
    return rows
  }, [isAllYears, category])

  let categoriesToShow = []
  if (!isAllYears && yearData) {
    categoriesToShow = category ? yearData.categories.filter((c) => c.name === category) : yearData.categories
  }

  const showWinnersFlat = category === '__winners_flat__'

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          Full archive of Academy Award winners and nominees. Pick a year and category to see which of them are already in your personal archive.
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field">
            <label>Ceremony year</label>
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="__all__">All years</option>
              {ALL_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y} (ceremony {OSCAR_DATA[y].ceremony})
                </option>
              ))}
            </select>
          </div>
          <div className="oscars-field">
            <label>Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              <option value="__winners_flat__">Winners only</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="oscars-field oscars-field-search">
            <label>Search film or nominee</label>
            <input className="input" placeholder="Film or person name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {search.trim().length >= 2 ? (
        <section>
          <h2>Search results</h2>
          {searchResults.length === 0 ? (
            <div className="empty">No results found.</div>
          ) : (
            <div className="card oscars-flat-list">
              {searchResults.map((m, idx) => {
                const isMovieCategory = m.category.name === 'Best Picture'
                const archiveMovie = findInArchive(films, m.nominee.title)
                return (
                  <NomineeRow
                    key={idx}
                    nom={m.nominee}
                    isMovieCategory={isMovieCategory}
                    categoryLabel={`${m.year} — ${m.category.name}`}
                    archiveMovie={archiveMovie}
                    onOpenFilm={onOpenFilm}
                    flat
                  />
                )
              })}
            </div>
          )}
        </section>
      ) : isAllYears ? (
        <section>
          <h2>Winners across all years{category && category !== '__winners_flat__' ? ` — ${category}` : ''}</h2>
          <div className="card oscars-flat-list">
            {allYearsWinnerRows.length === 0 ? (
              <div className="empty">Nothing found.</div>
            ) : (
              allYearsWinnerRows.map((r, idx) => {
                const isMovieCategory = r.cat.name === 'Best Picture'
                const archiveMovie = findInArchive(films, r.nom.title)
                return (
                  <NomineeRow
                    key={idx}
                    nom={r.nom}
                    isMovieCategory={isMovieCategory}
                    categoryLabel={`${r.year} — ${r.cat.name}`}
                    archiveMovie={archiveMovie}
                    onOpenFilm={onOpenFilm}
                    flat
                  />
                )
              })
            )}
          </div>
        </section>
      ) : showWinnersFlat ? (
        <section>
          <h2 className="oscars-year-title">
            {year} Oscar winners <span className="oscars-ceremony">(ceremony {yearData?.ceremony})</span>
          </h2>
          <div className="card oscars-flat-list">
            {yearData?.categories
              .map((cat) => ({ cat, winner: cat.nominees.find((n) => n.winner) }))
              .filter((x) => x.winner)
              .map(({ cat, winner }, idx) => {
                const isMovieCategory = cat.name === 'Best Picture'
                const archiveMovie = findInArchive(films, winner.title)
                return (
                  <NomineeRow
                    key={idx}
                    nom={winner}
                    isMovieCategory={isMovieCategory}
                    categoryLabel={cat.name}
                    archiveMovie={archiveMovie}
                    onOpenFilm={onOpenFilm}
                    flat
                  />
                )
              })}
          </div>
        </section>
      ) : (
        <section>
          <h2 className="oscars-year-title">
            {year} Academy Awards <span className="oscars-ceremony">(ceremony {yearData?.ceremony})</span>
          </h2>
          {categoriesToShow.map((cat) => (
            <div className="card oscars-category-card" key={cat.name}>
              <h3 className="oscars-category-title">{cat.name}</h3>
              <div className="oscars-nominee-list">
                {cat.nominees.map((nom, idx) => {
                  const isMovieCategory = cat.name === 'Best Picture'
                  const archiveMovie = findInArchive(films, nom.title)
                  return (
                    <NomineeRow
                      key={idx}
                      nom={nom}
                      isMovieCategory={isMovieCategory}
                      archiveMovie={archiveMovie}
                      onOpenFilm={onOpenFilm}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
