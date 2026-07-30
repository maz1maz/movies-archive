import { useMemo, useState } from 'react'
import { buildOscarData } from '../data/oscarData.js'
import DashboardPosterCard from './DashboardPosterCard.jsx'

const OSCAR_DATA = buildOscarData()
const ALL_YEARS = Object.keys(OSCAR_DATA).map(Number).sort((a, b) => b - a)

// Technical/craft Oscar categories — the "how it was made" side of things,
// as opposed to acting or Best Picture.
const CRAFT_CATEGORIES = [
  'Best Directing',
  'Best Cinematography',
  'Best Original Score',
  'Best Animated Feature Film',
  'Best International Feature Film',
]

function findInArchive(films, title) {
  const t = (title || '').trim().toLowerCase()
  if (!t) return null
  return films.find((f) => (f.title || '').trim().toLowerCase() === t) || null
}

function cardProps(nom, films, subtitleExtra) {
  const archiveMovie = findInArchive(films, nom.title)
  const inArchive = !!archiveMovie
  return {
    title: nom.name || nom.title,
    subtitle: [nom.name ? nom.title : null, subtitleExtra].filter(Boolean).join(' — '),
    poster: inArchive ? archiveMovie.poster : null,
    badgeText: nom.winner ? '🏆 WINNER' : null,
    inArchive,
    archiveMovie,
  }
}

export default function CraftsPanel({ films, onOpenFilm, onOpenPerson }) {
  const availableCategories = useMemo(
    () => CRAFT_CATEGORIES.filter((name) => Object.values(OSCAR_DATA).some((d) => d.categories.some((c) => c.name === name))),
    []
  )
  const [category, setCategory] = useState(availableCategories[0] || '')
  const [year, setYear] = useState('__all__')

  const isAllYears = year === '__all__'
  const isPersonCategory = category !== 'Best Animated Feature Film' && category !== 'Best International Feature Film'

  const allYearsRows = useMemo(() => {
    if (!isAllYears || !category) return []
    const rows = []
    ALL_YEARS.forEach((y) => {
      const cat = OSCAR_DATA[y].categories.find((c) => c.name === category)
      if (!cat) return
      const winner = cat.nominees.find((n) => n.winner)
      if (winner) rows.push({ year: y, nom: winner })
    })
    return rows
  }, [isAllYears, category])

  const yearRows = useMemo(() => {
    if (isAllYears || !category) return []
    const data = OSCAR_DATA[year]
    const cat = data?.categories.find((c) => c.name === category)
    return cat ? cat.nominees : []
  }, [isAllYears, year, category])

  const renderGrid = (items) => (
    <div className="grid">
      {items.map((props, idx) => (
        <DashboardPosterCard
          key={idx}
          title={props.title}
          subtitle={props.subtitle}
          poster={props.poster}
          badgeText={props.badgeText}
          badgeVariant="winner"
          inArchive={props.inArchive}
          clickable={isPersonCategory ? true : props.inArchive}
          showMissingBadge={isPersonCategory ? false : !props.inArchive}
          onClick={() => (isPersonCategory ? onOpenPerson(props.title) : onOpenFilm(props.archiveMovie))}
        />
      ))}
    </div>
  )

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          The craft side of the Oscars — directing, cinematography, score, and more. Click a card to open the film (or the person) if it's in your archive.
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field">
            <label>Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {availableCategories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="oscars-field">
            <label>Ceremony year</label>
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="__all__">All years (winners)</option>
              {ALL_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y} (ceremony {OSCAR_DATA[y].ceremony})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section>
        <h2>{category}{isAllYears ? ' — winners across all years' : ` — ${year}`}</h2>
        {isAllYears
          ? allYearsRows.length === 0
            ? <div className="empty">No data for this category.</div>
            : renderGrid(allYearsRows.map((r) => cardProps(r.nom, films, String(r.year))))
          : yearRows.length === 0
            ? <div className="empty">Not awarded this year.</div>
            : renderGrid(yearRows.map((nom) => cardProps(nom, films)))}
      </section>
    </div>
  )
}
