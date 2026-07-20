import { useEffect, useState } from 'react'
import { IconClose } from './icons.jsx'

export default function FilmModal({ film, onSelectPerson, onClose }) {
  const [showAllCast, setShowAllCast] = useState(false)
  const [showAllCrew, setShowAllCrew] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!film) return null

  const formatRuntime = (min) => {
    if (!min) return ''
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const castList = Array.isArray(film.cast) ? film.cast : []
  const displayedCast = showAllCast ? castList : castList.slice(0, 5)

  const genreText = Array.isArray(film.genre) ? film.genre.slice(0, 3).join(', ') : film.genre || ''
  const runtimeText = formatRuntime(film.runtime)
  const metaSubParts = [film.year, genreText, runtimeText].filter(Boolean)

  const studioName = film.studio
  const mpaRating = film.rated || film.mpaa

  const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    (film.originalTitle || film.title) + ' official trailer'
  )}`

  const imdbUrl = film.imdbId
    ? `https://www.imdb.com/title/${film.imdbId}/`
    : `https://www.imdb.com/find/?q=${encodeURIComponent(film.title)}`

  const getActorPhoto = (actorObj, name) => {
    if (typeof actorObj === 'object' && actorObj?.photo) return actorObj.photo
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=334155&color=ffffff&bold=true&rounded=true`
  }

  const fullCrew = [
    { label: 'Director', value: film.director },
    { label: 'Writer', value: film.writer || film.director },
    { label: 'Producer', value: film.producer },
    { label: 'Musician', value: film.composer || film.musician },
    { label: 'Cinematography', value: film.cinematographer },
    { label: 'Country', value: film.country || 'USA' },
    { label: 'Runtime', value: film.runtime ? `${film.runtime} mins (${runtimeText})` : null },
  ].filter((item) => item.value)

  const displayedCrew = showAllCrew ? fullCrew : fullCrew.slice(0, 4)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-cine" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        {/* Title & Subtitle Header */}
        <div className="cine-title-block">
          <h2 className="cine-title">{film.title}</h2>
          {metaSubParts.length > 0 && (
            <p className="cine-subtitle">{metaSubParts.join(' | ')}</p>
          )}
        </div>

        {/* Main Body: Poster + Rearranged Gray Info Card */}
        <div className="cine-main-row">
          <div className="cine-poster-box">
            <img
              src={film.poster}
              alt={film.title}
              className="cine-poster-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="cine-poster-fallback">{film.title}</div>
          </div>

          <div className="cine-info-card">
            {/* Top Row: Synopsis (Left) & Archive Location Badge (Top Right) */}
            <div className="cine-info-top-row">
              <div className="cine-synopsis-box">
                <div className="cine-section-label">SYNOPSIS</div>
                <p className="cine-synopsis-text">
                  {film.synopsis ||
                    `${film.title} is a ${film.year || ''} ${genreText} film directed by ${
                      film.director || 'renowned filmmakers'
                    }.`}
                </p>
              </div>

              {(film.shelf || film.row) && (
                <div className="cine-shelf-badge">
                  <span className="shelf-icon">🗄️</span>
                  <span>
                    Shelf <strong>{film.shelf || '—'}</strong> / Row{' '}
                    <strong>{film.row || '—'}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Row: Studio Name (Left) + MPA Box + Black-text Clickable IMDb Badge */}
            <div className="cine-info-bottom-row">
              {studioName ? (
                <div className="cine-studio-header">
                  <span className="studio-icon">🏢</span>
                  <span className="studio-text">
                    <strong>{studioName}</strong> {film.year ? `(${film.year})` : ''}
                  </span>
                </div>
              ) : (
                <div />
              )}

              <div className="cine-info-badges">
                {/* Motion Picture Association (MPA) Badge */}
                {mpaRating && (
                  <div className="mpa-rating-box" title="Motion Picture Association (MPA) Rating">
                    <span className="mpa-tag-label">MPA</span>
                    <span className="mpa-tag-val">{mpaRating}</span>
                  </div>
                )}

                {/* IMDb Yellow Badge with Black Text & Clickable Link */}
                {typeof film.rating === 'number' && (
                  <a
                    href={imdbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="imdb-badge-cine clickable-imdb"
                    title="Click to view on IMDb"
                  >
                    <span className="imdb-pill">IMDb</span>
                    <span className="imdb-score-black">{film.rating.toFixed(1)}</span>
                    <span className="imdb-star-black">★</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 3 Columns: CAST | CREW | TRAILER */}
        <div className="cine-bottom-row">
          {/* CAST */}
          <div className="cine-col cine-col-cast">
            <div className="cine-col-header">
              <span className="cine-col-title">CAST</span>
              {castList.length > 5 && (
                <button
                  type="button"
                  className="cine-accordion-btn"
                  onClick={() => setShowAllCast(!showAllCast)}
                >
                  {showAllCast ? 'Show less ▴' : `View all (${castList.length}) ▾`}
                </button>
              )}
            </div>
            <div className={`cine-cast-grid ${showAllCast ? 'expanded' : ''}`}>
              {castList.length === 0 ? (
                <div className="cine-empty">No cast listed</div>
              ) : (
                displayedCast.map((actor, idx) => {
                  const name = typeof actor === 'object' ? actor.name : actor
                  const photoUrl = getActorPhoto(actor, name)
                  const character = typeof actor === 'object' ? actor.character : null
                  const initials = name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()

                  return (
                    <div
                      key={idx}
                      className="cine-cast-item clickable-person"
                      onClick={() => onSelectPerson && onSelectPerson(name)}
                      title={`See all films featuring ${name}`}
                    >
                      <div className="cine-actor-avatar-wrap">
                        <img
                          src={photoUrl}
                          alt={name}
                          className="cine-actor-img"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const fallback = e.currentTarget.nextElementSibling
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                        <div className="cine-actor-fallback" style={{ display: 'none' }}>
                          {initials}
                        </div>
                      </div>
                      <span className="cine-actor-name">{name}</span>
                      {character && (
                        <span className="cine-actor-character">{character}</span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* CREW */}
          <div className="cine-col cine-col-crew">
            <div className="cine-col-header">
              <span className="cine-col-title">CREW</span>
              {fullCrew.length > 4 && (
                <button
                  type="button"
                  className="cine-accordion-btn"
                  onClick={() => setShowAllCrew(!showAllCrew)}
                >
                  {showAllCrew ? 'Show less ▴' : `View all (${fullCrew.length}) ▾`}
                </button>
              )}
            </div>
            <div className={`cine-crew-table ${showAllCrew ? 'expanded' : ''}`}>
              {displayedCrew.map((item, idx) => {
                const isPerson = ['Director', 'Writer', 'Producer', 'Musician', 'Cinematography'].includes(item.label)
                return (
                  <div key={idx} className="cine-crew-row">
                    <span className="crew-key">{item.label}</span>
                    <span
                      className={`crew-val ${isPerson ? 'clickable-person-text' : ''}`}
                      onClick={() => {
                        if (isPerson && onSelectPerson && item.value) {
                          onSelectPerson(item.value)
                        }
                      }}
                      title={isPerson ? `See all films featuring ${item.value}` : ''}
                    >
                      {item.value}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* TRAILER */}
          <div className="cine-col cine-col-trailer">
            <div className="cine-col-title">TRAILER</div>
            <a
              href={trailerSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cine-trailer-card"
            >
              <div className="cine-trailer-media">
                <img src={film.poster} alt="Trailer" className="cine-trailer-bg" />
                <div className="cine-play-circle">
                  <span className="play-triangle">▶</span>
                </div>
                <div className="cine-hd-tag">F HD</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
