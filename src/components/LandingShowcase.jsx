import { useState } from 'react'
import { proxyImg } from '../utils/proxyImg.js'
import { SHOWCASE_POSTERS } from '../data/showcasePosters.js'
import { IconGrid, IconDisc, IconBarChart, IconSearch, IconPin, IconStar, IconLayers } from './icons.jsx'

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

// Genre breakdown (snapshot), shown as a share of the largest genre so the
// bars read the same way the decade chart does.
const GENRES = [
  { label: 'Drama', pct: 100 },
  { label: 'Comedy', pct: 62 },
  { label: 'Action', pct: 58 },
  { label: 'Thriller', pct: 51 },
  { label: 'Crime', pct: 47 },
  { label: 'Documentary', pct: 33 },
  { label: 'Sci-Fi', pct: 29 },
  { label: 'Horror', pct: 24 },
]

// Franchise/series completion — the same "PART OF: X COLLECTION (n/n IN
// ARCHIVE)" idea already shown inside a film's own detail page.
const COLLECTIONS = [
  { name: 'James Bond Collection', have: 26, total: 26 },
  { name: 'Star Wars Saga', have: 9, total: 9 },
  { name: 'The Godfather Trilogy', have: 3, total: 3 },
  { name: 'Indiana Jones', have: 5, total: 5 },
  { name: 'The Lord of the Rings (Extended)', have: 6, total: 6 },
  { name: 'Marvel Cinematic Universe', have: 33, total: 34 },
]

const TABS = [
  { id: 'wall', label: 'Poster wall', icon: IconGrid },
  { id: 'shelf', label: 'Shelf detail', icon: IconDisc },
  { id: 'collections', label: 'Collections', icon: IconLayers },
  { id: 'stats', label: 'Dashboard', icon: IconBarChart },
]

function PosterGrid() {
  return (
    <div className="showcase-poster-grid">
      {SHOWCASE_POSTERS.map((src, i) => (
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

function CollectionsList() {
  return (
    <div className="showcase-collections">
      {COLLECTIONS.map((c) => {
        const pct = Math.round((c.have / c.total) * 100)
        const complete = c.have >= c.total
        return (
          <div className="showcase-collection-card" key={c.name}>
            <div className="showcase-collection-head">
              <span className="showcase-collection-name">{c.name}</span>
              <span className={complete ? 'showcase-collection-count showcase-collection-complete' : 'showcase-collection-count'}>
                {c.have}/{c.total} in archive
              </span>
            </div>
            <div className="showcase-collection-track">
              <div className="showcase-collection-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Dashboard() {
  return (
    <div className="showcase-dashboard">
      <div className="showcase-dashboard-charts">
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
        <div className="showcase-decade-card">
          <div className="showcase-decade-head">
            <h4>Collection by genre</h4>
            <span>top 8</span>
          </div>
          <div className="showcase-genre-list">
            {GENRES.map((g) => (
              <div className="showcase-genre-row" key={g.label}>
                <span className="showcase-genre-label">{g.label}</span>
                <div className="showcase-genre-track">
                  <div className="showcase-genre-fill" style={{ width: `${g.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
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
          {tab === 'collections' && <CollectionsList />}
          {tab === 'stats' && <Dashboard />}
        </div>
      </div>
    </section>
  )
}
