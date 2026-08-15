import {
  IconBarChart,
  IconClock,
  IconStar,
  IconHandshake,
  IconDisc,
  IconMasks,
  IconBookshelf,
  IconClapper,
  IconCheck,
  IconUser,
  IconArchive,
  IconSparkles,
  IconTV,
  IconBuilding,
} from './icons.jsx'
import { useRef, useState } from 'react'

// Overview tab of the Dashboard — same stats as the old Stats modal, shown
// inline as the landing view instead of jumping straight to Oscars.
export default function DashboardOverview({ films, onOpenFilm, onOpenPerson, isAdmin, onFilmsChanged }) {
  const totalFilms = films.length
  const totalRuntimeMins = films.reduce((acc, f) => acc + (f.runtime || 0), 0)
  const totalHours = Math.round(totalRuntimeMins / 60)
  const totalDays = (totalHours / 24).toFixed(1)

  const ratedFilms = films.filter((f) => typeof f.rating === 'number')
  const avgRating = ratedFilms.length
    ? (ratedFilms.reduce((acc, f) => acc + f.rating, 0) / ratedFilms.length).toFixed(2)
    : 'N/A'

  const myRatedFilms = films.filter((f) => f.myRating > 0)
  const avgMyRating = myRatedFilms.length
    ? (myRatedFilms.reduce((acc, f) => acc + f.myRating, 0) / myRatedFilms.length).toFixed(1)
    : null

  const watchedCount = films.filter((f) => f.watched).length
  const watchedPct = totalFilms ? Math.round((watchedCount / totalFilms) * 100) : 0

  const criterionCount = films.filter((f) => f.criterion).length
  const totalCopies = films.reduce((acc, f) => acc + (f.copies || 1), 0)

  const formatCounts = {}
  films.forEach((f) => {
    const fmt = f.format || 'Blu-ray'
    formatCounts[fmt] = (formatCounts[fmt] || 0) + 1
  })
  const topFormats = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const countryCounts = {}
  films.forEach((f) => {
    const c = f.country && f.country.trim()
    if (c) countryCounts[c] = (countryCounts[c] || 0) + 1
  })
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const loanedFilms = films.filter((f) => f.borrowedTo)

  const genreCounts = {}
  const toArr = (g) => (Array.isArray(g) ? g : (g || '').split(',').map((x) => x.trim()).filter(Boolean))
  films.forEach((f) => {
    toArr(f.genre).forEach((g) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1
    })
  })
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const shelfCounts = {}
  films.forEach((f) => {
    const sh = f.closet ? `Closet ${f.closet}` : 'Unassigned'
    shelfCounts[sh] = (shelfCounts[sh] || 0) + 1
  })
  const topShelves = Object.entries(shelfCounts).sort((a, b) => a[0].localeCompare(b[0]))

  const directorCounts = {}
  films.forEach((f) => {
    if (f.director) directorCounts[f.director] = (directorCounts[f.director] || 0) + 1
  })
  const topDirectors = Object.entries(directorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const actorCounts = {}
  films.forEach((f) => {
    ;(Array.isArray(f.cast) ? f.cast : []).forEach((a) => {
      const name = typeof a === 'object' ? a.name : a
      if (name) actorCounts[name] = (actorCounts[name] || 0) + 1
    })
  })
  const topActors = Object.entries(actorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const decadeCounts = {}
  films.forEach((f) => {
    if (f.year) {
      const d = Math.floor(f.year / 10) * 10
      decadeCounts[d] = (decadeCounts[d] || 0) + 1
    }
  })
  const decadeEntries = Object.entries(decadeCounts)
    .map(([d, c]) => [parseInt(d, 10), c])
    .sort((a, b) => a[0] - b[0])
  const maxDecadeCount = decadeEntries.reduce((m, [, c]) => Math.max(m, c), 1)

  // شمارش تعداد فیلم/سریال زیر هر حرف الفبا — دقیقاً همون قانونی که تو
  // بقیه‌ی اپ برای سورت استفاده می‌شه: فقط "The" ابتدای عنوان نادیده گرفته
  // می‌شه، بقیه‌ی حروف دست‌نخورده می‌مونن.
  const letterCounts = {}
  films.forEach((f) => {
    const raw = (f.title || '').trim()
    if (!raw) return
    const sortable = /^the\s+/i.test(raw) ? raw.replace(/^the\s+/i, '') : raw
    const first = sortable.charAt(0).toUpperCase()
    const key = /[A-Z]/.test(first) ? first : '#'
    letterCounts[key] = (letterCounts[key] || 0) + 1
  })
  const ALPHABET_ORDER = ['#', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))]
  const letterEntries = ALPHABET_ORDER.filter((l) => letterCounts[l]).map((l) => [l, letterCounts[l]])
  const maxLetterCount = letterEntries.reduce((m, [, c]) => Math.max(m, c), 1)

  const physicalCount = films.filter((f) => f.mediaType !== 'digital').length
  const digitalCount = films.filter((f) => f.mediaType === 'digital').length
  const movieCount = films.filter((f) => f.itemType !== 'series').length
  const seriesCount = films.filter((f) => f.itemType === 'series').length

  const withYear = films.filter((f) => f.year)
  const oldest = withYear.length ? withYear.reduce((a, b) => (a.year < b.year ? a : b)) : null
  const newest = withYear.length ? withYear.reduce((a, b) => (a.year > b.year ? a : b)) : null
  const withRuntime = films.filter((f) => f.runtime)
  const longest = withRuntime.length ? withRuntime.reduce((a, b) => (a.runtime > b.runtime ? a : b)) : null
  const shortest = withRuntime.length ? withRuntime.reduce((a, b) => (a.runtime < b.runtime ? a : b)) : null

  const highestRated = ratedFilms.length ? ratedFilms.reduce((a, b) => (a.rating > b.rating ? a : b)) : null
  const uniqueDirectors = new Set(films.map((f) => f.director).filter(Boolean)).size
  const uniqueCountries = Object.keys(countryCounts).length
  const uniqueGenres = Object.keys(genreCounts).length
  const avgRuntime = withRuntime.length
    ? Math.round(withRuntime.reduce((acc, f) => acc + f.runtime, 0) / withRuntime.length)
    : null
  const busiestDecade = decadeEntries.length
    ? decadeEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
    : null

  const ratingBuckets = [
    ['9.0+', (r) => r >= 9],
    ['8.0 – 8.9', (r) => r >= 8 && r < 9],
    ['7.0 – 7.9', (r) => r >= 7 && r < 8],
    ['6.0 – 6.9', (r) => r >= 6 && r < 7],
    ['Below 6.0', (r) => r < 6],
  ].map(([label, test]) => [label, ratedFilms.filter((f) => test(f.rating)).length])
  const maxBucket = ratingBuckets.reduce((m, [, c]) => Math.max(m, c), 1)

  // چند فیلم/ماه به آرشیو اضافه شده — برای دیدن روند رشد جمع‌آوری، آخرین
  // ۱۲ ماهی که واقعاً چیزی اضافه شده (نه ۱۲ ماه تقویمی خالی)
  const monthCounts = {}
  films.forEach((f) => {
    if (f.createdAt) {
      const m = String(f.createdAt).slice(0, 7)
      if (/^\d{4}-\d{2}$/.test(m)) monthCounts[m] = (monthCounts[m] || 0) + 1
    }
  })
  const monthEntries = Object.entries(monthCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
  const maxMonthCount = monthEntries.reduce((m, [, c]) => Math.max(m, c), 1)
  const monthLabel = (m) => {
    const [y, mo] = m.split('-')
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short' }) + ` '${y.slice(2)}`
  }

  // پخش‌شدن فیلم‌های دیجیتال روی هارددرایوها (یه فیلم می‌تونه چند درایو
  // داشته باشه، مثل "Drive 2, Drive 5")
  const driveCounts = {}
  films.forEach((f) => {
    if (f.mediaType === 'digital' && f.driveNumber) {
      String(f.driveNumber)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((d) => {
          driveCounts[d] = (driveCounts[d] || 0) + 1
        })
    }
  })
  const topDrives = Object.entries(driveCounts).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  )

  const studioCounts = {}
  films.forEach((f) => {
    const s = f.studio && f.studio.trim()
    if (s) studioCounts[s] = (studioCounts[s] || 0) + 1
  })
  const topStudios = Object.entries(studioCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  // بالاترین امتیازی که هنوز ندیدی — یه پیشنهاد عملی برای «امشب چی ببینم»
  const upNext = films
    .filter((f) => !f.watched && typeof f.rating === 'number')
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)

  const withCreated = films.filter((f) => f.createdAt)
  const mostRecentAdd = withCreated.length
    ? withCreated.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b))
    : null

  // اختلاف امتیاز خودت (از ۵) با امتیاز IMDb (از ۱۰، نرمال‌شده به ۵) —
  // کدوم فیلم رو بیشتر از منتقدها دوست داشتی، کدوم رو کمتر
  const bothRated = films.filter((f) => typeof f.rating === 'number' && f.myRating > 0)
  let lovedMore = null
  let lovedLess = null
  bothRated.forEach((f) => {
    const diff = f.myRating * 2 - f.rating
    if (!lovedMore || diff > lovedMore.myRating * 2 - lovedMore.rating) lovedMore = f
    if (!lovedLess || diff < lovedLess.myRating * 2 - lovedLess.rating) lovedLess = f
  })

  const openPerson = (name) => onOpenPerson && name && onOpenPerson(name)
  const openFilm = (film) => onOpenFilm && onOpenFilm(film)

  return (
    <div className="dashboard-overview">
      <div className="stats-cards-grid stats-cards-grid-6">
        <div className="stats-card">
          <span className="stats-card-icon"><IconClapper width={20} height={20} /></span>
          <div className="stats-card-num">{totalFilms}</div>
          <div className="stats-card-lbl">Total Titles</div>
        </div>

        <div className="stats-card">
          <span className="stats-card-icon"><IconClock width={20} height={20} /></span>
          <div className="stats-card-num">{totalHours} hrs</div>
          <div className="stats-card-lbl">{totalDays} Days Runtime</div>
        </div>

        <div className="stats-card">
          <span className="stats-card-icon"><IconStar width={20} height={20} /></span>
          <div className="stats-card-num">{avgRating} / 10</div>
          <div className="stats-card-lbl">Avg IMDb Rating</div>
        </div>

        <div className="stats-card">
          <span className="stats-card-icon"><IconStar width={20} height={20} /></span>
          <div className="stats-card-num">{avgMyRating ? `${avgMyRating} / 5` : '—'}</div>
          <div className="stats-card-lbl">Avg My Rating</div>
        </div>

        <div className="stats-card">
          <span className="stats-card-icon"><IconCheck width={20} height={20} /></span>
          <div className="stats-card-num">{watchedPct}%</div>
          <div className="stats-card-lbl">{watchedCount} Watched</div>
        </div>

        <div className="stats-card">
          <span className="stats-card-icon"><IconHandshake width={20} height={20} /></span>
          <div className="stats-card-num">{loanedFilms.length}</div>
          <div className="stats-card-lbl">Loaned Out</div>
        </div>
      </div>

      {upNext.length > 0 && (
        <div className="stats-box stats-box-spotlight">
          <h3><IconSparkles width={15} height={15} /> Up Next — Highest-Rated You Haven't Watched</h3>
          <div className="spotlight-row">
            {upNext.map((f) => (
              <button key={f.id} type="button" className="spotlight-item" onClick={() => openFilm(f)}>
                <div className="spotlight-poster">
                  {f.poster ? <img src={f.poster} alt="" /> : <span className="spotlight-poster-empty" />}
                  <span className="spotlight-rating"><IconStar width={10} height={10} /> {f.rating.toFixed(1)}</span>
                </div>
                <span className="spotlight-title">{f.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {decadeEntries.length > 1 && (
        <div className="stats-box">
          <h3><IconClock width={15} height={15} /> Decade Timeline</h3>
          <div className="stats-timeline">
            {decadeEntries.map(([decade, count]) => (
              <div key={decade} className="timeline-col">
                <span className="timeline-count">{count}</span>
                <div
                  className="timeline-bar"
                  style={{ height: `${Math.max(6, Math.round((count / maxDecadeCount) * 100))}%` }}
                />
                <span className="timeline-label">{decade}s</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {letterEntries.length > 1 && (
        <div className="stats-box">
          <h3><IconBookshelf width={15} height={15} /> Titles by Letter</h3>
          <div className="stats-timeline stats-timeline-alphabet">
            {letterEntries.map(([letter, count]) => (
              <div key={letter} className="timeline-col">
                <span className="timeline-count">{count}</span>
                <div
                  className="timeline-bar"
                  style={{ height: `${Math.max(6, Math.round((count / maxLetterCount) * 100))}%` }}
                />
                <span className="timeline-label">{letter}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {monthEntries.length > 1 && (
        <div className="stats-box">
          <h3><IconClock width={15} height={15} /> Collection Growth (last {monthEntries.length} months)</h3>
          <div className="stats-timeline stats-timeline-sm">
            {monthEntries.map(([m, count]) => (
              <div key={m} className="timeline-col">
                <span className="timeline-count">{count}</span>
                <div
                  className="timeline-bar"
                  style={{ height: `${Math.max(6, Math.round((count / maxMonthCount) * 100))}%` }}
                />
                <span className="timeline-label">{monthLabel(m)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats-section-row">
        <div className="stats-box">
          <h3><IconDisc width={15} height={15} /> Physical Media Formats</h3>
          <div className="stats-bars">
            {topFormats.map(([fmt, count]) => {
              const pct = Math.round((count / totalFilms) * 100)
              return (
                <div key={fmt} className="stats-bar-item">
                  <div className="stats-bar-meta">
                    <span className="stats-bar-name">{fmt}</span>
                    <span className="stats-bar-val">{count} films ({pct}%)</span>
                  </div>
                  <div className="stats-bar-track">
                    <div className="stats-bar-fill format-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="stats-box">
          <h3><IconMasks width={15} height={15} /> Top Genres</h3>
          <div className="stats-bars">
            {topGenres.map(([g, count]) => {
              const maxG = topGenres[0][1]
              const pct = Math.round((count / maxG) * 100)
              return (
                <div key={g} className="stats-bar-item">
                  <div className="stats-bar-meta">
                    <span className="stats-bar-name">{g}</span>
                    <span className="stats-bar-val">{count} films</span>
                  </div>
                  <div className="stats-bar-track">
                    <div className="stats-bar-fill genre-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="stats-section-row">
        <div className="stats-box">
          <h3><IconArchive width={15} height={15} /> Top Countries</h3>
          <div className="stats-bars">
            {topCountries.length === 0 ? (
              <div className="cine-empty">No country data yet</div>
            ) : (
              topCountries.map(([country, count]) => {
                const maxC = topCountries[0][1]
                const pct = Math.round((count / maxC) * 100)
                return (
                  <div key={country} className="stats-bar-item">
                    <div className="stats-bar-meta">
                      <span className="stats-bar-name">{country}</span>
                      <span className="stats-bar-val">{count} films</span>
                    </div>
                    <div className="stats-bar-track">
                      <div className="stats-bar-fill country-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="stats-box">
          <h3><IconStar width={15} height={15} /> Rating Distribution</h3>
          <div className="stats-bars">
            {ratingBuckets.map(([label, count]) => {
              const pct = Math.round((count / maxBucket) * 100)
              return (
                <div key={label} className="stats-bar-item">
                  <div className="stats-bar-meta">
                    <span className="stats-bar-name">{label}</span>
                    <span className="stats-bar-val">{count} films</span>
                  </div>
                  <div className="stats-bar-track">
                    <div className="stats-bar-fill format-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="stats-section-row">
        <div className="stats-box">
          <h3><IconArchive width={15} height={15} /> Physical vs Digital</h3>
          <div className="stats-split">
            <div className="stats-split-bar">
              <div
                className="stats-split-fill stats-split-a"
                style={{ width: `${totalFilms ? Math.round((physicalCount / totalFilms) * 100) : 0}%` }}
              />
            </div>
            <div className="stats-split-legend">
              <span><i className="dot dot-a" />Physical · {physicalCount}</span>
              <span><i className="dot dot-b" />Digital · {digitalCount}</span>
            </div>
          </div>
          <h3 className="stats-split-second-title">Movies vs Series</h3>
          <div className="stats-split">
            <div className="stats-split-bar">
              <div
                className="stats-split-fill stats-split-a"
                style={{ width: `${totalFilms ? Math.round((movieCount / totalFilms) * 100) : 0}%` }}
              />
            </div>
            <div className="stats-split-legend">
              <span><i className="dot dot-a" />Movies · {movieCount}</span>
              <span><i className="dot dot-b" />Series · {seriesCount}</span>
            </div>
          </div>
        </div>

        <div className="stats-box">
          <h3><IconUser width={15} height={15} /> Top Actors in Collection</h3>
          <div className="stats-directors-list">
            {topActors.length === 0 ? (
              <div className="cine-empty">No cast data yet</div>
            ) : (
              topActors.map(([actor, count], idx) => (
                <button key={actor} type="button" className="dir-stat-row dir-stat-row-clickable" onClick={() => openPerson(actor)}>
                  <span className="dir-stat-rank">#{idx + 1}</span>
                  <span className="dir-stat-name">{actor}</span>
                  <span className="dir-stat-count">{count} films</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="stats-section-row">
        <div className="stats-box">
          <h3><IconBookshelf width={15} height={15} /> Closet Storage Breakdown</h3>
          <div className="stats-shelf-pills">
            {topShelves.length === 0 ? (
              <div className="cine-empty">No closet data yet</div>
            ) : (
              topShelves.map(([sh, count]) => (
                <div key={sh} className="shelf-stat-pill">
                  <span className="shelf-stat-name">{sh}</span>
                  <span className="shelf-stat-badge">{count} films</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="stats-box">
          <h3><IconClapper width={15} height={15} /> Top Directors in Collection</h3>
          <div className="stats-directors-list">
            {topDirectors.map(([dir, count], idx) => (
              <button key={dir} type="button" className="dir-stat-row dir-stat-row-clickable" onClick={() => openPerson(dir)}>
                <span className="dir-stat-rank">#{idx + 1}</span>
                <span className="dir-stat-name">{dir}</span>
                <span className="dir-stat-count">{count} movies</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {(topDrives.length > 0 || topStudios.length > 0) && (
        <div className="stats-section-row">
          <div className="stats-box">
            <h3><IconTV width={15} height={15} /> Digital Drive Breakdown</h3>
            <div className="stats-shelf-pills">
              {topDrives.length === 0 ? (
                <div className="cine-empty">No digital drive data yet</div>
              ) : (
                topDrives.map(([d, count]) => (
                  <div key={d} className="shelf-stat-pill">
                    <span className="shelf-stat-name">{d}</span>
                    <span className="shelf-stat-badge">{count} items</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="stats-box">
            <h3><IconBuilding width={15} height={15} /> Top Studios &amp; Networks</h3>
            <div className="stats-bars">
              {topStudios.length === 0 ? (
                <div className="cine-empty">No studio data yet</div>
              ) : (
                topStudios.map(([studio, count]) => {
                  const maxS = topStudios[0][1]
                  const pct = Math.round((count / maxS) * 100)
                  return (
                    <div key={studio} className="stats-bar-item">
                      <div className="stats-bar-meta">
                        <span className="stats-bar-name">{studio}</span>
                        <span className="stats-bar-val">{count} films</span>
                      </div>
                      <div className="stats-bar-track">
                        <div className="stats-bar-fill country-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="stats-box">
        <h3><IconStar width={15} height={15} /> Fun Facts</h3>
        <div className="stats-facts-grid">
          {oldest && (
            <div className="fact-item">
              <span className="fact-lbl">Oldest film</span>
              <span className="fact-val">{oldest.title} ({oldest.year})</span>
            </div>
          )}
          {newest && (
            <div className="fact-item">
              <span className="fact-lbl">Newest film</span>
              <span className="fact-val">{newest.title} ({newest.year})</span>
            </div>
          )}
          {longest && (
            <div className="fact-item">
              <span className="fact-lbl">Longest runtime</span>
              <span className="fact-val">{longest.title} ({longest.runtime} min)</span>
            </div>
          )}
          {shortest && (
            <div className="fact-item">
              <span className="fact-lbl">Shortest runtime</span>
              <span className="fact-val">{shortest.title} ({shortest.runtime} min)</span>
            </div>
          )}
          <div className="fact-item">
            <span className="fact-lbl">Criterion Collection editions</span>
            <span className="fact-val">{criterionCount}</span>
          </div>
          <div className="fact-item">
            <span className="fact-lbl">Total physical copies owned</span>
            <span className="fact-val">{totalCopies}</span>
          </div>
          {highestRated && (
            <div className="fact-item">
              <span className="fact-lbl">Highest IMDb rating</span>
              <span className="fact-val">{highestRated.title} ({highestRated.rating.toFixed(1)})</span>
            </div>
          )}
          <div className="fact-item">
            <span className="fact-lbl">Unique directors</span>
            <span className="fact-val">{uniqueDirectors}</span>
          </div>
          <div className="fact-item">
            <span className="fact-lbl">Countries represented</span>
            <span className="fact-val">{uniqueCountries}</span>
          </div>
          <div className="fact-item">
            <span className="fact-lbl">Genres represented</span>
            <span className="fact-val">{uniqueGenres}</span>
          </div>
          {avgRuntime && (
            <div className="fact-item">
              <span className="fact-lbl">Average runtime</span>
              <span className="fact-val">{avgRuntime} min</span>
            </div>
          )}
          {busiestDecade && (
            <div className="fact-item">
              <span className="fact-lbl">Busiest decade</span>
              <span className="fact-val">{busiestDecade[0]}s ({busiestDecade[1]} films)</span>
            </div>
          )}
          {mostRecentAdd && (
            <button type="button" className="fact-item fact-item-clickable" onClick={() => openFilm(mostRecentAdd)}>
              <span className="fact-lbl">Most recently added</span>
              <span className="fact-val">{mostRecentAdd.title}</span>
            </button>
          )}
          {lovedMore && lovedMore.myRating * 2 > lovedMore.rating && (
            <button type="button" className="fact-item fact-item-clickable" onClick={() => openFilm(lovedMore)}>
              <span className="fact-lbl">You loved it more than critics</span>
              <span className="fact-val">{lovedMore.title} (you {lovedMore.myRating}/5 · IMDb {lovedMore.rating.toFixed(1)})</span>
            </button>
          )}
          {lovedLess && lovedLess.myRating * 2 < lovedLess.rating && (
            <button type="button" className="fact-item fact-item-clickable" onClick={() => openFilm(lovedLess)}>
              <span className="fact-lbl">Critics loved it more than you</span>
              <span className="fact-val">{lovedLess.title} (you {lovedLess.myRating}/5 · IMDb {lovedLess.rating.toFixed(1)})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
