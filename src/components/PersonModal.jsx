import { useEffect, useMemo, useState } from 'react'
import { IconClose, IconUser, IconPin, IconDisc } from './icons.jsx'
import ImageLightbox from './ImageLightbox.jsx'
import { addToOrderList } from '../utils/orderList.js'
import { proxyImg } from '../utils/proxyImg.js'
import { useAuth } from '../context/AuthContext.jsx'

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

export default function PersonModal({ personName, allFilms, onSelectFilm, onSelectPerson, onClose, hasBluray }) {
  const { isGuest, openLogin } = useAuth()
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

  // فیلم کوتاه (زیر ۴۰ دقیقه، طبق تعریف رایج) رو تو صفحه‌ی هنرمند نشون نمی‌دیم
  // — معمولاً مستندهای مصاحبه‌ای/گلچین‌ان که ده‌ها آدم رو یه‌بار مشترک می‌کنن
  // و لیست هم‌بازی/همکاری رو بی‌معنی می‌کنن.
  const isShortFilm = (f) => typeof f.runtime === 'number' && f.runtime > 0 && f.runtime < 40

  // Filter matching films where personName appears in director, cast, producer, or screenwriter.
  const matchingFilmsRaw = source.filter((f) => {
    if (isShortFilm(f)) return false
    if ((f.director || '').toLowerCase().includes(target)) return true
    if ((f.producer || '').toLowerCase().includes(target)) return true
    if ((f.screenwriter || '').toLowerCase().includes(target)) return true

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
  const dedupedFilms = Array.from(seenKeys.values())

  const isDirector = dedupedFilms.some((f) => (f.director || '').toLowerCase().includes(target))

  // اگه کارگردان نبود، بازیگره یا نه رو چک می‌کنیم — برای تگ کنار اسم.
  const isActor =
    !isDirector &&
    dedupedFilms.some((f) => {
      const castList = Array.isArray(f.cast) ? f.cast : []
      return castList.some((a) => (typeof a === 'object' ? a.name : a || '').toLowerCase() === target)
    })

  // اگه این شخص تو آرشیو به‌عنوان کارگردان شناخته می‌شه، صفحه‌ش رو صرفاً
  // فیلموگرافی کارگردانی‌ش نشون بده — نه فیلم‌هایی که فقط تهیه‌کننده یا
  // بازیگرشون بوده، که ترکیبشون گیج‌کننده‌ست.
  const matchingFilms = isDirector
    ? dedupedFilms.filter((f) => (f.director || '').toLowerCase().includes(target))
    : dedupedFilms

  // هم‌بازی‌های پرتکرار — کاملاً از دیتای cast موجود تو آرشیو، بدون API.
  // برای هر فیلمی که این شخص توش بازی کرده، بقیه‌ی cast رو می‌شماریم و
  // بیشترین همکاری‌ها رو نشون می‌دیم.
  const coStars = useMemo(() => {
    const tally = new Map()
    for (const f of matchingFilms) {
      const castList = Array.isArray(f.cast) ? f.cast : []
      const namesInFilm = castList.map((a) => (typeof a === 'object' ? a.name : a)).filter(Boolean)
      // اگه خود این شخص تو cast این فیلم نبود (مثلاً فقط کارگردانش بوده)، این
      // فیلم برای «هم‌بازی» حساب نمی‌شه — چون شریک بازیگری نداشته، نه شریک کارگردانی.
      if (!namesInFilm.some((n) => n.toLowerCase() === target)) continue
      for (const name of namesInFilm) {
        const lower = name.toLowerCase()
        if (lower === target) continue
        if (!tally.has(lower)) tally.set(lower, { name, count: 0 })
        tally.get(lower).count++
      }
    }
    return [...tally.values()]
      .filter((c) => c.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [matchingFilms, target])

  // همکاری کارگردان–بازیگر — کاملاً از دیتای director/cast موجود، بدون API.
  // اگه این شخص کارگردانه: کدوم بازیگرا رو بیشتر انتخاب کرده.
  // اگه این شخص بازیگره: با کدوم کارگردان‌ها بیشتر کار کرده.
  const directorCollabs = useMemo(() => {
    const personIsDirectorInFilm = (f) => (f.director || '').toLowerCase().includes(target)
    const tally = new Map()

    if (isDirector) {
      // این شخص کارگردانه → بازیگرای پرتکرار فیلم‌هایی که خودش کارگردانی کرده
      for (const f of matchingFilms) {
        if (!personIsDirectorInFilm(f)) continue
        const castList = Array.isArray(f.cast) ? f.cast : []
        for (const actor of castList) {
          const name = typeof actor === 'object' ? actor.name : actor
          if (!name) continue
          const lower = name.toLowerCase()
          if (!tally.has(lower)) tally.set(lower, { name, count: 0 })
          tally.get(lower).count++
        }
      }
    } else {
      // این شخص بازیگره → کارگردان‌های پرتکراری که باهاشون کار کرده
      for (const f of matchingFilms) {
        const castList = Array.isArray(f.cast) ? f.cast : []
        const inCast = castList.some((a) => (typeof a === 'object' ? a.name : a || '').toLowerCase() === target)
        if (!inCast || !f.director) continue
        for (const dName of f.director.split(',').map((d) => d.trim()).filter(Boolean)) {
          const lower = dName.toLowerCase()
          if (!tally.has(lower)) tally.set(lower, { name: dName, count: 0 })
          tally.get(lower).count++
        }
      }
    }
    return [...tally.values()]
      .filter((c) => c.count > 1) // فقط همکاری‌های تکراری (بیش از ۱ فیلم) جالبن
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [matchingFilms, target, isDirector])

  const [followState, setFollowState] = useState('unknown') // unknown | following | not-following
  useEffect(() => {
    setFollowState('unknown')
    if (!personName) return
    let cancelled = false
    fetch('/api/followed')
      .then((r) => r.json())
      .then((list) => {
        if (cancelled) return
        const isFollowed = Array.isArray(list) && list.some((p) => p.name.toLowerCase() === target)
        setFollowState(isFollowed ? 'following' : 'not-following')
      })
      .catch(() => setFollowState('not-following'))
    return () => {
      cancelled = true
    }
  }, [personName, target])

  const toggleFollow = async () => {
    if (isGuest) {
      openLogin()
      return
    }
    if (followState === 'unknown') return
    if (followState === 'following') {
      setFollowState('not-following')
      try {
        await fetch(`/api/followed/${encodeURIComponent(personName)}`, { method: 'DELETE' })
      } catch {
        setFollowState('following')
      }
    } else {
      setFollowState('following')
      try {
        await fetch('/api/followed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: personName, type: isDirector ? 'director' : 'actor', photo }),
        })
      } catch {
        setFollowState('not-following')
      }
    }
  }

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
              {isDirector && <span className="person-role-tag">DIRECTOR</span>}
              {isActor && <span className="person-role-tag">ACTOR</span>}
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
              <button
                type="button"
                className={followState === 'following' ? 'person-follow-btn person-follow-btn-active' : 'person-follow-btn'}
                onClick={toggleFollow}
                disabled={followState === 'unknown'}
                title={followState === 'following' ? 'Unfollow' : 'Follow'}
              >
                {followState === 'following' ? '★ Following' : '☆ Follow'}
              </button>
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
                    <h4 className="person-extras-title">Awards ({directorExtras.awards.length})</h4>
                    <div className="person-awards-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {directorExtras.awards.map((a, i) => (
                        <span key={`${a.label}-${a.year}-${i}`} className="person-fact-chip person-award-chip" style={{ display: 'block' }}>
                          {a.label}
                          {a.year ? ` — ${a.year}` : ''}
                          {a.forWork ? ` (${a.forWork})` : ''}
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
                          <a
                            className="person-recommendation-link"
                            href={`https://www.imdb.com/find/?q=${encodeURIComponent(`${r.title} ${r.year}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
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
                          </a>
                          <a
                            className="person-recommendation-lb-link"
                            href={`https://letterboxd.com/search/films/${encodeURIComponent(r.title)}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Search on Letterboxd"
                          >
                            LB ↗
                          </a>
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

        {directorCollabs.length > 0 && (
          <div className="stats-box" style={{ marginTop: 18 }}>
            <h3>{isDirector ? "Director's frequent cast" : 'Frequent director collaborations'}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {directorCollabs.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="person-follow-btn"
                  style={{ fontSize: 12.5, padding: '5px 10px' }}
                  onClick={() => onSelectPerson && onSelectPerson(c.name)}
                >
                  {c.name} <span style={{ opacity: 0.65 }}>· {c.count} film{c.count > 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {coStars.length > 0 && (
          <div className="stats-box" style={{ marginTop: 18 }}>
            <h3>Frequent co-stars</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {coStars.map((cs) => (
                <button
                  key={cs.name}
                  type="button"
                  className="person-follow-btn"
                  style={{ fontSize: 12.5, padding: '5px 10px' }}
                  onClick={() => onSelectPerson && onSelectPerson(cs.name)}
                >
                  {cs.name} <span style={{ opacity: 0.65 }}>· {cs.count} film{cs.count > 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
