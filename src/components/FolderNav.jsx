import { IconArchive, IconDisc, IconClapper, IconBookshelf } from './icons.jsx'

// صفحه‌ی اول: انتخاب بین آرشیو فیزیکی و آرشیو دیجیتال
// صفحه‌ی دوم (فقط برای دیجیتال): انتخاب بین فیلم و سریال
export default function FolderNav({ mode, onSelectPhysical, onSelectDigital, onSelectDigitalType, onBack, counts }) {
  if (mode === 'digital') {
    return (
      <div className="folder-nav">
        <button className="btn btn-ghost folder-back" onClick={onBack}>
          ← بازگشت
        </button>
        <h1 className="folder-nav-title">آرشیو دیجیتال</h1>
        <p className="folder-nav-subtitle">چی می‌خوای ببینی؟</p>
        <div className="folder-grid">
          <button className="folder-card" onClick={() => onSelectDigitalType('movie')}>
            <span className="folder-icon">
              <IconClapper width={34} height={34} />
            </span>
            <h2>فیلم</h2>
            <p>{counts.digitalMovies} مورد</p>
          </button>
          <button className="folder-card" onClick={() => onSelectDigitalType('series')}>
            <span className="folder-icon">
              <IconBookshelf width={34} height={34} />
            </span>
            <h2>سریال</h2>
            <p>{counts.digitalSeries} مورد</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="folder-nav">
      <h1 className="folder-nav-title">CINEFILIO ARCHIVE</h1>
      <p className="folder-nav-subtitle">کدوم بخش رو می‌خوای مرور کنی؟</p>
      <div className="folder-grid">
        <button className="folder-card" onClick={onSelectPhysical}>
          <span className="folder-icon">
            <IconArchive width={34} height={34} />
          </span>
          <h2>Physical Collection</h2>
          <p>بلوری‌ها · {counts.physical} مورد</p>
        </button>
        <button className="folder-card" onClick={onSelectDigital}>
          <span className="folder-icon">
            <IconDisc width={34} height={34} />
          </span>
          <h2>Digital Library</h2>
          <p>هارد · {counts.digital} مورد</p>
        </button>
      </div>
    </div>
  )
}
