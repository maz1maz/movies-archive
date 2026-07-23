import { useEffect } from 'react'
import {
  IconClose,
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
} from './icons.jsx'

export default function StatsModal({ films, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

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

  // Format breakdown
  const formatCounts = {}
  films.forEach((f) => {
    const fmt = f.format || 'Blu-ray'
    formatCounts[fmt] = (formatCounts[fmt] || 0) + 1
  })

  // Loaned films
  const loanedFilms = films.filter((f) => f.borrowedTo)

  // Genre breakdown
  const genreCounts = {}
  films.forEach((f) => {
    ;(f.genre || []).forEach((g) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1
    })
  })
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  // Shelf breakdown
  const shelfCounts = {}
  films.forEach((f) => {
    const sh = f.shelf ? `Shelf ${f.shelf}` : 'Unassigned'
    shelfCounts[sh] = (shelfCounts[sh] || 0) + 1
  })
  const topShelves = Object.entries(shelfCounts).sort((a, b) => a[0].localeCompare(b[0]))

  // Top Directors
  const directorCounts = {}
  films.forEach((f) => {
    if (f.director) directorCounts[f.director] = (directorCounts[f.director] || 0) + 1
  })
  const topDirectors = Object.entries(directorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Top Actors (از فیلد cast — می‌تونه آرایه‌ی رشته یا آبجکت باشه)
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

  // تایم‌لاین دهه‌ها
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

  // فیزیکی/دیجیتال و فیلم/سریال
  const physicalCount = films.filter((f) => f.mediaType !== 'digital').length
  const digitalCount = films.filter((f) => f.mediaType === 'digital').length
  const movieCount = films.filter((f) => f.itemType !== 'series').length
  const seriesCount = films.filter((f) => f.itemType === 'series').length

  // فکت‌های جالب: قدیمی‌ترین/جدیدترین، طولانی‌ترین/کوتاه‌ترین
  const withYear = films.filter((f) => f.year)
  const oldest = withYear.length ? withYear.reduce((a, b) => (a.year < b.year ? a : b)) : null
  const newest = withYear.length ? withYear.reduce((a, b) => (a.year > b.year ? a : b)) : null
  const withRuntime = films.filter((f) => f.runtime)
  const longest = withRuntime.length ? withRuntime.reduce((a, b) => (a.runtime > b.runtime ? a : b)) : null
  const shortest = withRuntime.length ? withRuntime.reduce((a, b) => (a.runtime < b.runtime ? a : b)) : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-stats" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        <div className="stats-header">
          <h2><IconBarChart width={18} height={18} /> Archive Statistics &amp; Analytics</h2>
          <p className="stats-sub">Complete breakdown of your physical + digital collection</p>
        </div>

        {/* Top Metric Cards */}
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

        {/* Decade Timeline */}
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

        {/* Formats & Genres Row */}
        <div className="stats-section-row">
          <div className="stats-box">
            <h3><IconDisc width={15} height={15} /> Physical Media Formats</h3>
            <div className="stats-bars">
              {Object.entries(formatCounts).map(([fmt, count]) => {
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

        {/* Physical/Digital & Movies/Series Row */}
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
                  <div key={actor} className="dir-stat-row">
                    <span className="dir-stat-rank">#{idx + 1}</span>
                    <span className="dir-stat-name">{actor}</span>
                    <span className="dir-stat-count">{count} films</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Shelves & Directors Row */}
        <div className="stats-section-row">
          <div className="stats-box">
            <h3><IconBookshelf width={15} height={15} /> Shelf Storage Breakdown</h3>
            <div className="stats-shelf-pills">
              {topShelves.map(([sh, count]) => (
                <div key={sh} className="shelf-stat-pill">
                  <span className="shelf-stat-name">{sh}</span>
                  <span className="shelf-stat-badge">{count} films</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-box">
            <h3><IconClapper width={15} height={15} /> Top Directors in Collection</h3>
            <div className="stats-directors-list">
              {topDirectors.map(([dir, count], idx) => (
                <div key={dir} className="dir-stat-row">
                  <span className="dir-stat-rank">#{idx + 1}</span>
                  <span className="dir-stat-name">{dir}</span>
                  <span className="dir-stat-count">{count} movies</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fun Facts */}
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
          </div>
        </div>
      </div>
    </div>
  )
}
