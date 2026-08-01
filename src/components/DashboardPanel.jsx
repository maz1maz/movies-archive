import { useState } from 'react'
import DashboardOverview from './DashboardOverview.jsx'
import OscarsPanel from './OscarsPanel.jsx'
import GenreTopsPanel from './GenreTopsPanel.jsx'
import CraftsPanel from './CraftsPanel.jsx'
import DashboardExportPanel from './DashboardExportPanel.jsx'
import DashboardRecommendPanel from './DashboardRecommendPanel.jsx'
import DashboardWatchlistsPanel from './DashboardWatchlistsPanel.jsx'
import { IconBarChart, IconTrophy, IconMasks, IconSun, IconMoon, IconSave, IconDice, IconClapper, IconBookshelf } from './icons.jsx'

const TABS = [
  { key: 'overview', label: 'Overview', icon: IconBarChart },
  { key: 'oscars', label: 'Oscars', icon: IconTrophy },
  { key: 'genretops', label: 'Genre Tops', icon: IconMasks },
  { key: 'crafts', label: 'Crafts', icon: IconClapper },
  { key: 'watchlists', label: 'Watchlists', icon: IconBookshelf },
  { key: 'recommend', label: 'Tonight', icon: IconDice },
  { key: 'export', label: 'Export & Backup', icon: IconSave },
]

const LAST_TAB_KEY = 'cinefilm-dashboard-last-tab'

export default function DashboardPanel({ films, onBack, onOpenFilm, onOpenPerson, theme, setTheme }) {
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
        {tab === 'overview' && <DashboardOverview films={films} />}
        {tab === 'oscars' && <OscarsPanel films={films} onOpenFilm={onOpenFilm} onOpenPerson={onOpenPerson} />}
        {tab === 'genretops' && <GenreTopsPanel films={films} onOpenFilm={onOpenFilm} />}
        {tab === 'crafts' && <CraftsPanel films={films} onOpenFilm={onOpenFilm} />}
        {tab === 'watchlists' && <DashboardWatchlistsPanel films={films} onOpenFilm={onOpenFilm} />}
        {tab === 'recommend' && <DashboardRecommendPanel films={films} onOpenFilm={onOpenFilm} />}
        {tab === 'export' && <DashboardExportPanel films={films} />}
      </div>
    </div>
  )
}
