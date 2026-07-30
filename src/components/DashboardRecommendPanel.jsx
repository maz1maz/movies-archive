import { useMemo, useState } from 'react'
import DashboardPosterCard from './DashboardPosterCard.jsx'
import { IconClapper } from './icons.jsx'

const MODES = [
  { key: 'smart', label: 'Smart Pick' },
  { key: 'random', label: 'Random' },
  { key: 'top', label: 'Top Rated' },
  { key: 'short', label: 'Short' },
  { key: 'long', label: 'Long' },
  { key: 'old', label: 'Classic' },
  { key: 'new', label: 'Recent' },
]

function pick(films, mode) {
  if (!films.length) return null
  const withRating = films.filter((f) => typeof f.rating === 'number')
  const withRuntime = films.filter((f) => f.runtime)
  const withYear = films.filter((f) => f.year)

  switch (mode) {
    case 'random':
      return films[Math.floor(Math.random() * films.length)]
    case 'top': {
      const pool = withRating.length ? withRating : films
      const sorted = [...pool].sort((a, b) => (b.rating || 0) - (a.rating || 0))
      const topN = sorted.slice(0, Math.max(1, Math.round(sorted.length * 0.1)))
      return topN[Math.floor(Math.random() * topN.length)]
    }
    case 'short': {
      const pool = withRuntime.length ? withRuntime : films
      const sorted = [...pool].sort((a, b) => (a.runtime || 999) - (b.runtime || 999))
      return sorted[Math.floor(Math.random() * Math.min(5, sorted.length))]
    }
    case 'long': {
      const pool = withRuntime.length ? withRuntime : films
      const sorted = [...pool].sort((a, b) => (b.runtime || 0) - (a.runtime || 0))
      return sorted[Math.floor(Math.random() * Math.min(5, sorted.length))]
    }
    case 'old': {
      const pool = withYear.length ? withYear : films
      const sorted = [...pool].sort((a, b) => (a.year || 9999) - (b.year || 9999))
      return sorted[Math.floor(Math.random() * Math.min(10, sorted.length))]
    }
    case 'new': {
      const pool = withYear.length ? withYear : films
      const sorted = [...pool].sort((a, b) => (b.year || 0) - (a.year || 0))
      return sorted[Math.floor(Math.random() * Math.min(10, sorted.length))]
    }
    case 'smart':
    default: {
      // Prefer unwatched, higher-rated films; falls back to the whole archive if everything is watched
      const unwatched = films.filter((f) => !f.watched)
      const pool = unwatched.length ? unwatched : films
      const weighted = [...pool].sort((a, b) => (b.rating || 0) - (a.rating || 0))
      const topPool = weighted.slice(0, Math.max(1, Math.round(weighted.length * 0.25)))
      return topPool[Math.floor(Math.random() * topPool.length)]
    }
  }
}

function findSimilar(films, target, limit = 12) {
  if (!target) return []
  const targetGenres = new Set(target.genre || [])
  return films
    .filter((f) => f.id !== target.id)
    .map((f) => {
      const shared = (f.genre || []).filter((g) => targetGenres.has(g)).length
      const sameDirector = f.director && f.director === target.director ? 1 : 0
      return { film: f, score: shared * 2 + sameDirector }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.film.rating || 0) - (a.film.rating || 0))
    .slice(0, limit)
    .map((x) => x.film)
}

export default function DashboardRecommendPanel({ films, onOpenFilm }) {
  const [suggestion, setSuggestion] = useState(null)
  const [lastMode, setLastMode] = useState(null)
  const [similarQuery, setSimilarQuery] = useState('')

  const handlePick = (mode) => {
    setLastMode(mode)
    setSuggestion(pick(films, mode))
  }

  const matchedTarget = useMemo(() => {
    const q = similarQuery.trim().toLowerCase()
    if (q.length < 2) return null
    return films.find((f) => (f.title || '').toLowerCase().includes(q)) || null
  }, [films, similarQuery])

  const similarResults = useMemo(() => findSimilar(films, matchedTarget), [films, matchedTarget])

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">Not sure what to watch tonight? Pick a mood and get a suggestion from your own archive.</p>
        <div className="row row-wrap" style={{ gap: 8 }}>
          {MODES.map((m) => (
            <button key={m.key} className={`btn ${lastMode === m.key ? 'btn-primary' : ''}`} onClick={() => handlePick(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {suggestion && (
        <section>
          <h2>Tonight's pick</h2>
          <div className="grid" style={{ maxWidth: 220 }}>
            <DashboardPosterCard
              title={suggestion.title}
              subtitle={[suggestion.year, suggestion.director].filter(Boolean).join(' — ')}
              poster={suggestion.poster}
              inArchive
              clickable
              showMissingBadge={false}
              onClick={() => onOpenFilm(suggestion)}
            />
          </div>
        </section>
      )}

      <div className="card oscars-controls" style={{ marginTop: 24 }}>
        <p className="oscars-intro">
          <IconClapper width={14} height={14} style={{ verticalAlign: 'text-bottom', marginLeft: 6 }} />
          Find films similar to one you already love (matched by shared genres and director).
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field oscars-field-search">
            <label>Film title</label>
            <input
              className="input"
              placeholder="e.g. Interstellar"
              value={similarQuery}
              onChange={(e) => setSimilarQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {similarQuery.trim().length >= 2 && (
        <section>
          <h2>{matchedTarget ? `Similar to ${matchedTarget.title}` : 'No matching film found'}</h2>
          {matchedTarget && similarResults.length === 0 && <div className="empty">No close matches in your archive yet.</div>}
          {similarResults.length > 0 && (
            <div className="grid">
              {similarResults.map((f) => (
                <DashboardPosterCard
                  key={f.id}
                  title={f.title}
                  subtitle={[f.year, f.director].filter(Boolean).join(' — ')}
                  poster={f.poster}
                  inArchive
                  clickable
                  showMissingBadge={false}
                  onClick={() => onOpenFilm(f)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
