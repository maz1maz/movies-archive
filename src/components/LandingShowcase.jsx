import { useState } from 'react'
import { proxyImg } from '../utils/proxyImg.js'
import { SHOWCASE_POSTERS } from '../data/showcasePosters.js'
import { IconGrid, IconDisc, IconBarChart, IconSearch, IconPin, IconStar, IconLayers, IconFilm, IconHandshake, IconShare } from './icons.jsx'

// نمونه‌ی واقعی از خودِ آرشیو — یه فیلم که هم نسخه‌ی فیزیکی هم دیجیتال داره،
// تا نشون بده کلیک رو یه پوستر دقیقاً چه چیزی رو باز می‌کنه (فرمت‌ها،
// لوکیشن قفسه/درایو، امتیاز، خلاصه‌ی داستان).
const DETAIL_FILM = {
  title: 'A Bad Moms Christmas',
  year: 2017,
  genre: 'Comedy',
  runtime: '1h 44m',
  rating: 5.6,
  synopsis:
    'A Bad Moms Christmas is a 2017 American Christmas comedy film written and directed by Jon Lucas and Scott Moore. It is a sequel to the 2016 film Bad Moms. The plot follows the three moms from the first film dealing with their own mothers visiting during the Christmas holiday.',
  studio: 'STX Entertainment',
  physicalLoc: 'Closet 1 · Shelf 2 · Row 1',
  digitalLoc: 'Drive 11',
  poster: 'https://m.media-amazon.com/images/M/MV5BMTUwNTA4MDMxNl5BMl5BanBnXkFtZTgwMjE4NjQ0MzI@._V1_SX300.jpg',
}

// Real physical titles with their actual shelf location and rating. Also
// carries the same kind of detail (genres/synopsis/studio/box office)
// shown on a film's own detail page, so the showcase gives a fuller idea
// of what opening a title actually looks like.
const SHELF_TITLES = [
  {
    title: 'Alien',
    year: 1979,
    rating: 8.5,
    loc: 'C1 · R5 · S1',
    genres: ['Sci-Fi', 'Horror'],
    synopsis: 'The crew of the commercial spacecraft Nostromo encounter a deadly lifeform after investigating a distress signal.',
    studio: '20th Century Fox',
    boxOffice: '$203M',
    poster: 'https://m.media-amazon.com/images/M/MV5BN2NhMDk2MmEtZDQzOC00MmY5LThhYzAtMDdjZGFjOGZjMjdjXkEyXkFqcGc@._V1_QL75_UX380_CR0,6,380,562_.jpg',
  },
  {
    title: 'Apocalypse Now',
    year: 1979,
    rating: 8.4,
    loc: 'C1 · R6 · S2',
    genres: ['War', 'Drama'],
    synopsis: 'A U.S. Army officer is sent on a dangerous mission into Cambodia to assassinate a renegade colonel.',
    studio: 'United Artists',
    boxOffice: '$150M',
    poster: 'https://m.media-amazon.com/images/M/MV5BZDhiMTljYjYtODc1Yy00MmEwLTg2OTYtYmE1YTRmNDE4MmEwXkEyXkFqcGc@._V1_QL75_UX380_CR0,11,380,562_.jpg',
  },
  {
    title: 'Avengers: Endgame',
    year: 2019,
    rating: 8.4,
    loc: 'C1 · R7 · S2',
    genres: ['Action', 'Sci-Fi', 'Adventure'],
    synopsis: "The Avengers assemble once more to reverse Thanos' actions and restore balance to the universe.",
    studio: 'Marvel Studios',
    boxOffice: '$2.80B',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTc5MDE2ODcwNV5BMl5BanBnXkFtZTgwMzI2NzQ2NzM@._V1_QL75_UX380_CR0,0,380,562_.jpg',
  },
  {
    title: 'The Apartment',
    year: 1960,
    rating: 8.3,
    loc: 'C1 · R6 · S2',
    genres: ['Comedy', 'Drama', 'Romance'],
    synopsis: 'A lonely office worker lends out his apartment to philandering executives, then falls for one of their mistresses.',
    studio: 'United Artists',
    boxOffice: '$18.6M',
    poster: 'https://m.media-amazon.com/images/M/MV5BNDdhMzVhOWQtNDU2Mi00ZmZmLWJiZDMtY2QxMjhjY2Y1ZTI5XkEyXkFqcGc@._V1_SX300.jpg',
  },
  {
    title: 'A Clockwork Orange',
    year: 1971,
    rating: 8.2,
    loc: 'C1 · R2 · S1',
    genres: ['Crime', 'Sci-Fi', 'Drama'],
    synopsis: 'In a near-future Britain, young Alex leads his gang on a spree of violence before a controversial state rehabilitation.',
    studio: 'Warner Bros.',
    boxOffice: '$26.6M',
    poster: 'https://m.media-amazon.com/images/M/MV5BMTY3MjM1Mzc4N15BMl5BanBnXkFtZTgwODM0NzAxMDE@._V1_SX300.jpg',
  },
  {
    title: 'A Brighter Summer Day',
    year: 1991,
    rating: 8.2,
    loc: 'C1 · R2 · S1',
    criterion: true,
    genres: ['Drama', 'Crime'],
    synopsis: 'A teenager in 1960s Taipei is drawn into gang rivalries and first love against a backdrop of political unrest.',
    studio: 'Central Motion Pictures',
    poster: 'https://m.media-amazon.com/images/M/MV5BMGRkNGQwOTktNWQxOS00ZDRjLThmODktNWY4NThjNDU2MjM5XkEyXkFqcGc@._V1_SX300.jpg',
  },
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
  { id: 'detail', label: 'Film page', icon: IconFilm },
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
      {SHELF_TITLES.map((t) => (
        <div className="showcase-shelf-row" key={t.title}>
          <img src={proxyImg(t.poster)} alt="" loading="lazy" className="showcase-shelf-poster" />
          <div className="showcase-shelf-body">
            <div className="showcase-shelf-top">
              <div className="showcase-shelf-title">
                <p>{t.title}</p>
                <span>
                  {t.year}
                  {t.criterion ? ' · Criterion' : ''}
                </span>
              </div>
              <div className="showcase-shelf-meta-right">
                <span className="showcase-shelf-loc">
                  <IconPin width={11} height={11} /> {t.loc}
                </span>
                <span className="showcase-shelf-rating">
                  <IconStar width={12} height={12} /> {t.rating}
                </span>
              </div>
            </div>
            <div className="showcase-shelf-tags">
              {t.genres.map((g) => (
                <span className="showcase-tag" key={g}>
                  {g}
                </span>
              ))}
            </div>
            <p className="showcase-shelf-synopsis">{t.synopsis}</p>
            <p className="showcase-shelf-studio">
              {t.studio}
              {t.boxOffice ? ` · ${t.boxOffice} box office` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function FilmDetailPreview() {
  const f = DETAIL_FILM
  return (
    <div className="showcase-detail">
      <img src={proxyImg(f.poster)} alt="" loading="lazy" className="showcase-detail-poster" />
      <div className="showcase-detail-body">
        <h3 className="showcase-detail-title">
          {f.title} <span className="showcase-detail-year">({f.year})</span>
        </h3>
        <p className="showcase-detail-meta">
          {f.year} · {f.genre} · {f.runtime}
        </p>
        <div className="showcase-detail-formats">
          <span className="showcase-detail-format showcase-detail-format-physical">
            <IconDisc width={12} height={12} /> Blu-ray
          </span>
          <span className="showcase-detail-loc">
            <IconPin width={11} height={11} /> {f.physicalLoc}
          </span>
          <span className="showcase-detail-format showcase-detail-format-digital">
            <IconFilm width={12} height={12} /> Digital
          </span>
          <span className="showcase-detail-loc">
            <IconPin width={11} height={11} /> {f.digitalLoc}
          </span>
        </div>
        <span className="showcase-detail-rating">
          <IconStar width={13} height={13} /> IMDb {f.rating}/10
        </span>
        <p className="showcase-shelf-synopsis">{f.synopsis}</p>
        <p className="showcase-shelf-studio">{f.studio}</p>
        <div className="showcase-detail-actions">
          <span className="showcase-detail-action">
            <IconHandshake width={13} height={13} /> Lend film
          </span>
          <span className="showcase-detail-action">
            <IconShare width={13} height={13} /> Share
          </span>
        </div>
      </div>
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
          {tab === 'detail' && <FilmDetailPreview />}
          {tab === 'collections' && <CollectionsList />}
          {tab === 'stats' && <Dashboard />}
        </div>
      </div>
    </section>
  )
}
