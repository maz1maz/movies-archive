import { useEffect, useState } from 'react'
import { IconClose, IconUser, IconPin, IconDisc } from './icons.jsx'
import ImageLightbox from './ImageLightbox.jsx'

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
    setFacts({ age: null, birthDate: null, deathDate: null, height: null, spouse: null, children: null })
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

  // Filter matching films where personName appears in director, cast, writer, musician, producer, etc.
  const matchingFilmsRaw = source.filter((f) => {
    if ((f.director || '').toLowerCase().includes(target)) return true
    if ((f.writer || '').toLowerCase().includes(target)) return true
    if ((f.producer || '').toLowerCase().includes(target)) return true
    if ((f.musician || f.composer || '').toLowerCase().includes(target)) return true

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
              <img src={photo} alt={personName} className="person-avatar-photo" />
            ) : (
              personName[0]?.toUpperCase() || <IconUser width={36} height={36} />
            )}
          </div>
          <div>
            <h2 className="person-title">{personName}</h2>
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
                  {(film.shelf || film.row) && (
                    <span className="person-location-badge">
                      <IconPin width={11} height={11} /> {film.shelf || '—'} / {film.row || '—'}
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
                    {film.year || '—'} · {(film.genre || []).slice(0, 2).join(', ')}
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
          src={photo}
          alt={personName}
          grayscale={isDeceased}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
