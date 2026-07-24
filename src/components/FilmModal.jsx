import { useEffect, useState } from 'react'
import { IconClose, IconPin, IconHandshake, IconBuilding } from './icons.jsx'
import StarRating from './StarRating.jsx'
import ImageLightbox from './ImageLightbox.jsx'

export default function FilmModal({ film, films = [], onNavigate, onSelectPerson, onManageLoan, onClose, onRateFilm, panel = false }) {
  const [showAllCast, setShowAllCast] = useState(false)
  const [showAllCrew, setShowAllCrew] = useState(false)
  const [actorPhotos, setActorPhotos] = useState({})
  const [lightboxSrc, setLightboxSrc] = useState(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && films.length && onNavigate) {
        const i = films.findIndex((f) => f.id === film.id)
        const next = e.key === 'ArrowRight' ? (i + 1) % films.length : (i - 1 + films.length) % films.length
        onNavigate(films[next])
      }
    }
    window.addEventListener('keydown', onKey)
    // توی حالت panel (نمای split کنار گرید)، مودال جزئی از جریان عادی صفحه‌ست
    // و پس‌زمینه‌ی سمت راست (گرید) باید عادی و قابل‌اسکرول بمونه.
    if (!panel) document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      if (!panel) document.body.style.overflow = ''
    }
  }, [onClose, panel])

  // وقتی فیلم انتخاب‌شده عوض می‌شه (مثلاً با کلیک روی یکی از «فیلم‌های
  // مشابه» که خودش پایین پنل قرار داره)، اگه کاربر توی پنل اسکرول کرده
  // بود، اسکرول قدیمی می‌موند و فیلم جدید از وسط/پایین نشون داده می‌شد.
  // برای همین با هر تغییر فیلم، پنل رو به بالا برمی‌گردونیم.
  useEffect(() => {
    if (!panel) return
    const scrollParent = document.querySelector('.grid-split-detail')
    if (scrollParent) scrollParent.scrollTop = 0
  }, [film.id, panel])

  useEffect(() => {
    setLightboxSrc(null)
  }, [film.id])

  // عکس واقعی بازیگرها رو از ویکی‌پدیا می‌گیریم (کلید API لازم نداره).
  // نتیجه سمت سرور هم کش می‌شه، پس دفعات بعد سریع برمی‌گرده.
  useEffect(() => {
    const names = Array.isArray(film?.cast)
      ? film.cast.map((a) => (typeof a === 'object' ? a.name : a)).filter(Boolean)
      : []
    const toFetch = names.filter((n) => !(n in actorPhotos))
    if (toFetch.length === 0) return
    let cancelled = false
    toFetch.forEach(async (name) => {
      try {
        const res = await fetch(`/api/actor-photo?name=${encodeURIComponent(name)}`)
        const data = await res.json()
        if (!cancelled) {
          setActorPhotos((prev) => ({ ...prev, [name]: data.photo || null }))
        }
      } catch {
        if (!cancelled) setActorPhotos((prev) => ({ ...prev, [name]: null }))
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film?.id])

  if (!film) return null

  const formatRuntime = (min) => {
    if (!min) return ''
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const formatVotesK = (votes) => {
    if (!votes) return '688K'
    const clean = String(votes).replace(/,/g, '').trim()
    const num = parseInt(clean, 10)
    if (isNaN(num)) return votes
    if (num >= 1000000) {
      const m = (num / 1000000).toFixed(1)
      return (m.endsWith('.0') ? m.slice(0, -2) : m) + 'M'
    }
    if (num >= 1000) {
      return Math.round(num / 1000) + 'K'
    }
    return String(num)
  }

  const castList = Array.isArray(film.cast) ? film.cast : []
  const displayedCast = showAllCast ? castList : castList.slice(0, 5)

  const genreText = Array.isArray(film.genre) ? film.genre.slice(0, 3).join(', ') : film.genre || ''
  const runtimeText = formatRuntime(film.runtime)
  const metaSubParts = [film.year, genreText, runtimeText].filter(Boolean)

  const studioName = film.studio
  const mpaRating = film.rated || film.mpaa
  const mediaFormat = film.format || 'Blu-ray'

  const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    (film.originalTitle || film.title) + ' official trailer'
  )}`

  const imdbUrl = film.imdbId
    ? `https://www.imdb.com/title/${film.imdbId}/`
    : `https://www.imdb.com/find/?q=${encodeURIComponent(film.title)}`

  const getActorPhoto = (actorObj, name) => {
    if (typeof actorObj === 'object' && actorObj?.photo) return actorObj.photo
    if (actorPhotos[name]) return actorPhotos[name]
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
  const relatedFilms = films.filter((other) => {
    if (other.id === film.id) return false
    const a = Array.isArray(film.genre) ? film.genre : []
    const b = Array.isArray(other.genre) ? other.genre : []
    return (film.director && other.director === film.director) || a.some((g) => b.includes(g))
  }).slice(0, 6)

  const inner = (
    <div className={panel ? 'modal modal-cine cine-panel' : 'modal modal-cine'} onClick={(e) => e.stopPropagation()}>
      <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        {/* Title & Subtitle Header */}
        <div className="cine-title-block">
          <div className="cine-title-row">
            <h2 className="cine-title">{film.title}</h2>
            {/* Format Badge */}
            <span className={`format-badge ${mediaFormat.toLowerCase().includes('4k') ? 'fmt-4k' : mediaFormat.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
              {mediaFormat}
            </span>
            {film.criterion && <span className="criterion-badge criterion-badge-modal">CRITERION</span>}
          </div>
          {metaSubParts.length > 0 && (
            <p className="cine-subtitle">{metaSubParts.join(' | ')}</p>
          )}
        </div>

        {/* Main Body: Poster + Rearranged Gray Info Card */}
        <div className="cine-main-row">
          <div
            className="cine-poster-box clickable-poster"
            onClick={() => film.poster && setLightboxSrc(film.poster)}
            title="Click to view full poster"
          >
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
            {/* Top Row: Synopsis (Left) & Archive Location / Loan Badge (Top Right) */}
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

              <div className="cine-top-badges-column">
                {(film.shelf || film.row) && film.mediaType !== 'digital' && (
                  <div className="cine-shelf-badge">
                    <span className="shelf-icon">
                      <IconPin width={13} height={13} />
                    </span>
                    <span>
                      Shelf <strong>{film.shelf || '—'}</strong> / Row{' '}
                      <strong>{film.row || '—'}</strong>
                    </span>
                  </div>
                )}

                {film.mediaType === 'digital' && (
                  <div className="cine-shelf-badge cine-drive-badge">
                    <span className="shelf-icon">
                      <IconPin width={13} height={13} />
                    </span>
                    <span>
                      Drive <strong>{film.driveNumber || '—'}</strong>
                    </span>
                  </div>
                )}

                {film.itemType === 'series' && film.seasonsEpisodes && (
                  <div className="cine-shelf-badge cine-series-badge">
                    {film.seasonsEpisodes}
                  </div>
                )}

                {/* Loan Status Indicator */}
                {film.borrowedTo ? (
                  <button
                    className="loan-badge active-loan-btn"
                    onClick={() => onManageLoan && onManageLoan(film)}
                    title="Click to manage loan status"
                  >
                    <IconHandshake width={13} height={13} /> Loaned to: <strong>{film.borrowedTo}</strong>
                  </button>
                ) : (
                  <button
                    className="loan-badge manage-loan-btn"
                    onClick={() => onManageLoan && onManageLoan(film)}
                    title="Mark film as borrowed by someone"
                  >
                    <IconHandshake width={13} height={13} /> Lend Film
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Studio Name (Left) + MPA Box + All-Black IMDb Badge with K votes */}
            <div className="cine-info-bottom-row">
              {studioName ? (
                <div className="cine-studio-header">
                  <span className="studio-icon">
                    <IconBuilding width={14} height={14} />
                  </span>
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

                {/* IMDb Yellow Badge: All Black Numbers/Text, /10, and K format votes */}
                {typeof film.rating === 'number' && (
                  <a
                    href={imdbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="imdb-badge-cine clickable-imdb"
                    title="Click to view on IMDb"
                  >
                    <div className="imdb-badge-top">
                      <span className="imdb-pill">IMDb</span>
                      <span className="imdb-score-black">{film.rating.toFixed(1)}</span>
                      <span className="imdb-denom">/ 10</span>
                    </div>
                    <div className="imdb-badge-votes">
                      {formatVotesK(film.imdbVotes)} votes
                    </div>
                  </a>
                )}

                {(film.myRating > 0 || onRateFilm) && (
                  <div className="my-rating-box" title="My rating">
                    <span className="my-rating-label">MY RATING</span>
                    <StarRating
                      value={film.myRating || 0}
                      size={15}
                      onChange={onRateFilm ? (n) => onRateFilm(film, n) : undefined}
                    />
                  </div>
                )}

                {film.copies > 1 && (
                  <div className="copies-box" title={`You own ${film.copies} copies of this title`}>
                    <span className="copies-number">{film.copies}</span>
                    <span className="copies-label">COPIES</span>
                  </div>
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
                  onClick={(e) => {
                    // Keep the accordion action isolated from the modal/card click
                    // handlers. This is especially important after expanding the
                    // list, when clicking an actor should open their filmography.
                    e.stopPropagation()
                    setShowAllCast((open) => !open)
                  }}
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
                  onClick={(e) => {
                    // Do not let expanding/collapsing the crew list trigger
                    // any parent click handler.
                    e.stopPropagation()
                    setShowAllCrew((open) => !open)
                  }}
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

        {relatedFilms.length > 0 && (
          <div className="similar-films">
            <div className="cine-col-title">SIMILAR IN YOUR ARCHIVE</div>
            <div className="similar-films-grid">
              {relatedFilms.map((other) => (
                <button type="button" key={other.id} onClick={() => onNavigate && onNavigate(other)}>
                  <img src={other.poster} alt="" />
                  <span>{other.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
  )

  if (panel)
    return (
      <>
        {inner}
        {lightboxSrc && (
          <ImageLightbox src={lightboxSrc} alt={film.title} onClose={() => setLightboxSrc(null)} />
        )}
      </>
    )

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        {inner}
      </div>
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt={film.title} onClose={() => setLightboxSrc(null)} />
      )}
    </>
  )
}
