import { useMemo, useState } from 'react'
import { buildOscarData } from '../data/oscarData.js'
import DashboardPosterCard from './DashboardPosterCard.jsx'

const OSCAR_DATA = buildOscarData()
const ALL_YEARS = Object.keys(OSCAR_DATA).map(Number).sort((a, b) => b - a)

function findInArchive(films, title) {
  const t = (title || '').trim().toLowerCase()
  if (!t) return null
  return films.find((f) => (f.title || '').trim().toLowerCase() === t) || null
}

function nomineeCardProps(nom, isMovieCategory, films, extraSubtitle) {
  const archiveMovie = findInArchive(films, nom.title)
  const inArchive = !!archiveMovie
  const mainTitle = isMovieCategory ? nom.title : nom.name
  const subtitleParts = []
  if (!isMovieCategory) subtitleParts.push(nom.title)
  if (extraSubtitle) subtitleParts.push(extraSubtitle)
  return {
    title: mainTitle,
    subtitle: subtitleParts.join(' — '),
    poster: inArchive ? archiveMovie.poster : null,
    badgeText: nom.winner ? '🏆 WINNER' : null,
    badgeVariant: 'winner',
    inArchive,
    archiveMovie,
  }
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

  const renderGrid = (items) => (
    <div className="grid">
      {items.map((props, idx) => (
        <DashboardPosterCard
          key={idx}
          title={props.title}
          subtitle={props.subtitle}
          poster={props.poster}
          badgeText={props.badgeText}
          badgeVariant={props.badgeVariant}
          inArchive={props.inArchive}
          onClick={() => onOpenFilm(props.archiveMovie)}
        />
      ))}
    </div>
  )

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
            renderGrid(
              searchResults.map((m) =>
                nomineeCardProps(m.nominee, m.category.name === 'Best Picture', films, `${m.year} — ${m.category.name}`)
              )
            )
          )}
        </section>
      ) : isAllYears ? (
        <section>
          <h2>Winners across all years{category && category !== '__winners_flat__' ? ` — ${category}` : ''}</h2>
          {allYearsWinnerRows.length === 0 ? (
            <div className="empty">Nothing found.</div>
          ) : (
            renderGrid(
              allYearsWinnerRows.map((r) =>
                nomineeCardProps(r.nom, r.cat.name === 'Best Picture', films, `${r.year} — ${r.cat.name}`)
              )
            )
          )}
        </section>
      ) : showWinnersFlat ? (
        <section>
          <h2 className="oscars-year-title">
            {year} Oscar winners <span className="oscars-ceremony">(ceremony {yearData?.ceremony})</span>
          </h2>
          {renderGrid(
            (yearData?.categories || [])
              .map((cat) => ({ cat, winner: cat.nominees.find((n) => n.winner) }))
              .filter((x) => x.winner)
              .map(({ cat, winner }) => nomineeCardProps(winner, cat.name === 'Best Picture', films, cat.name))
          )}
        </section>
      ) : (
        <section>
          <h2 className="oscars-year-title">
            {year} Academy Awards <span className="oscars-ceremony">(ceremony {yearData?.ceremony})</span>
          </h2>
          {categoriesToShow.map((cat) => (
            <div className="oscars-category-block" key={cat.name}>
              <h3 className="oscars-category-title">{cat.name}</h3>
              {renderGrid(cat.nominees.map((nom) => nomineeCardProps(nom, cat.name === 'Best Picture', films)))}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
