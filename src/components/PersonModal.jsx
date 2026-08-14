import { useEffect, useState } from 'react'
import { IconClose, IconUser, IconPin, IconDisc } from './icons.jsx'
import ImageLightbox from './ImageLightbox.jsx'
import { addToOrderList } from '../utils/orderList.js'
import { proxyImg } from '../utils/proxyImg.js'

function RecommendationOrderButton({ title, year, director }) {
  const [state, setState] = useState('idle') // idle | adding | added
  const handleClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (state !== 'idle') return
    setState('adding')
    try {
      await addToOrderList({ title, releaseDate: year ? `${year}-01-01` : null, source: 'Director recommendations', director })
      setState('added')
    } catch {
      setState('idle')
    }
  }
  return (
    <button type="button" className="cinema-news-order-badge person-recommendation-order" onClick={handleClick} disabled={state !== 'idle'}>
      {state === 'added' ? 'Added ✓' : state === 'adding' ? '…' : 'Order'}
    </button>
  )
}

export default function PersonModal({ personName, allFilms, onSelectFilm, onClose, hasBluray }) {
  const [photo, setPhoto] = useState(null)
  const [bio, setBio] = useState(null)
  const [facts, setFacts] = useState({
    age: null,
    birthDate: null,
    deathDate: null,
    height: null,
    spouse: null,
    children: null,
    imdbId: null,
    letterboxdUrl: null,
  })
  const [bioLoading, setBioLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (lightboxOpen) return
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, lightboxOpen])

  useEffect(() => {
    setPhoto(null)
    setBio(null)
    setFacts({ age: null, birthDate: null, deathDate: null, height: null, spouse: null, children: null, imdbId: null, letterboxdUrl: null })
    setLightboxOpen(false)
    if (!personName) return
    setBioLoading(true)
    let cancelled = false
    fetch(`/api/actor-photo?name=${encodeURIComponent(personName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setPhoto(data.photo || null)
          setBio(data.bio || null)
          setFacts({
            age: data.age ?? null,
            birthDate: data.birthDate || null,
            deathDate: data.deathDate || null,
            height: data.height || null,
            spouse: data.spouse || null,
            children: data.children || null,
            imdbId: data.imdbId || null,
            letterboxdUrl: data.letterboxdUrl || null,
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBioLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [personName])

  if (!personName) return null

  const isDeceased = Boolean(facts.deathDate)
  const birthYear = facts.birthDate ? facts.birthDate.slice(0, 4) : null
  const deathYear = facts.deathDate ? facts.deathDate.slice(0, 4) : null

  const target = personName.trim().toLowerCase()

  // قبلاً اینجا فقط لیست allFilms (که باید کل جدول فیلم‌ها رو از قبل توی
  // مرورگر لود کرده باشه) فیلتر می‌شد؛ با رشد آرشیو به ۹۰۰۰+ ردیف، اون لیست
  // گاهی هنوز کامل/به‌روز لود نشده بود و صفحه‌ی بازیگر اشتباهاً «۰ فیلم»
  // نشون می‌داد، حتی برای فیلمی که همین الان ازش باز شده بودیم. الان مستقیم
  // از سرور برای همین شخص جستجو می‌کنیم، بدون وابستگی به دیتای از‌قبل‌لودشده.
  const [serverFilms, setServerFilms] = useState(null)
  useEffect(() => {
    let cancelled = false
    setServerFilms(null)
    if (!personName) return
    fetch(`/api/films/by-person?name=${encodeURIComponent(personName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setServerFilms(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [personName])

  // تا وقتی جواب سرور نرسیده، به‌عنوان fallback از همون لیستِ کلاینت استفاده
  // می‌کنیم تا صفحه خالی نیفته؛ به محض رسیدن جواب سرور، جایگزینش می‌کنیم.
  const source = serverFilms !== null ? serverFilms : allFilms

  // Filter matching films where personName appears in director, cast, or producer.
  // (writer/musician/composer aren't real film fields — no column stores them —
  // so matching against those was always a no-op; removed to match the server query.)
  const matchingFilmsRaw = source.filter((f) => {
    if ((f.director || '').toLowerCase().includes(target)) return true
    if ((f.producer || '').toLowerCase().includes(target)) return true

    const castList = Array.isArray(f.cast) ? f.cast : []
    return castList.some((actor) => {
      const name = typeof actor === 'object' ? actor.name : actor
      return (name || '').toLowerCase().includes(target)
    })
  })

  // اگه همون فیلم هم به‌صورت فیزیکی (بلوری) هم دیجیتال توی آرشیو باشه، قبلاً
  // اینجا دو کارت جدا براش نشون داده می‌شد. الان با title+year یکی می‌کنیم و
  // نسخه‌ی دیجیتالی (با بج بلوری روش) رو به‌عنوان نماینده نگه می‌داریم.
  const seenKeys = new Map()
  for (const f of matchingFilmsRaw) {
    const key = `${(f.title || '').trim().toLowerCase()}::${f.year || ''}`
    const existing = seenKeys.get(key)
    if (!existing || (f.mediaType === 'digital' && existing.mediaType !== 'digital')) {
      seenKeys.set(key, f)
    }
  }
  const matchingFilms = Array.from(seenKeys.values())

  const isDirector = matchingFilms.some((f) => (f.director || '').toLowerCase().includes(target))

  const [directorExtras, setDirectorExtras] = useState(null)
  const [extrasLoading, setExtrasLoading] = useState(false)
  useEffect(() => {
    setDirectorExtras(null)
    if (!personName) return
    setExtrasLoading(true)
    let cancelled = false
    fetch(`/api/director-extras?name=${encodeURIComponent(personName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDirectorExtras(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setExtrasLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personName])

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-person" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        <div className="person-header">
          <div
            className={
              isDeceased
                ? 'person-avatar-circle person-avatar-large person-avatar-deceased clickable-avatar'
                : 'person-avatar-circle person-avatar-large clickable-avatar'
            }
            onClick={() => photo && setLightboxOpen(true)}
            title={photo ? 'Click to view full photo' : undefined}
          >
            {photo ? (
              <img src={proxyImg(photo)} alt={personName} className="person-avatar-photo" />
            ) : (
              personName[0]?.toUpperCase() || <IconUser width={36} height={36} />
            )}
          </div>
          <div>
            <h2 className="person-title">
              {personName}
              <a
                className="person-imdb-link"
                href={
                  facts.imdbId
                    ? `https://www.imdb.com/name/${facts.imdbId}/`
                    : `https://www.imdb.com/find/?q=${encodeURIComponent(personName)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                title="View on IMDb"
                onClick={(e) => e.stopPropagation()}
              >
                IMDb ↗
              </a>
              <a
                className="person-letterboxd-link"
                href={
                  facts.letterboxdUrl
                    ? facts.letterboxdUrl
                    : `https://letterboxd.com/search/${encodeURIComponent(personName)}/`
                }
                target="_blank"
                rel="noopener noreferrer"
                title="View on Letterboxd"
                onClick={(e) => e.stopPropagation()}
              >
                Letterboxd ↗
              </a>
            </h2>
            <p className="person-subtitle">
              Found <strong>{matchingFilms.length}</strong> film(s) in your archive
            </p>
            {(facts.age || isDeceased || facts.height || facts.spouse || facts.children) && (
              <div className="person-facts-row">
                {isDeceased ? (
                  <span className="person-fact-chip person-fact-chip-deceased">
                    <b>Deceased</b> {birthYear && deathYear ? `${birthYear}–${deathYear}` : deathYear}
                  </span>
                ) : (
                  facts.age && (
                    <span className="person-fact-chip">
                      <b>Age</b> {facts.age}
                    </span>
                  )
                )}
                {facts.height && (
                  <span className="person-fact-chip">
                    <b>Height</b> {facts.height}
                  </span>
                )}
                {facts.spouse && (
                  <span className="person-fact-chip">
                    <b>Spouse</b> {facts.spouse}
                  </span>
                )}
                {facts.children && (
                  <span className="person-fact-chip">
                    <b>Children</b> {facts.children}
                  </span>
                )}
              </div>
            )}
            {bioLoading ? (
              <p className="person-bio person-bio-loading">Loading biography…</p>
            ) : bio ? (
              <p className="person-bio">{bio}</p>
            ) : null}

            {(extrasLoading || directorExtras?.awards?.length > 0 || (isDirector && directorExtras?.recommendations?.length > 0)) && (
              <div className="person-director-extras">
                {extrasLoading && !directorExtras && (
                  <p className="person-extras-loading">Loading awards…</p>
                )}

                {directorExtras?.awards?.length > 0 && (
                  <div className="person-awards">
                    <h4 className="person-extras-title">Awards</h4>
                    <div className="person-awards-list">
                      {directorExtras.awards.map((a) => (
                        <span key={a.label} className="person-fact-chip person-award-chip">
                          {a.label}
                          {a.count > 1 ? ` ×${a.count}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

            {isDirector && directorExtras?.recommendations?.length > 0 && (
                  <div className="person-recommendations">
                    <h4 className="person-extras-title">
                      Highly-rated films not in your archive (IMDb &gt; 7, Letterboxd &gt; 3.5)
                    </h4>
                    <ul className="person-recommendations-list">
                      {directorExtras.recommendations.map((r) => (
                        <li key={`${r.title}-${r.year}`} className="person-recommendation-item">
                          {r.poster && (
                            <img src={proxyImg(r.poster)} alt={r.title} className="person-recommendation-poster" />
                          )}
                          <span className="person-recommendation-info">
                            <span className="person-recommendation-title">
                              {r.title} <span className="person-recommendation-year">({r.year})</span>
                            </span>
                            <span className="person-recommendation-ratings">
                              <span className="badge-imdb">★ {r.imdbRating.toFixed(1)} IMDb</span>
                              {r.letterboxdRating != null && (
                                <span className="badge-letterboxd">● {r.letterboxdRating.toFixed(1)} Letterboxd</span>
                              )}
                            </span>
                          </span>
                          <RecommendationOrderButton title={r.title} year={r.year} director={personName} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="person-films-grid">
          {matchingFilms.length === 0 ? (
            <div className="person-empty">No other films found for {personName}</div>
          ) : (
            matchingFilms.map((film) => (
              <button
                key={film.id}
                className="person-film-card"
                onClick={() => {
                  onSelectFilm(film)
                }}
              >
                <div className="person-film-poster">
                  <img
                    src={film.poster}
                    alt={film.title}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <div className="person-poster-fallback">{film.title}</div>
                  {(film.closet || film.shelf || film.row) && (
                    <span className="person-location-badge">
                      <IconPin width={11} height={11} /> C{film.closet || '—'} R{film.row || '—'} S{film.shelf || '—'}
                    </span>
                  )}
                  {hasBluray && hasBluray(film) && (
                    <span className="bluray-badge" title="Blu-ray copy also owned">
                      <IconDisc width={11} height={11} /> BLU-RAY
                    </span>
                  )}
                </div>
                <div className="person-film-meta">
                  <h4 className="person-film-title">{film.title}</h4>
                  <p className="person-film-year">
                    {film.year || '—'} · {(Array.isArray(film.genre) ? film.genre : (film.genre || '').split(',').map(g => g.trim()).filter(Boolean)).slice(0, 2).join(', ')}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          src={proxyImg(photo)}
          alt={personName}
          grayscale={isDeceased}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
