import { IconArchive, IconClapper, IconBookshelf, IconBarChart } from './icons.jsx'
import PosterCollage from './PosterCollage.jsx'

// صفحه‌ی اول: چهار مسیر مستقیم — فیزیکی، دیجیتال فیلم، دیجیتال سریال، داشبورد
export default function FolderNav({
  onSelectPhysical,
  onSelectDigitalType,
  onSelectDashboard,
  counts,
  posters,
}) {
  return (
    <div className="folder-nav">
      <span className="stage-curtain" aria-hidden="true" />
      <PosterCollage posters={posters} />
      <div className="folder-nav-content">
        <div className="marquee-band">
          <img src="/logo.png" alt="Cinefilm Archive" className="folder-nav-logo reveal-item reveal-1" />
          <p className="marquee-eyebrow reveal-item reveal-2">Now showing</p>
          <h1 className="folder-nav-title reveal-item reveal-3">Cinefilm Archive</h1>
          <div className="folder-grid">
            <button className="folder-card reveal-item reveal-4" onClick={onSelectPhysical}>
              <span className="folder-icon">
                <IconArchive width={32} height={32} />
              </span>
              <h2>Physical Collection</h2>
              <p>Blu-rays · {counts.physical} items</p>
            </button>
            <button className="folder-card reveal-item reveal-5" onClick={() => onSelectDigitalType('movie')}>
              <span className="folder-icon">
                <IconClapper width={32} height={32} />
              </span>
              <h2>Digital Movies</h2>
              <p>Drive · {counts.digitalMovies} items</p>
            </button>
            <button className="folder-card reveal-item reveal-6" onClick={() => onSelectDigitalType('series')}>
              <span className="folder-icon">
                <IconBookshelf width={32} height={32} />
              </span>
              <h2>Digital Series</h2>
              <p>Drive · {counts.digitalSeries} items</p>
            </button>
            <button className="folder-card folder-card-dashboard reveal-item reveal-7" onClick={onSelectDashboard}>
              <span className="folder-icon">
                <IconBarChart width={32} height={32} />
              </span>
              <h2>Dashboard</h2>
              <p>Info &amp; Statistics</p>
            </button>
          </div>
          <p className="marquee-footer reveal-item reveal-8">Admit one · no refunds · enjoy the show</p>
        </div>
      </div>
    </div>
  )
}
