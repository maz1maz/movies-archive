import { useEffect, useState } from 'react'
import { IconArchive, IconDisc, IconClapper, IconBookshelf } from './icons.jsx'

// یه زیرمجموعه‌ی تصادفی از پوسترها رو برای کلاژ پس‌زمینه انتخاب می‌کنه.
// posters اولش خالیه (چون allFilmsUnfiltered با تأخیر از سرور میاد)، پس
// نمی‌شه با useState(() => ...) یه‌بار برای همیشه محاسبه‌ش کرد — باید صبر
// کنیم داده واقعاً برسه، بعد فقط همون یه‌بار انتخاب تصادفی رو قفل کنیم.
function usePosterSample(posters, count = 14) {
  const [sample, setSample] = useState([])
  useEffect(() => {
    if (sample.length > 0) return
    const withPoster = (posters || []).filter(Boolean)
    if (withPoster.length === 0) return
    const shuffled = [...withPoster].sort(() => Math.random() - 0.5)
    setSample(shuffled.slice(0, count))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posters])
  return sample
}

// زاویه‌های ثابت و متنوع برای هر کارت پوستر — نه کاملاً شلخته و تصادفی،
// نه یه شبکه‌ی صاف و بی‌روح؛ حس یه دیوار پر از پوستر واقعی رو می‌ده.
const TILT_ANGLES = [-7, 4, -3, 6, -5, 3, -8, 5, -4, 7, -6, 2, -2, 8]

function PosterCollage({ posters }) {
  const sample = usePosterSample(posters)
  if (sample.length === 0) return null
  return (
    <div className="folder-collage" aria-hidden="true">
      <div className="folder-collage-grid">
        {sample.map((src, i) => (
          <div
            className="folder-collage-tile"
            key={i}
            style={{ '--tilt': `${TILT_ANGLES[i % TILT_ANGLES.length]}deg` }}
          >
            <img src={src} alt="" loading="lazy" />
          </div>
        ))}
      </div>
      <div className="folder-collage-overlay" />
    </div>
  )
}

// صفحه‌ی اول: انتخاب بین آرشیو فیزیکی و آرشیو دیجیتال
// صفحه‌ی دوم (فقط برای دیجیتال): انتخاب بین فیلم و سریال
export default function FolderNav({
  mode,
  onSelectPhysical,
  onSelectDigital,
  onSelectDigitalType,
  onBack,
  counts,
  posters,
}) {
  if (mode === 'digital') {
    return (
      <div className="folder-nav">
        <PosterCollage posters={posters} />
        <div className="folder-nav-content">
          <button className="btn btn-ghost folder-back" onClick={onBack}>
            ← بازگشت
          </button>
          <h1 className="folder-nav-title">آرشیو دیجیتال</h1>
          <div className="folder-grid">
            <button className="folder-card" onClick={() => onSelectDigitalType('movie')}>
              <span className="folder-icon">
                <IconClapper width={32} height={32} />
              </span>
              <h2>فیلم</h2>
              <p>{counts.digitalMovies} مورد</p>
            </button>
            <button className="folder-card" onClick={() => onSelectDigitalType('series')}>
              <span className="folder-icon">
                <IconBookshelf width={32} height={32} />
              </span>
              <h2>سریال</h2>
              <p>{counts.digitalSeries} مورد</p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="folder-nav">
      <PosterCollage posters={posters} />
      <div className="folder-nav-content">
        <h1 className="folder-nav-title">CINEFILIO ARCHIVE</h1>
        <div className="folder-grid">
          <button className="folder-card" onClick={onSelectPhysical}>
            <span className="folder-icon">
              <IconArchive width={32} height={32} />
            </span>
            <h2>Physical Collection</h2>
            <p>بلوری‌ها · {counts.physical} مورد</p>
          </button>
          <button className="folder-card" onClick={onSelectDigital}>
            <span className="folder-icon">
              <IconDisc width={32} height={32} />
            </span>
            <h2>Digital Library</h2>
            <p>هارد · {counts.digital} مورد</p>
          </button>
        </div>
      </div>
    </div>
  )
}
