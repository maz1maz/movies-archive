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
    ? (
        ratedFilms.reduce((acc, f) => acc + f.rating, 0) / ratedFilms.length
      ).toFixed(2)
    : 'N/A'

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
  const topShelves = Object.entries(shelfCounts).sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  // Top Directors
  const directorCounts = {}
  films.forEach((f) => {
    if (f.director) {
      directorCounts[f.director] = (directorCounts[f.director] || 0) + 1
    }
  })
  const topDirectors = Object.entries(directorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-stats" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        <div className="stats-header">
          <h2><IconBarChart width={18} height={18} /> Archive Statistics &amp; Analytics</h2>
          <p className="stats-sub">Complete breakdown of your physical film collection</p>
        </div>

        {/* Top Metric Cards */}
        <div className="stats-cards-grid">
          <div className="stats-card">
            <span className="stats-card-icon"><IconClapper width={20} height={20} /></span>
            <div className="stats-card-num">{totalFilms}</div>
            <div className="stats-card-lbl">Total Movies</div>
          </div>

          <div className="stats-card">
            <span className="stats-card-icon"><IconClock width={20} height={20} /></span>
            <div className="stats-card-num">{totalHours} hrs</div>
            <div className="stats-card-lbl">{totalDays} Days Runtime</div>
          </div>

          <div className="stats-card">
            <span className="stats-card-icon"><IconStar width={20} height={20} /></span>
            <div className="stats-card-num">{avgRating} / 10</div>
            <div className="stats-card-lbl">Average Rating</div>
          </div>

          <div className="stats-card">
            <span className="stats-card-icon"><IconHandshake width={20} height={20} /></span>
            <div className="stats-card-num">{loanedFilms.length}</div>
            <div className="stats-card-lbl">Loaned Movies</div>
          </div>
        </div>

        {/* Formats & Shelves Row */}
        <div className="stats-section-row">
          {/* Formats */}
          <div className="stats-box">
            <h3><IconDisc width={15} height={15} /> Physical Media Formats</h3>
            <div className="stats-bars">
              {Object.entries(formatCounts).map(([fmt, count]) => {
                const pct = Math.round((count / totalFilms) * 100)
                return (
                  <div key={fmt} className="stats-bar-item">
                    <div className="stats-bar-meta">
                      <span className="stats-bar-name">{fmt}</span>
                      <span className="stats-bar-val">
                        {count} films ({pct}%)
                      </span>
                    </div>
                    <div className="stats-bar-track">
                      <div
                        className="stats-bar-fill format-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Genres */}
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
                      <div
                        className="stats-bar-fill genre-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Shelves Distribution & Top Directors */}
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
      </div>
    </div>
  )
}
