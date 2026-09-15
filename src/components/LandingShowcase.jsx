import { useState } from 'react'
import { proxyImg } from '../utils/proxyImg.js'
import { IconGrid, IconDisc, IconBarChart, IconSearch, IconPin, IconStar } from './icons.jsx'

// Real posters from the archive, used for the "poster wall" tab.
const WALL_TAB_POSTERS = [
  'https://m.media-amazon.com/images/M/MV5BOTA5MWFhMzAtOWU1OS00Yjk4LTlkNGItNGI3N2VkNzcyNGU2XkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BNGEwYjgwOGQtYjg5ZS00Njc1LTk2ZGEtM2QwZWQ2NjdhZTE5XkEyXkFqcGc@._V1_QL75_UY562_CR8,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BYzE3ZmY0NjctMmZhZS00OTI1LWI3YWEtMjNmZGU4ZDdlMTMzXkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BZjJiODRiNDUtMGMzZi00NzM1LTlhOGMtNDhiOTY4NmViM2Q2XkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BZjUwOTJkMmUtYjdmOS00OWIxLThmYzEtYzJkMGI3MmVhYjIzXkEyXkFqcGdeQXVyMDM1MzIyMQ@@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BMDIxMzBlZDktZjMxNy00ZGI4LTgxNDEtYWRlNzRjMjJmOGQ1XkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BOGU4YzhhMTAtNjg1MC00NzY2LTg0NGQtOWJmNGQwNzgyOGE0XkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BYTgyZDhmMTEtZDFhNi00MTc4LTg3NjUtYWJlNGE5Mzk2NzMxXkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BZmUzZjk0NjEtOTFjMC00NDI2LTkwZmEtZWIxYjVjNDEwNWZiXkEyXkFqcGc@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BMjMzMTIzMTUwN15BMl5BanBnXkFtZTgwNjE0NTg0MTE@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BNDYwNzVjMTItZmU5YS00YjQ5LTljYjgtMjY2NDVmYWMyNWFmXkEyXkFqcGc@._V1_QL75_UY562_CR4,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BZDc2YzhkODAtZmRmZS00YzcxLWJkYWEtM2ZhZjY3MmMyZmJiXkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg',
  'https://m.media-amazon.com/images/M/MV5BNjQ1MDUxYzYtMzEyZC00MGFjLWE1MDAtYTk5OGQzNGI2Zjg4XkEyXkFqcGdeQXVyMzkwMDE3Mg@@._V1_SX300.jpg',
  'https://m.media-amazon.com/images/M/MV5BMWM5ZjQxM2YtNDlmYi00ZDNhLWI4MWUtN2VkYjBlMTY1ZTkwXkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg',
]

// Real physical titles with their actual shelf location and rating.
const SHELF_TITLES = [
  { title: 'Alien', year: 1979, rating: 8.5, loc: 'C1 · R5 · S1', poster: 'https://m.media-amazon.com/images/M/MV5BN2NhMDk2MmEtZDQzOC00MmY5LThhYzAtMDdjZGFjOGZjMjdjXkEyXkFqcGc@._V1_QL75_UX380_CR0,6,380,562_.jpg' },
  { title: 'Apocalypse Now', year: 1979, rating: 8.4, loc: 'C1 · R6 · S2', poster: 'https://m.media-amazon.com/images/M/MV5BZDhiMTljYjYtODc1Yy00MmEwLTg2OTYtYmE1YTRmNDE4MmEwXkEyXkFqcGc@._V1_QL75_UX380_CR0,11,380,562_.jpg' },
  { title: 'Avengers: Endgame', year: 2019, rating: 8.4, loc: 'C1 · R7 · S2', poster: 'https://m.media-amazon.com/images/M/MV5BMTc5MDE2ODcwNV5BMl5BanBnXkFtZTgwMzI2NzQ2NzM@._V1_QL75_UX380_CR0,0,380,562_.jpg' },
  { title: 'The Apartment', year: 1996, rating: 8.3, loc: 'C1 · R6 · S2', poster: 'https://m.media-amazon.com/images/M/MV5BNDdhMzVhOWQtNDU2Mi00ZmZmLWJiZDMtY2QxMjhjY2Y1ZTI5XkEyXkFqcGc@._V1_SX300.jpg' },
  { title: 'A Clockwork Orange', year: 1971, rating: 8.2, loc: 'C1 · R2 · S1', poster: 'https://m.media-amazon.com/images/M/MV5BMTY3MjM1Mzc4N15BMl5BanBnXkFtZTgwODM0NzAxMDE@._V1_SX300.jpg' },
  { title: 'A Brighter Summer Day', year: 1991, rating: 8.2, loc: 'C1 · R2 · S1', criterion: true, poster: 'https://m.media-amazon.com/images/M/MV5BMGRkNGQwOTktNWQxOS00ZDRjLThmODktNWY4NThjNDU2MjM5XkEyXkFqcGc@._V1_SX300.jpg' },
]

// Real decade breakdown computed from the archive (snapshot).
const DECADES = [
  { label: '30s', pct: 7 },
  { label: '40s', pct: 12 },
  { label: '50s', pct: 23 },
  { label: '60s', pct: 30 },
  { label: '70s', pct: 35 },
  { label: '80s', pct: 22 },
  { label: '90s', pct: 23 },
  { label: '00s', pct: 31 },
  { label: '10s', pct: 100 },
  { label: '20s', pct: 28 },
]

const STAT_CARDS = [
  { k: 'Total runtime', v: '2y 337d', s: 'if watched back to back, non-stop' },
  { k: 'Most collected', v: 'Woody Allen · 68', s: 'followed by Hitchcock · 61' },
  { k: 'Titles with a rating', v: '14,768', s: 'synced from IMDb' },
]

const TABS = [
  { id: 'wall', label: 'Poster wall', icon: IconGrid },
  { id: 'shelf', label: 'Shelf detail', icon: IconDisc },
  { id: 'stats', label: 'Dashboard', icon: IconBarChart },
]

function PosterGrid() {
  return (
    <div className="showcase-poster-grid">
      {WALL_TAB_POSTERS.map((src, i) => (
        <figure className="showcase-poster" key={src}>
          <img src={proxyImg(src)} alt="" loading="lazy" decoding="async" />
        </figure>
      ))}
    </div>
  )
}

function ShelfList() {
  return (
    <div className="showcase-shelf">
      <div className="showcase-shelf-head">
        <span>Title</span>
        <span className="showcase-shelf-col">Location</span>
        <span className="showcase-shelf-col-right">Rating</span>
      </div>
      {SHELF_TITLES.map((t) => (
        <div className="showcase-shelf-row" key={t.title}>
          <div className="showcase-shelf-title">
            <img src={proxyImg(t.poster)} alt="" loading="lazy" />
            <div>
              <p>{t.title}</p>
              <span>
                {t.year}
                {t.criterion ? ' · Criterion' : ''}
              </span>
            </div>
          </div>
          <span className="showcase-shelf-col showcase-shelf-loc">
            <IconPin width={11} height={11} /> {t.loc}
          </span>
          <span className="showcase-shelf-col-right showcase-shelf-rating">
            <IconStar width={12} height={12} /> {t.rating}
          </span>
        </div>
      ))}
    </div>
  )
}

function Dashboard() {
  return (
    <div className="showcase-dashboard">
      <div className="showcase-decade-card">
        <div className="showcase-decade-head">
          <h4>Collection by decade</h4>
          <span>15,995 titles</span>
        </div>
        <div className="showcase-decade-bars">
          {DECADES.map((d) => (
            <div className="showcase-decade-bar-col" key={d.label}>
              <div className="showcase-decade-bar-track">
                <div className="showcase-decade-bar" style={{ height: `${d.pct}%` }} />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="showcase-stat-cards">
        {STAT_CARDS.map((c) => (
          <div className="showcase-stat-card" key={c.k}>
            <p className="showcase-stat-k">{c.k}</p>
            <p className="showcase-stat-v">{c.v}</p>
            <p className="showcase-stat-s">{c.s}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LandingShowcase() {
  const [tab, setTab] = useState('wall')

  return (
    <section className="showcase" id="showcase">
      <div className="landing-section-head">
        <span className="landing-eyebrow landing-eyebrow-static">Archive tour</span>
        <h2>
          Your archive,
          <br />
          <span className="landing-gold-text landing-serif-italic">the way it deserves to look.</span>
        </h2>
      </div>

      <div className="showcase-tabs" role="tablist" aria-label="Archive views">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`showcase-tab ${tab === t.id ? 'showcase-tab-active' : ''}`}
          >
            <t.icon width={15} height={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="showcase-window glass">
        <div className="showcase-chrome">
          <div className="showcase-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="showcase-address">
            <IconSearch width={13} height={13} />
            <span>cinefilm-archive · library</span>
          </div>
        </div>
        <div className="showcase-panel">
          {tab === 'wall' && <PosterGrid />}
          {tab === 'shelf' && <ShelfList />}
          {tab === 'stats' && <Dashboard />}
        </div>
      </div>
    </section>
  )
}
