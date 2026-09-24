import { lazy, Suspense, useState } from 'react'
import DashboardOverview from './DashboardOverview.jsx'
import { IconBarChart, IconTrophy, IconMasks, IconSun, IconMoon, IconSave, IconDice, IconClapper, IconBookshelf, IconLayers, IconHandshake, IconSparkles, IconCheck, IconDocument, IconUser, IconGlobe } from './icons.jsx'

// Lazy: می‌کشه d3-geo/topojson-client/world-atlas/i18n-iso-countries رو تو
// باندل که فقط برای رسم نقشه‌ی کشورها لازمن — کدسپلیت می‌کنیم تا این حجم
// اضافه فقط وقتی کاربر واقعاً تب Countries رو باز می‌کنه دانلود بشه.
const CountriesMapPanel = lazy(() => import('./CountriesMapPanel.jsx'))

const OscarsPanel = lazy(() => import('./OscarsPanel.jsx'))
const GenreTopsPanel = lazy(() => import('./GenreTopsPanel.jsx'))
const CraftsPanel = lazy(() => import('./CraftsPanel.jsx'))
const DashboardExportPanel = lazy(() => import('./DashboardExportPanel.jsx'))
const DashboardRecommendPanel = lazy(() => import('./DashboardRecommendPanel.jsx'))
const DashboardWatchlistsPanel = lazy(() => import('./DashboardWatchlistsPanel.jsx'))
const DashboardDuplicatesPanel = lazy(() => import('./DashboardDuplicatesPanel.jsx'))
const DashboardLoanedPanel = lazy(() => import('./DashboardLoanedPanel.jsx'))
const DashboardOrderListPanel = lazy(() => import('./DashboardOrderListPanel.jsx'))
const DashboardRoadmapPanel = lazy(() => import('./DashboardRoadmapPanel.jsx'))
const DashboardHealthPanel = lazy(() => import('./DashboardHealthPanel.jsx'))
const DashboardAuditPanel = lazy(() => import('./DashboardAuditPanel.jsx'))
const DashboardApiUsagePanel = lazy(() => import('./DashboardApiUsagePanel.jsx'))
const DashboardFollowedPanel = lazy(() => import('./DashboardFollowedPanel.jsx'))
const DashboardCollectionsPanel = lazy(() => import('./DashboardCollectionsPanel.jsx'))
const DashboardWrappedPanel = lazy(() => import('./DashboardWrappedPanel.jsx'))

const TABS = [
  { key: 'overview', label: 'Overview', icon: IconBarChart },
  { key: 'wrapped', label: 'Wrapped', icon: IconSparkles },
  { key: 'oscars', label: 'Oscars', icon: IconTrophy },
  { key: 'genretops', label: 'Genre Tops', icon: IconMasks },
  { key: 'countries', label: 'Countries', icon: IconGlobe },
  { key: 'crafts', label: 'Crafts', icon: IconClapper },
  { key: 'watchlists', label: 'Watchlists', icon: IconBookshelf },
  { key: 'followed', label: 'Following', icon: IconUser },
  { key: 'collections', label: 'Collections', icon: IconLayers },
  { key: 'health', label: 'DB Health', icon: IconCheck },
  { key: 'audit', label: 'Audit Trail', icon: IconDocument },
  { key: 'apiusage', label: 'API Usage', icon: IconBarChart },
  { key: 'duplicates', label: 'Duplicates', icon: IconLayers },
  { key: 'loaned', label: 'Loaned Out', icon: IconHandshake },
  { key: 'orderlist', label: 'Order List', icon: IconSave },
  { key: 'recommend', label: 'Tonight', icon: IconDice },
  { key: 'export', label: 'Export & Backup', icon: IconSave },
  { key: 'roadmap', label: 'Roadmap', icon: IconSparkles },
]

const LAST_TAB_KEY = 'cinefilm-dashboard-last-tab'

export default function DashboardPanel({ films, onBack, onOpenFilm, onOpenPerson, theme, setTheme, onFilmsChanged, isAdmin }) {
  const [tab, setTab] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_TAB_KEY) : null
    return TABS.some((t) => t.key === saved) ? saved : 'overview'
  })

  const changeTab = (key) => {
    setTab(key)
    try {
      window.localStorage.setItem(LAST_TAB_KEY, key)
    } catch {
      // ذخیره‌سازی محلی در دسترس نبود؛ مشکلی نیست، فقط تب پیش‌فرض می‌مونه
    }
  }

  return (
    <div className="dashboard-panel">
      <div className="container">
        <div className="dashboard-topbar">
          <button className="btn btn-ghost folder-back" onClick={onBack}>
            ← Back
          </button>
          {setTheme && (
            <button
              className="btn btn-ghost theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle dark / light"
            >
              {theme === 'dark' ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
            </button>
          )}
        </div>
        <p className="dashboard-eyebrow">Behind the scenes</p>
        <h1 className="dashboard-title">Dashboard</h1>
        <nav className="dashboard-subnav">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => changeTab(t.key)} title={t.label}>
                <Icon width={14} height={14} />
                <span className="dashboard-tab-label">{t.label}</span>
              </button>
            )
          })}
        </nav>
        {tab === 'overview' && <DashboardOverview films={films} onOpenFilm={onOpenFilm} onOpenPerson={onOpenPerson} isAdmin={isAdmin} onFilmsChanged={onFilmsChanged} />}
        <Suspense fallback={<div className="dashboard-panel-loading">Loading…</div>}>
          {tab === 'wrapped' && <DashboardWrappedPanel films={films} onOpenPerson={onOpenPerson} />}
          {tab === 'oscars' && <OscarsPanel films={films} onOpenFilm={onOpenFilm} onOpenPerson={onOpenPerson} />}
          {tab === 'genretops' && <GenreTopsPanel films={films} onOpenFilm={onOpenFilm} />}
          {tab === 'countries' && <CountriesMapPanel films={films} onOpenFilm={onOpenFilm} />}
          {tab === 'crafts' && <CraftsPanel films={films} onOpenFilm={onOpenFilm} />}
          {tab === 'watchlists' && <DashboardWatchlistsPanel films={films} onOpenFilm={onOpenFilm} onFilmsChanged={onFilmsChanged} />}
          {tab === 'followed' && <DashboardFollowedPanel onOpenPerson={onOpenPerson} />}
          {tab === 'collections' && <DashboardCollectionsPanel films={films} onOpenFilm={onOpenFilm} />}
          {tab === 'health' && <DashboardHealthPanel films={films} onOpenFilm={onOpenFilm} onFilmsChanged={onFilmsChanged} />}
          {tab === 'audit' && <DashboardAuditPanel films={films} onOpenFilm={onOpenFilm} />}
          {tab === 'apiusage' && <DashboardApiUsagePanel />}
          {tab === 'duplicates' && <DashboardDuplicatesPanel films={films} onOpenFilm={onOpenFilm} onFilmsChanged={onFilmsChanged} />}
          {tab === 'loaned' && <DashboardLoanedPanel films={films} onOpenFilm={onOpenFilm} />}
          {tab === 'orderlist' && <DashboardOrderListPanel />}
          {tab === 'recommend' && <DashboardRecommendPanel films={films} onOpenFilm={onOpenFilm} />}
          {tab === 'export' && <DashboardExportPanel films={films} />}
          {tab === 'roadmap' && <DashboardRoadmapPanel />}
        </Suspense>
      </div>
    </div>
  )
}
