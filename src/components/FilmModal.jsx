import { useEffect, useState } from 'react'
import { IconClose, IconPin, IconHandshake, IconBuilding, IconEdit, IconShare } from './icons.jsx'
import StarRating from './StarRating.jsx'
import ImageLightbox from './ImageLightbox.jsx'
import { shareFilmCard } from '../utils/shareCard.js'
import { addToOrderList } from '../utils/orderList.js'

function CollectionOrderButton({ title, year }) {
  const [state, setState] = useState('idle') // idle | adding | added
  const handleClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (state !== 'idle') return
    setState('adding')
    try {
      await addToOrderList({ title, releaseDate: year ? `${year}-01-01` : null, source: 'Collection' })
      setState('added')
    } catch {
      setState('idle')
    }
  }
  return (
    <button
      type="button"
      className="cine-collection-order-btn"
      onClick={handleClick}
      disabled={state !== 'idle'}
    >
      {state === 'added' ? 'Added ✓' : state === 'adding' ? '…' : 'Order'}
    </button>
  )
}

export default function FilmModal({ film, films = [], onNavigate, onSelectPerson, onManageLoan, onEdit, onClose, onRateFilm, panel = false, hasBluray = false, hasDigital = false, siblingFilm = null, onSaveSeasonDrive }) {
  const [showAllCast, setShowAllCast] = useState(false)
  const [showAllCrew, setShowAllCrew] = useState(false)
  const [actorPhotos, setActorPhotos] = useState({})
  const [letterboxdRating, setLetterboxdRating] = useState(null)
  const [shareStatus, setShareStatus] = useState(null)
  const [editingSeason, setEditingSeason] = useState(null)
  const [seasonDriveInput, setSeasonDriveInput] = useState('')

  const handleShare = async () => {
    setShareStatus('working')
    try {
      const result = await shareFilmCard(film)
      setShareStatus(result === 'shared' ? 'shared' : 'downloaded')
    } catch (err) {
      if (err?.name !== 'AbortError') setShareStatus('error')
      else setShareStatus(null)
    }
    setTimeout(() => setShareStatus(null), 2500)
  }

  // یه شماره فصل رو به هارد جدید نگاشت می‌کنه (یا از نقشه پاک می‌کنه اگه
  // خالی گذاشته بشه)، بعد seasonDrives رو دوباره از رو نقشه‌ی به‌روزشده
  // می‌سازه — به‌جای این‌که فقط رشته‌ی همون یه ردیف رو دستکاری کنه، چون یه
  // ردیف seasonDrives می‌تونه چندتا فصل رو باهم پوشش بده (مثلاً "2, 3").
  const saveSeasonDrive = (seasonNum, newDrive) => {
    if (!onSaveSeasonDrive) return
    const ownedMap = {}
    ;(film.seasonDrives || []).forEach((sd) => {
      const nums = String(sd.seasons || '').match(/\d+/g) || []
      nums.forEach((n) => {
        ownedMap[Number(n)] = sd.drive
      })
    })
    if (newDrive && newDrive.trim()) {
      ownedMap[seasonNum] = newDrive.trim()
    } else {
      delete ownedMap[seasonNum]
    }
    const byDrive = {}
    Object.entries(ownedMap).forEach(([n, drive]) => {
      if (!byDrive[drive]) byDrive[drive] = []
      byDrive[drive].push(Number(n))
    })
    const nextSeasonDrives = Object.entries(byDrive).map(([drive, nums]) => ({
      seasons: nums.sort((a, b) => a - b).join(', '),
      drive,
    }))
    onSaveSeasonDrive(film, nextSeasonDrives)
    setEditingSeason(null)
  }
  const [letterboxdVotes, setLetterboxdVotes] = useState(null)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [collection, setCollection] = useState(null)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [bookAdaptation, setBookAdaptation] = useState(null)
  const [shootingLocation, setShootingLocation] = useState(null)
  const [festivalAwards, setFestivalAwards] = useState(Array.isArray(film?.festivalAwards) ? film.festivalAwards : [])

  useEffect(() => {
    const onKey = (e) => {
      // اگه لایت‌باکس بازه، Escape/جهت‌نماها فقط باید خودِ لایت‌باکس رو
      // ببنده یا نادیده گرفته بشه — نباید همزمان کل مودال فیلم رو هم ببنده
      // یا فیلم رو عوض کنه در حالی که کاربر داره پوستر رو زوم می‌کنه.
      if (lightboxSrc) return
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
  }, [onClose, panel, lightboxSrc, films, film.id, onNavigate])

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

  // مجموعه‌ی TMDB این فیلم (اگه بخشی از یه سری مثل «Alien Collection» باشه).
  // سریال‌ها و فیلم‌های بدون itemType مشخص رو سرور خودش رد می‌کنه.
  useEffect(() => {
    setCollection(null)
    if (!film?.id || film.itemType === 'series') return
    setCollectionLoading(true)
    let cancelled = false
    fetch(`/api/films/${film.id}/collection`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCollection(data.collection || null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCollectionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [film?.id, film?.itemType, film?.title])

  // اقتباس از کتاب — خودکار از Wikidata (P144). اگه basedOnBook از قبل دستی
  // پر شده باشه (تو EditModal)، سرور همون رو برمی‌گردونه بدون fetch مجدد.
  useEffect(() => {
    setBookAdaptation(film?.basedOnBook ? { basedOnBook: film.basedOnBook, bookAuthor: film.bookAuthor } : null)
    if (!film?.id || film.itemType === 'series' || film.basedOnBook) return
    let cancelled = false
    fetch(`/api/films/${film.id}/book-adaptation`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.basedOnBook) setBookAdaptation(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [film?.id, film?.itemType, film?.basedOnBook, film?.bookAuthor])

  // لوکیشن فیلم‌برداری — خودکار از Wikidata (P915). سریال‌ها هم شامل می‌شن
  // (برخلاف کتاب/مجموعه که فقط فیلمن).
  useEffect(() => {
    setShootingLocation(film?.shootingLocation || null)
    if (!film?.id || film.shootingLocation) return
    let cancelled = false
    fetch(`/api/films/${film.id}/shooting-location`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.shootingLocation) setShootingLocation(data.shootingLocation)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [film?.id, film?.shootingLocation])

  // جوایز جشنواره‌ای — خودکار از Wikidata (P166). سرور خودش تشخیص می‌ده قبلاً
  // چک شده یا نه (raw column)، پس همیشه fetch می‌کنیم و سرور کشش رو مدیریت می‌کنه.
  useEffect(() => {
    setFestivalAwards(Array.isArray(film?.festivalAwards) ? film.festivalAwards : [])
    if (!film?.id) return
    let cancelled = false
    fetch(`/api/films/${film.id}/festival-awards`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.awards)) setFestivalAwards(data.awards)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [film?.id])

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

  useEffect(() => {
    setLetterboxdRating(film?.letterboxdRating ?? null)
    setLetterboxdVotes(film?.letterboxdVotes ?? null)
    // Letterboxd فقط فیلم داره، سریال توش نیست — درخواست الکی نزنیم
    if (film?.itemType === 'series') return
    if (film?.letterboxdRating != null || !film?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/letterboxd-rating?filmId=${encodeURIComponent(film.id)}`)
        const data = await res.json()
        if (!cancelled && data.letterboxdRating != null) {
          setLetterboxdRating(data.letterboxdRating)
          setLetterboxdVotes(data.letterboxdVotes ?? null)
        }
      } catch {
        // اگه Letterboxd در دسترس نبود، بج امتیازش رو نشون نمی‌دیم
      }
    })()
    return () => {
      cancelled = true
    }
  }, [film?.id, film?.letterboxdRating, film?.itemType])

  if (!film) return null

  const formatRuntime = (min) => {
    if (!min) return ''
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const formatVotesK = (votes) => {
    if (!votes) return null
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
  const mediaFormat = film.format || (film.mediaType === 'digital' ? 'Digital' : 'Blu-ray')

  const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    (film.originalTitle || film.title) + ' official trailer'
  )}`

  const imdbUrl = film.imdbId
    ? `https://www.imdb.com/title/${film.imdbId}/`
    : `https://www.imdb.com/find/?q=${encodeURIComponent(film.title)}`

  // لتربوکس یه لینک ریدایرکت مستقیم بر اساس IMDb ID داره که همیشه به صفحه‌ی
  // درست همون فیلم می‌ره (نه نتایج سرچ) — چون حدس زدن اسلاگ از رو عنوان/سال
  // همیشه درست از آب درنمیاد (ریمیک‌ها، کاراکترهای خاص، و...).
  const letterboxdUrl = film.imdbId
    ? `https://letterboxd.com/imdb/${film.imdbId}/`
    : `https://letterboxd.com/search/films/${encodeURIComponent(film.title)}/`

  const getActorPhoto = (actorObj, name) => {
    if (typeof actorObj === 'object' && actorObj?.photo) return actorObj.photo
    if (actorPhotos[name]) return actorPhotos[name]
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=334155&color=ffffff&bold=true&rounded=true`
  }

  const fullCrew = [
    { label: 'Director', value: film.director },
    { label: 'Writer', value: film.screenwriter },
    { label: 'Producer', value: film.producer },
    { label: 'Musician', value: film.composer || film.musician },
    { label: 'Cinematography', value: film.cinematographer },
    { label: 'Country', value: film.country },
    { label: 'Filmed in', value: shootingLocation },
    { label: 'Edition', value: film.editionType },
    { label: 'Runtime', value: film.runtime ? `${film.runtime} mins (${runtimeText})` : null },
  ].filter((item) => item.value)

  const displayedCrew = showAllCrew ? fullCrew : fullCrew.slice(0, 4)

  const inner = (
    <div className={panel ? 'modal modal-cine cine-panel' : 'modal modal-cine'} onClick={(e) => e.stopPropagation()}>
      <div className="cine-corner-actions">
        {onEdit && (
          <button className="cine-edit-btn" onClick={() => onEdit(film)} aria-label="Edit film" title="Edit">
            <IconEdit width={14} height={14} />
          </button>
        )}
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>
      </div>

        {/* Title & Subtitle Header */}
        <div className="cine-title-block">
          <div className="cine-title-row">
            <h2 className="cine-title">
              {film.title}
              {film.originalTitle && film.originalTitle.trim() && film.originalTitle.trim() !== film.title.trim() && (
                <span className="cine-original-title"> ({film.originalTitle})</span>
              )}
            </h2>
            {film.criterion && (
              <span className="criterion-badge criterion-badge-modal">
                CRITERION{film.criterionCopies > 1 ? ` ×${film.criterionCopies}` : ''}
              </span>
            )}
          </div>
          {metaSubParts.length > 0 && (
            <p className="cine-subtitle">{metaSubParts.join(' | ')}</p>
          )}
        </div>

        {/* Physical (left) / Digital (right) row: physical badge + shelf location
            always on the left, digital badge + drive always on the right —
            whichever record you're viewing, plus the sibling copy if you also
            own it. Kept outside the synopsis box on purpose. */}
        {(() => {
          const isPhysical = film.mediaType !== 'digital'
          const physicalRecord = isPhysical ? film : hasBluray ? siblingFilm : null
          const digitalRecord = !isPhysical ? film : hasDigital ? siblingFilm : null
          const physicalFormat = isPhysical ? mediaFormat : physicalRecord?.format || 'Blu-ray'
          return (
            (physicalRecord || digitalRecord) && (
              <div className="cine-format-location-row">
                {physicalRecord && (
                  <div className="cine-format-location-col">
                    <span className={`format-badge ${physicalFormat.toLowerCase().includes('4k') ? 'fmt-4k' : physicalFormat.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                      {physicalFormat}
                    </span>
                    {(physicalRecord.closet || physicalRecord.shelf || physicalRecord.row) && (
                      <div className="cine-shelf-badge">
                        <span className="shelf-icon">
                          <IconPin width={13} height={13} />
                        </span>
                        <span>
                          Closet <strong>{physicalRecord.closet || '—'}</strong> / Row{' '}
                          <strong>{physicalRecord.row || '—'}</strong> / Section{' '}
                          <strong>{physicalRecord.shelf || '—'}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {digitalRecord && (
                  <div className="cine-format-location-col cine-format-location-col-right">
                    <span className="format-badge digital">
                      DIGITAL
                    </span>
                    <div className="cine-shelf-badge cine-drive-badge">
                      <span className="shelf-icon">
                        <IconPin width={13} height={13} />
                      </span>
                      <span>
                        {/^drive\b/i.test(digitalRecord.driveNumber || '') ? (
                          <strong>{digitalRecord.driveNumber}</strong>
                        ) : (
                          <>
                            Drive <strong>{digitalRecord.driveNumber || '—'}</strong>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          )
        })()}

        {/* Main Body: Poster + Rearranged Gray Info Card */}
        <div className="cine-main-row">
          <div
            className={
              hasBluray
                ? 'cine-poster-box clickable-poster cine-poster-has-bluray'
                : hasDigital
                ? 'cine-poster-box clickable-poster cine-poster-has-digital'
                : 'cine-poster-box clickable-poster'
            }
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
            {/* Top Row: Synopsis (Left) & Loan/Share Column (Right) */}
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
                {film.copies > 1 && (
                  <div
                    className="copies-under-lend"
                    title={
                      film.borrowedTo
                        ? `${film.copies - 1} of ${film.copies} copies available (1 loaned to ${film.borrowedTo})`
                        : `You own ${film.copies} copies of this title`
                    }
                  >
                    {film.borrowedTo ? `${film.copies - 1} / ${film.copies}` : film.copies} COPIES
                  </div>
                )}
                <button
                  className="loan-badge manage-loan-btn"
                  onClick={handleShare}
                  disabled={shareStatus === 'working'}
                  title="Create a shareable image and hand it to your phone's share sheet (Instagram, etc.)"
                >
                  <IconShare width={13} height={13} />
                  {shareStatus === 'working'
                    ? 'Preparing…'
                    : shareStatus === 'shared'
                      ? 'Shared ✓'
                      : shareStatus === 'downloaded'
                        ? 'Image saved ✓'
                        : shareStatus === 'error'
                          ? "Couldn't create image"
                          : 'Share'}
                </button>
              </div>
            </div>

            {film.personalReview && (
              <div className="cine-my-review-box">
                <div className="cine-section-label">MY LETTERBOXD REVIEW</div>
                <p className="cine-my-review-text">{film.personalReview}</p>
                {film.personalReviewUrl && (
                  <a href={film.personalReviewUrl} target="_blank" rel="noreferrer" className="cine-my-review-link">
                    View on Letterboxd →
                  </a>
                )}
              </div>
            )}

            {Array.isArray(film.reviews) &&
              film.reviews.map((r, idx) => (
                <div className="cine-my-review-box" key={idx}>
                  <div className="cine-section-label">
                    {r.author ? `${r.author.toUpperCase()}'S REVIEW` : 'LETTERBOXD REVIEW'}
                    {r.rating ? ` · ★ ${r.rating}` : ''}
                  </div>
                  <p className="cine-my-review-text">{r.text}</p>
                </div>
              ))}

            {bookAdaptation?.basedOnBook && (
              <div className="cine-collection-box" style={{ padding: '10px 16px' }}>
                <div className="cine-section-label">BASED ON</div>
                <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>
                  <a
                    href={`https://www.goodreads.com/search?q=${encodeURIComponent(
                      bookAdaptation.bookAuthor
                        ? `${bookAdaptation.basedOnBook} ${bookAdaptation.bookAuthor}`
                        : bookAdaptation.basedOnBook
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    <em>{bookAdaptation.basedOnBook}</em>
                  </a>
                  {bookAdaptation.bookAuthor ? ` by ${bookAdaptation.bookAuthor}` : ''}
                </p>
              </div>
            )}

            {(film.originalLanguage || film.boxOffice) && (
              <div className="cine-collection-box" style={{ padding: '10px 16px', display: 'flex', gap: 24 }}>
                {film.originalLanguage && (
                  <div>
                    <div className="cine-section-label">LANGUAGE</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.originalLanguage}</p>
                  </div>
                )}
                {film.boxOffice && (
                  <div>
                    <div className="cine-section-label">BOX OFFICE</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.boxOffice}</p>
                  </div>
                )}
              </div>
            )}

            {film.tagline && (
              <div className="cine-collection-box" style={{ padding: '10px 16px' }}>
                <div className="cine-section-label">TAGLINE</div>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, fontStyle: 'italic' }}>“{film.tagline}”</p>
              </div>
            )}

            {(film.budget || film.revenue) && (
              <div className="cine-collection-box" style={{ padding: '10px 16px', display: 'flex', gap: 24 }}>
                {film.budget ? (
                  <div>
                    <div className="cine-section-label">BUDGET</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>${film.budget.toLocaleString()}</p>
                  </div>
                ) : null}
                {film.revenue ? (
                  <div>
                    <div className="cine-section-label">REVENUE</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>${film.revenue.toLocaleString()}</p>
                  </div>
                ) : null}
              </div>
            )}

            {(film.metascore || film.rottenTomatoes) && (
              <div className="cine-collection-box" style={{ padding: '10px 16px', display: 'flex', gap: 24 }}>
                {film.metascore ? (
                  <div>
                    <div className="cine-section-label">METASCORE</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.metascore}/100</p>
                  </div>
                ) : null}
                {film.rottenTomatoes ? (
                  <div>
                    <div className="cine-section-label">ROTTEN TOMATOES</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.rottenTomatoes}</p>
                  </div>
                ) : null}
              </div>
            )}

            {(film.releaseDate || film.status) && (
              <div className="cine-collection-box" style={{ padding: '10px 16px', display: 'flex', gap: 24 }}>
                {film.releaseDate ? (
                  <div>
                    <div className="cine-section-label">RELEASE DATE</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.releaseDate}</p>
                  </div>
                ) : null}
                {film.status ? (
                  <div>
                    <div className="cine-section-label">STATUS</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.status}</p>
                  </div>
                ) : null}
              </div>
            )}

            {Array.isArray(film.productionCompanies) && film.productionCompanies.length > 0 && (
              <div className="cine-collection-box" style={{ padding: '10px 16px' }}>
                <div className="cine-section-label">PRODUCTION COMPANIES</div>
                <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.productionCompanies.join(', ')}</p>
              </div>
            )}

            {Array.isArray(film.spokenLanguages) && film.spokenLanguages.length > 0 && (
              <div className="cine-collection-box" style={{ padding: '10px 16px' }}>
                <div className="cine-section-label">SPOKEN LANGUAGES</div>
                <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.spokenLanguages.join(', ')}</p>
              </div>
            )}

            {film.homepage && (
              <div className="cine-collection-box" style={{ padding: '10px 16px' }}>
                <div className="cine-section-label">OFFICIAL SITE</div>
                <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>
                  <a href={film.homepage} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {film.homepage}
                  </a>
                </p>
              </div>
            )}

            {(film.network || film.seriesStatus || film.schedule) && (
              <div className="cine-collection-box" style={{ padding: '10px 16px', display: 'flex', gap: 24 }}>
                {film.network ? (
                  <div>
                    <div className="cine-section-label">NETWORK</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.network}</p>
                  </div>
                ) : null}
                {film.seriesStatus ? (
                  <div>
                    <div className="cine-section-label">SERIES STATUS</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.seriesStatus}</p>
                  </div>
                ) : null}
                {film.schedule ? (
                  <div>
                    <div className="cine-section-label">SCHEDULE</div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{film.schedule}</p>
                  </div>
                ) : null}
              </div>
            )}

            {festivalAwards.length > 0 && (
              <div className="cine-collection-box" style={{ padding: '10px 16px' }}>
                <div className="cine-section-label">AWARDS ({festivalAwards.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, maxHeight: 260, overflowY: 'auto' }}>
                  {festivalAwards.map((a, i) => (
                    <p key={`${a.award}-${a.year}-${i}`} style={{ margin: 0, fontSize: 13.5 }}>
                      {a.icon} <strong>{a.award}</strong>
                      {a.year ? ` — ${a.year}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {collection && collection.parts?.length > 1 && (
              <div className="cine-collection-box">
                <div className="cine-section-label">
                  PART OF: {collection.name?.toUpperCase()} ({collection.parts.filter((p) => p.inArchive).length}/{collection.parts.length} in archive)
                </div>
                <div className="cine-collection-grid">
                  {collection.parts.map((p) => (
                    <div key={p.tmdbId} className={`cine-collection-item${p.title === film.title ? ' cine-collection-item-current' : ''}`}>
                      <button
                        type="button"
                        className="cine-collection-poster-btn"
                        disabled={!p.inArchive}
                        onClick={async () => {
                          if (!p.inArchive || !p.archiveFilmId || !onNavigate) return
                          // ممکنه فیلم مقصد تو لیست films (که بسته به بخش/فیلترِ
                          // فعلی می‌تونه محدود باشه) نباشه — مستقیم از سرور می‌گیریم
                          // تا کلیک همیشه کار کنه، مستقل از اینکه کجای اپیم.
                          const local = films.find((f) => f.id === p.archiveFilmId)
                          if (local) {
                            onNavigate(local)
                            return
                          }
                          try {
                            const res = await fetch(`/api/films/${p.archiveFilmId}`)
                            if (res.ok) {
                              const data = await res.json()
                              onNavigate(data)
                            }
                          } catch {}
                        }}
                        title={p.title}
                      >
                        {p.poster ? (
                          <img src={p.poster} alt={p.title} className="cine-collection-poster" />
                        ) : (
                          <span className="cine-collection-poster-empty">{p.title}</span>
                        )}
                        {!p.inArchive && <span className="cine-collection-missing-badge">Missing</span>}
                      </button>
                      <span className="cine-collection-item-title">
                        {p.title} {p.year ? `(${p.year})` : ''}
                      </span>
                      {!p.inArchive && <CollectionOrderButton title={p.title} year={p.year} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                {/* Letterboxd Rating Badge (فیلم‌ها) */}
                {film.itemType !== 'series' && typeof letterboxdRating === 'number' && (
                  <a
                    href={letterboxdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="letterboxd-rating-box"
                    title="Letterboxd Rating"
                  >
                    <div className="letterboxd-badge-top">
                      <span className="letterboxd-tag-label">Letterboxd</span>
                      <span className="letterboxd-tag-val">{letterboxdRating.toFixed(1)}</span>
                    </div>
                    {formatVotesK(letterboxdVotes) && (
                      <div className="letterboxd-badge-votes">{formatVotesK(letterboxdVotes)} ratings</div>
                    )}
                  </a>
                )}

                {/* TVMaze Rating Badge (سریال‌ها) — Letterboxd سریال نداره، این معادلشه */}
                {film.itemType === 'series' && typeof film.rating === 'number' && (
                  <a
                    href={`https://www.tvmaze.com/search?q=${encodeURIComponent(film.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="letterboxd-rating-box"
                    title="TVMaze Rating"
                  >
                    <div className="letterboxd-badge-top">
                      <span className="letterboxd-tag-label">TVMaze</span>
                      <span className="letterboxd-tag-val">{film.rating.toFixed(1)}</span>
                    </div>
                  </a>
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
                    {formatVotesK(film.imdbVotes) && (
                      <div className="imdb-badge-votes">
                        {formatVotesK(film.imdbVotes)} votes
                      </div>
                    )}
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
                      <div
                        className={
                          name in actorPhotos
                            ? 'cine-actor-avatar-wrap'
                            : 'cine-actor-avatar-wrap avatar-loading'
                        }
                      >
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
                const names = isPerson
                  ? String(item.value)
                      .split(',')
                      .map((n) => n.trim())
                      .filter(Boolean)
                  : null
                return (
                  <div key={idx} className="cine-crew-row">
                    <span className="crew-key">{item.label}</span>
                    {isPerson ? (
                      <span className="crew-val">
                        {names.map((name, ni) => (
                          <span key={ni}>
                            <span
                              className="clickable-person-text"
                              onClick={() => onSelectPerson && onSelectPerson(name)}
                              title={`See all films featuring ${name}`}
                            >
                              {name}
                            </span>
                            {ni < names.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="crew-val">{item.value}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* TRAILER */}
          <div className="cine-col cine-col-trailer">
            {/* SEASONS — کدوم فصل‌ها موجوده و کدوم فصل روی کدوم هارده */}
            {film.itemType === 'series' && Array.isArray(film.seasonDrives) && film.seasonDrives.length > 0 && (
              <div className="cine-seasons-block">
                <div className="cine-col-title">
                  SEASONS
                  {film.totalSeasonsProduced ? (
                    <span className="seasons-produced-badge">
                      {film.totalSeasonsProduced} total produced
                    </span>
                  ) : null}
                </div>
                <div className="cine-seasons-table">
                  {(() => {
                    // نگاشت هر شماره فصل به هارد نگهدارنده‌اش، از روی seasonDrives
                    const ownedMap = {}
                    for (const sd of film.seasonDrives) {
                      const nums = String(sd.seasons || '').match(/\d+/g) || []
                      for (const n of nums) ownedMap[Number(n)] = sd.drive
                    }
                    const ownedNums = Object.keys(ownedMap).map(Number)
                    const maxKnown = ownedNums.length ? Math.max(...ownedNums) : 0
                    const totalCount = film.totalSeasonsProduced || maxKnown

                    if (!totalCount) {
                      // بدون عدد کل فصل‌های تولیدشده، همون بازه‌های ثبت‌شده رو نشون بده
                      return film.seasonDrives.map((sd, idx) => (
                        <div key={idx} className="cine-season-row">
                          <span className="season-key">{sd.seasons}</span>
                          <span className="season-drive">
                            <IconPin width={12} height={12} /> {sd.drive}
                          </span>
                        </div>
                      ))
                    }

                    return Array.from({ length: totalCount }, (_, i) => i + 1).map((n) => (
                      <div key={n} className="cine-season-row">
                        <span className="season-key">Season {n}</span>
                        {editingSeason === n ? (
                          <span className="season-drive season-drive-editing">
                            <input
                              autoFocus
                              className="season-drive-input"
                              value={seasonDriveInput}
                              placeholder="e.g. Drive 3"
                              onChange={(e) => setSeasonDriveInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveSeasonDrive(n, seasonDriveInput)
                                if (e.key === 'Escape') setEditingSeason(null)
                              }}
                            />
                            <button
                              type="button"
                              className="season-drive-save-btn"
                              onClick={() => saveSeasonDrive(n, seasonDriveInput)}
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="season-drive-cancel-btn"
                              onClick={() => setEditingSeason(null)}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <span
                            className={ownedMap[n] ? 'season-drive' : 'season-drive season-missing'}
                            onClick={
                              onSaveSeasonDrive
                                ? () => {
                                    setEditingSeason(n)
                                    setSeasonDriveInput(ownedMap[n] || '')
                                  }
                                : undefined
                            }
                            style={onSaveSeasonDrive ? { cursor: 'pointer' } : undefined}
                            title={onSaveSeasonDrive ? 'Click to edit which drive this season is on' : undefined}
                          >
                            {ownedMap[n] ? (
                              <>
                                <IconPin width={12} height={12} /> {ownedMap[n]}
                              </>
                            ) : (
                              'Not in archive'
                            )}
                          </span>
                        )}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}

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
  )

  if (panel)
    return (
      <>
        {inner}
        {lightboxSrc && (
          <ImageLightbox src={lightboxSrc} alt={film.title} onClose={() => setLightboxSrc(null)} defaultScale={film.itemType === 'series' ? 1.3 : 2} />
        )}
      </>
    )

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        {inner}
      </div>
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt={film.title} onClose={() => setLightboxSrc(null)} defaultScale={film.itemType === 'series' ? 1.3 : 2} />
      )}
    </>
  )
}
