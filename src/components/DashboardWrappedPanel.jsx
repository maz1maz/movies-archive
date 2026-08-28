import { useMemo } from 'react'

const toArr = (g) => (Array.isArray(g) ? g : (g || '').split(',').map((x) => x.trim()).filter(Boolean))

function topEntry(counts) {
  const entries = Object.entries(counts)
  if (!entries.length) return null
  return entries.sort((a, b) => b[1] - a[1])[0]
}

export default function DashboardWrappedPanel({ films = [], onOpenPerson }) {
  const stats = useMemo(() => {
    const total = films.length
    const physical = films.filter((f) => f.mediaType !== 'digital').length
    const digital = total - physical

    const genreCounts = {}
    const directorCounts = {}
    const actorCounts = {}
    const decadeCounts = {}
    const studioCounts = {}
    let runtimeMinsSum = 0
    let runtimeCount = 0
    let ratingSum = 0
    let ratingCount = 0

    films.forEach((f) => {
      toArr(f.genre).forEach((g) => (genreCounts[g] = (genreCounts[g] || 0) + 1))
      if (f.director) directorCounts[f.director] = (directorCounts[f.director] || 0) + 1
      if (f.studio) studioCounts[f.studio] = (studioCounts[f.studio] || 0) + 1
      ;(Array.isArray(f.cast) ? f.cast : []).slice(0, 5).forEach((a) => {
        if (a) actorCounts[a] = (actorCounts[a] || 0) + 1
      })
      if (f.year) {
        const decade = `${Math.floor(f.year / 10) * 10}s`
        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1
      }
      if (f.runtime) {
        runtimeMinsSum += f.runtime
        runtimeCount++
      }
      if (f.myRating > 0) {
        ratingSum += f.myRating
        ratingCount++
      }
    })

    const topGenre = topEntry(genreCounts)
    const topDirector = topEntry(directorCounts)
    const topActor = topEntry(actorCounts)
    const topDecade = topEntry(decadeCounts)
    const topStudio = topEntry(studioCounts)

    const totalDays = Math.round((runtimeMinsSum / 60 / 24) * 10) / 10
    const avgRating = ratingCount ? (ratingSum / ratingCount).toFixed(1) : null

    return { total, physical, digital, topGenre, topDirector, topActor, topDecade, topStudio, totalDays, avgRating, uniqueGenres: Object.keys(genreCounts).length, uniqueDirectors: Object.keys(directorCounts).length }
  }, [films])

  const cards = [
    { label: 'Total in archive', value: stats.total.toLocaleString(), sub: `${stats.physical.toLocaleString()} Blu-ray · ${stats.digital.toLocaleString()} digital`, color: '#d4af37' },
    stats.topGenre && { label: 'Top genre', value: stats.topGenre[0], sub: `${stats.topGenre[1]} films · ${stats.uniqueGenres} genres total`, color: '#3f7cac' },
    stats.topDirector && {
      label: 'Top director',
      value: stats.topDirector[0],
      sub: `${stats.topDirector[1]} films in your archive`,
      color: '#a855f7',
      onClick: onOpenPerson ? () => onOpenPerson(stats.topDirector[0]) : null,
    },
    stats.topActor && {
      label: 'Most-seen actor',
      value: stats.topActor[0],
      sub: `appears in ${stats.topActor[1]} films`,
      color: '#f97316',
      onClick: onOpenPerson ? () => onOpenPerson(stats.topActor[0]) : null,
    },
    stats.topDecade && { label: 'Favorite decade', value: stats.topDecade[0], sub: `${stats.topDecade[1]} films from this decade`, color: '#22c55e' },
    stats.totalDays > 0 && { label: 'Total runtime', value: `${stats.totalDays} days`, sub: 'if you watched everything back to back', color: '#ec4899' },
    stats.avgRating && { label: 'Your average rating', value: `★ ${stats.avgRating}`, sub: 'across everything you\u2019ve rated', color: '#eab308' },
    stats.topStudio && { label: 'Top studio', value: stats.topStudio[0], sub: `${stats.topStudio[1]} films`, color: '#06b6d4' },
  ].filter(Boolean)

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          Your archive at a glance — not tied to a single year (most films don't have a "watched on" date logged),
          just the whole collection, Wrapped-style.
        </p>
      </div>
      <div className="wrapped-grid">
        {cards.map((c, i) => (
          <div
            key={i}
            className="wrapped-card"
            style={{ borderColor: c.color, cursor: c.onClick ? 'pointer' : 'default' }}
            onClick={c.onClick || undefined}
          >
            <div className="wrapped-card-label">{c.label}</div>
            <div className="wrapped-card-value" style={{ color: c.color }}>
              {c.value}
            </div>
            <div className="wrapped-card-sub">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
