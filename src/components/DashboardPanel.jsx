import { useState } from 'react'
import DashboardOverview from './DashboardOverview.jsx'
import OscarsPanel from './OscarsPanel.jsx'
import GenreTopsPanel from './GenreTopsPanel.jsx'
import { IconBarChart, IconTrophy, IconMasks } from './icons.jsx'

const TABS = [
  { key: 'overview', label: 'Overview', icon: IconBarChart },
  { key: 'oscars', label: 'Oscars', icon: IconTrophy },
  { key: 'genretops', label: 'Genre Tops', icon: IconMasks },
]

export default function DashboardPanel({ films, onBack, onOpenFilm, onOpenPerson }) {
  const [tab, setTab] = useState('overview')

  return (
    <div className="dashboard-panel">
      <div className="container">
        <button className="btn btn-ghost folder-back" onClick={onBack}>
          ← Back
        </button>
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
      </div>
    </div>
  )
}
