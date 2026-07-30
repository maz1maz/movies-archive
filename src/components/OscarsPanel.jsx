import { useMemo, useState } from 'react'
import { buildOscarData } from '../data/oscarData.js'
import { IconTrophy } from './icons.jsx'

const OSCAR_DATA = buildOscarData()
const ALL_YEARS = Object.keys(OSCAR_DATA).map(Number).sort((a, b) => b - a)

function findInArchive(films, title) {
  const t = (title || '').trim().toLowerCase()
  if (!t) return null
  return films.find((f) => (f.title || '').trim().toLowerCase() === t) || null
}

function NomineeRow({ nom, isMovieCategory, categoryLabel, archiveMovie, onOpenFilm, flat }) {
  const filmTitle = nom.title
  const inArchive = !!archiveMovie

  return (
    <div className={flat ? 'oscar-row oscar-row-flat' : 'oscar-row'}>
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
              فیلم: <em>{nom.title}</em>
            </span>
          )}
        </div>
      </div>
      <div className="oscar-row-actions">
        {nom.winner && !flat && <span className="tag oscar-winner-tag">برنده</span>}
        {inArchive ? (
          <button className="btn btn-sm btn-primary" onClick={() => onOpenFilm(archiveMovie)}>
            در آرشیو ✓
          </button>
        ) : (
          <span className="oscar-not-in-archive">در آرشیو نیست</span>
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
    const seen = new Map()
    Object.values(OSCAR_DATA).forEach((data) => {
      data.categories.forEach((cat) => {
        if (!seen.has(cat.name)) seen.set(cat.name, cat.persianName)
      })
    })
    return Array.from(seen.entries())
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

  // حالت «همه‌ی سال‌ها»: فقط برندگان (وگرنه لیست خیلی بزرگ می‌شه)
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
          آرشیو کامل برندگان و کاندیداهای اسکار. سال و دسته را انتخاب کنید و ببینید کدام‌یک از آن‌ها در آرشیو شخصی شما موجود است.
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field">
            <label>سال مراسم</label>
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="__all__">همه سال‌ها</option>
              {ALL_YEARS.map((y) => (
                <option key={y} value={y}>
                  سال {y} (دوره {OSCAR_DATA[y].ceremony})
                </option>
              ))}
            </select>
          </div>
          <div className="oscars-field">
            <label>دسته‌بندی</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">همه دسته‌ها</option>
              <option value="__winners_flat__">فقط برندگان</option>
              {categories.map(([name, persianName]) => (
                <option key={name} value={name}>
                  {persianName}
                </option>
              ))}
            </select>
          </div>
          <div className="oscars-field oscars-field-search">
            <label>جستجوی فیلم یا کاندیدا</label>
            <input className="input" placeholder="نام فیلم یا شخص..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {search.trim().length >= 2 ? (
        <section>
          <h2>نتایج جستجو</h2>
          {searchResults.length === 0 ? (
            <div className="empty">نتیجه‌ای یافت نشد.</div>
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
                    categoryLabel={`اسکار ${m.year} — ${m.category.persianName}`}
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
          <h2>برندگان همه‌ی سال‌ها{category && category !== '__winners_flat__' ? ` — ${categories.find(([n]) => n === category)?.[1] || ''}` : ''}</h2>
          <div className="card oscars-flat-list">
            {allYearsWinnerRows.length === 0 ? (
              <div className="empty">موردی یافت نشد.</div>
            ) : (
              allYearsWinnerRows.map((r, idx) => {
                const isMovieCategory = r.cat.name === 'Best Picture'
                const archiveMovie = findInArchive(films, r.nom.title)
                return (
                  <NomineeRow
                    key={idx}
                    nom={r.nom}
                    isMovieCategory={isMovieCategory}
                    categoryLabel={`سال ${r.year} — ${r.cat.persianName}`}
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
            برندگان اسکار سال {year} <span className="oscars-ceremony">(دوره {yearData?.ceremony})</span>
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
                    categoryLabel={cat.persianName}
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
            مراسم اسکار سال {year} <span className="oscars-ceremony">(دوره {yearData?.ceremony})</span>
          </h2>
          {categoriesToShow.map((cat) => (
            <div className="card oscars-category-card" key={cat.name}>
              <h3 className="oscars-category-title">
                {cat.persianName} <span className="oscars-category-en">— {cat.name}</span>
              </h3>
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
