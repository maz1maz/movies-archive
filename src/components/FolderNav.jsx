import { IconLayers, IconTV, IconBarChart, IconDisc, IconStar, IconFilm } from './icons.jsx'
import PosterCollage from './PosterCollage.jsx'

// صفحه‌ی اول: مسیرهای مستقیم — فیزیکی فیلم/سریال، دیجیتال فیلم/سریال،
// مجموعه‌های ویژه، داشبورد
export default function FolderNav({
  onSelectPhysical,
  onSelectPhysicalSeries,
  onSelectDigitalType,
  onSelectSpecialCollections,
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
                <IconDisc width={32} height={32} />
              </span>
              <h2>Blu-ray Movies</h2>
              <p>Physical · {counts.physical} items</p>
            </button>
            <button className="folder-card reveal-item reveal-5" onClick={onSelectPhysicalSeries}>
              <span className="folder-icon">
                <IconLayers width={32} height={32} />
              </span>
              <h2>Blu-ray Series</h2>
              <p>Physical · {counts.physicalSeries || 0} items</p>
            </button>
            <button className="folder-card reveal-item reveal-6" onClick={() => onSelectDigitalType('movie')}>
              <span className="folder-icon">
                <IconFilm width={32} height={32} />
              </span>
              <h2>Digital Movies</h2>
              <p>Drive · {counts.digitalMovies} items</p>
            </button>
            <button className="folder-card reveal-item reveal-7" onClick={() => onSelectDigitalType('series')}>
              <span className="folder-icon">
                <IconTV width={32} height={32} />
              </span>
              <h2>Digital Series</h2>
              <p>Drive · {counts.digitalSeries} items</p>
            </button>
            <button className="folder-card reveal-item reveal-8" onClick={onSelectSpecialCollections}>
              <span className="folder-icon">
                <IconStar width={32} height={32} />
              </span>
              <h2>Special Collections</h2>
              <p>Coming soon</p>
            </button>
            <button className="folder-card folder-card-dashboard reveal-item reveal-9" onClick={onSelectDashboard}>
              <span className="folder-icon">
                <IconBarChart width={32} height={32} />
              </span>
              <h2>Dashboard</h2>
              <p>Info &amp; Statistics</p>
            </button>
          </div>
          <p className="marquee-footer reveal-item reveal-9">Admit one · no refunds · enjoy the show</p>
        </div>
      </div>
    </div>
  )
}
