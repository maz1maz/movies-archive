import { useState } from 'react'
import DashboardOverview from './DashboardOverview.jsx'
import OscarsPanel from './OscarsPanel.jsx'
import GenreTopsPanel from './GenreTopsPanel.jsx'
import CraftsPanel from './CraftsPanel.jsx'
import DashboardExportPanel from './DashboardExportPanel.jsx'
import DashboardRecommendPanel from './DashboardRecommendPanel.jsx'
import { IconBarChart, IconTrophy, IconMasks, IconSun, IconMoon, IconSave, IconDice, IconClapper } from './icons.jsx'

const TABS = [
  { key: 'overview', label: 'Overview', icon: IconBarChart },
  { key: 'oscars', label: 'Oscars', icon: IconTrophy },
  { key: 'genretops', label: 'Genre Tops', icon: IconMasks },
  { key: 'crafts', label: 'Crafts', icon: IconClapper },
  { key: 'recommend', label: 'Tonight', icon: IconDice },
  { key: 'export', label: 'Export & Backup', icon: IconSave },
]

export default function DashboardPanel({ films, onBack, onOpenFilm, onOpenPerson, theme, setTheme }) {
  const [tab, setTab] = useState('overview')

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
        <h1 className="dashboard-title">Dashboard</h1>
        <nav className="dashboard-subnav">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                <Icon width={14} height={14} />
                {t.label}
              </button>
            )
          })}
        </nav>
        {tab === 'overview' && <DashboardOverview films={films} />}
        {tab === 'oscars' && <OscarsPanel films={films} onOpenFilm={onOpenFilm} onOpenPerson={onOpenPerson} />}
        {tab === 'genretops' && <GenreTopsPanel films={films} onOpenFilm={onOpenFilm} />}
        {tab === 'crafts' && <CraftsPanel films={films} onOpenFilm={onOpenFilm} />}
        {tab === 'recommend' && <DashboardRecommendPanel films={films} onOpenFilm={onOpenFilm} />}
        {tab === 'export' && <DashboardExportPanel films={films} />}
      </div>
    </div>
  )
}
