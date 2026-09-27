import { useEffect, useRef, useState } from 'react'
import { IconStar, IconPin, IconDisc, IconClapper } from './icons.jsx'
import StarRating from './StarRating.jsx'
import { proxyImg } from '../utils/proxyImg.js'
import { parseDriveNumbers, driveLabel, driveSortValue } from '../utils/driveDisplay.js'

// پالت رنگی برای کارت‌هایی که پوستر ندارن
const PALETTE = [
  ['#3a2f5b', '#1f1830'],
  ['#5b3a3a', '#301f1f'],
  ['#2f5b4f', '#183026'],
  ['#5b4f2f', '#302618'],
  ['#2f3f5b', '#182330'],
  ['#4f2f5b', '#261830'],
]

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export default function FilmCard({ film, onSelect, onToggleWatch, hasBluray, hasDigital }) {
  const [c1, c2] = PALETTE[hashCode(String(film.id)) % PALETTE.length]
  const isDigital = film.mediaType === 'digital'

  // برای سریال‌ها، فیلد کلی driveNumber می‌تونه با seasonDrives هماهنگ نباشه
  // (چون هر فصل جدا جابه‌جا می‌شه) — پس بج رو از مجموع درایوهای همه‌ی
  // فصل‌ها می‌سازیم، نه از فیلد کلی
  const driveDisplay = (() => {
    if (!isDigital) return ''
    if (film.itemType === 'series' && Array.isArray(film.seasonDrives) && film.seasonDrives.length) {
      const set = new Set()
      film.seasonDrives.forEach((sd) => parseDriveNumbers(sd.drive).forEach((d) => set.add(d)))
      if (set.size) return [...set].sort((a, b) => driveSortValue(a) - driveSortValue(b)).map((d) => `Drive ${d}`).join(', ')
    }
    return film.driveNumber ? driveLabel(film.driveNumber) : ''
  })()
  const hasLocation = isDigital ? driveDisplay : film.closet || film.shelf || film.row

  // پوسترهای جایگزین (از TMDB) — فقط وقتی کارت واقعاً تو دیدرسه fetch می‌شن
  // (IntersectionObserver)، تا برای صدها کارت خارج از صفحه درخواست الکی نره.
  // فقط با هاور موس می‌چرخن (نه خودکار همیشه) تا صفحه اذیت‌کننده نشه.
  const cardRef = useRef(null)
  const [altPosters, setAltPosters] = useState(null)
  const [posterIndex, setPosterIndex] = useState(0)
  const [festivalAwards, setFestivalAwards] = useState(
    Array.isArray(film.festivalAwards) ? film.festivalAwards : []
  )

  useEffect(() => {
    setAltPosters(null)
    setPosterIndex(0)
    setFestivalAwards(Array.isArray(film.festivalAwards) ? film.festivalAwards : [])
  }, [film.id, film.festivalAwards])

  useEffect(() => {
    if (altPosters !== null) return
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetch(`/api/films/${film.id}/alt-posters`)
            .then((r) => r.json())
            .then((data) => setAltPosters(Array.isArray(data.posters) ? data.posters : []))
            .catch(() => setAltPosters([]))
          // همیشه fetch می‌شه، ولی سرور خودش چک می‌کنه که قبلاً resolve شده یا
          // نه (raw column، نه نسخه‌ی parse‌شده‌ی کلاینت که null رو با [] یکی
          // می‌کنه) — پس برای فیلم‌های از‌قبل‌چک‌شده فقط یه خوندن ساده از DBه.
          fetch(`/api/films/${film.id}/festival-awards`)
            .then((r) => r.json())
            .then((data) => setFestivalAwards(Array.isArray(data.awards) ? data.awards : []))
            .catch(() => {})
          observer.disconnect()
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [film.id, altPosters])

  const posterList = altPosters && altPosters.length > 0 ? [film.poster, ...altPosters] : null

  // چرخشِ بر اساس «دیده شدن» رو موبایل امتحان شد ولی مزاحم بود (کلی کارت
  // هم‌زمان رو صفحه پوستر عوض می‌کردن، حواس‌پرت‌کننده بود). الان فقط رو
  // دستگاه‌هایی که واقعاً هاور دارن (موس/دسکتاپ) فعاله؛ موبایل/تاچ کاملاً
  // خاموشه و همون پوستر اصلی ثابت می‌مونه.
  const supportsHover =
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches
  const [isHovering, setIsHovering] = useState(false)
  useEffect(() => {
    if (!supportsHover || !isHovering || !posterList || posterList.length < 2) return
    const id = setInterval(() => {
      setPosterIndex((i) => (i + 1) % posterList.length)
    }, 2500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovering, posterList?.length])

  const displayedPoster = posterList ? posterList[posterIndex] : film.poster

  const handleMouseEnter = () => setIsHovering(true)
  const handleMouseLeave = () => {
    setIsHovering(false)
    setPosterIndex(0)
  }

  // چرخه‌ی وضعیت تماشا با کلیک روی بج: ندیده → واچ‌لیست‌شده (زرد) →
  // دیده‌شده (سبز) → دوباره ندیده
  const status = film.watched ? 'watched' : film.watchlisted ? 'watchlisted' : 'unwatched'
  const statusLabel = status === 'watched' ? '✓ Watched' : status === 'watchlisted' ? '☆ Watchlisted' : 'Unwatched'
  const handleBadgeClick = (e) => {
    e.stopPropagation()
    if (!onToggleWatch) return
    if (status === 'unwatched') onToggleWatch(film, { watchlisted: true, watched: false })
    else if (status === 'watchlisted') onToggleWatch(film, { watchlisted: false, watched: true })
    else onToggleWatch(film, { watchlisted: false, watched: false })
  }

  return (
    <button
      ref={cardRef}
      type="button"
      className={[
        'card',
        film.criterion && 'card-criterion',
        hasBluray && 'card-has-bluray',
        hasDigital && 'card-has-digital',
      ].filter(Boolean).join(' ')}
      data-film-id={film.id}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(film)
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="poster"
        style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}
      >
        <img
          key={displayedPoster}
          src={proxyImg(displayedPoster)}
          alt={film.title}
          loading="lazy"
          className="poster-img-fade"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        {typeof film.rating === 'number' && (
          <span className="rating-badge">
            <IconStar width={11} height={11} /> {film.rating.toFixed(1)}
          </span>
        )}
        <span
          className={`watched-badge ${status}`}
          onClick={handleBadgeClick}
          title="Click to change watch status"
        >
          {statusLabel}
        </span>
        {hasLocation && (
          <div className="poster-badge-stack poster-badge-stack-right">
            <span className="location-badge">
              <IconPin width={11} height={11} />{' '}
              {isDigital ? driveDisplay : `C${film.closet || '–'} R${film.row || '–'} S${film.shelf || '–'}`}
            </span>
            {hasDigital && (
              <span className="digital-badge" title="Digital copy also owned">
                <IconClapper width={11} height={11} /> DIGITAL
              </span>
            )}
          </div>
        )}
        {!hasLocation && hasDigital && (
          <div className="poster-badge-stack poster-badge-stack-right">
            <span className="digital-badge" title="Digital copy also owned">
              <IconClapper width={11} height={11} /> DIGITAL
            </span>
          </div>
        )}
        {(film.criterion || hasBluray || festivalAwards.length > 0) && (
          <div className="poster-badge-stack poster-badge-stack-left">
            {festivalAwards
              .filter((a) => a.festival)
              .slice(0, 1)
              .map((a) => (
                <span
                  key={a.festival}
                  className="festival-award-badge"
                  style={{ background: a.color }}
                  title={a.year ? `${a.award} (${a.year})` : a.award}
                >
                  {a.icon} {a.festival}
                </span>
              ))}
            {film.criterion && (
              <span className="criterion-badge">
                CRITERION{film.criterionCopies > 1 ? ` ×${film.criterionCopies}` : ''}
              </span>
            )}
            {hasBluray && (
              <span className="bluray-badge" title="Blu-ray copy also owned">
                <IconDisc width={11} height={11} /> BLU-RAY
              </span>
            )}
          </div>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">
          {film.title}
          {film.copies > 1 && <span className="copies-badge">×{film.copies}</span>}
        </h3>
        <p className="card-meta">
          {film.year || '—'} · {(Array.isArray(film.genre) ? film.genre : (film.genre || '').split(',').map(g => g.trim()).filter(Boolean)).slice(0, 2).join(', ')}
          {film.editionType && !/^theatrical$/i.test(film.editionType.trim()) && (
            <span className="edition-type-tag"> · {film.editionType}</span>
          )}
        </p>
        {film.myRating > 0 && <StarRating value={film.myRating} size={13} />}
      </div>
    </button>
  )
}
