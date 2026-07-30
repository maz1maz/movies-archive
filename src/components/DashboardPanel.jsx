import { useState } from 'react'
import OscarsPanel from './OscarsPanel.jsx'
import { IconTrophy } from './icons.jsx'

const TABS = [{ key: 'oscars', label: 'Oscars', icon: IconTrophy }]

export default function DashboardPanel({ films, onBack, onOpenFilm }) {
  const [tab, setTab] = useState('oscars')

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
        {tab === 'oscars' && <OscarsPanel films={films} onOpenFilm={onOpenFilm} />}
      </div>
    </div>
  )
}
