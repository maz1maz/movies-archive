import { IconArchive, IconDisc, IconClapper, IconBookshelf } from './icons.jsx'
import PosterCollage from './PosterCollage.jsx'

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
            ← Back
          </button>
          <h1 className="folder-nav-title">Digital Library</h1>
          <div className="folder-grid">
            <button className="folder-card" onClick={() => onSelectDigitalType('movie')}>
              <span className="folder-icon">
                <IconClapper width={32} height={32} />
              </span>
              <h2>Movies</h2>
              <p>{counts.digitalMovies} items</p>
            </button>
            <button className="folder-card" onClick={() => onSelectDigitalType('series')}>
              <span className="folder-icon">
                <IconBookshelf width={32} height={32} />
              </span>
              <h2>Series</h2>
              <p>{counts.digitalSeries} items</p>
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
            <p>Blu-rays · {counts.physical} items</p>
          </button>
          <button className="folder-card" onClick={onSelectDigital}>
            <span className="folder-icon">
              <IconDisc width={32} height={32} />
            </span>
            <h2>Digital Library</h2>
            <p>Drive · {counts.digital} items</p>
          </button>
        </div>
      </div>
    </div>
  )
}
