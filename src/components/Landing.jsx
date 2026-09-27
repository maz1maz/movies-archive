import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { proxyImg } from '../utils/proxyImg.js'
import { SHOWCASE_POSTERS, HERO_WALL_EXTRA_POSTERS } from '../data/showcasePosters.js'
import LandingShowcase from './LandingShowcase.jsx'
import {
  IconStar,
  IconLayers,
  IconBookshelf,
  IconHandshake,
  IconBarChart,
  IconTrophy,
  IconPin,
  IconSparkles,
  IconSearch,
  IconDisc,
  IconClapper,
  IconTV,
} from './icons.jsx'

// Real posters from the archive, used for the ambient drifting wall behind
// the hero and picked for a recognisable, high-rating mix.
const WALL_POSTERS = [...SHOWCASE_POSTERS, ...HERO_WALL_EXTRA_POSTERS]

const FEATURES = [
  {
    icon: IconLayers,
    title: 'Physical and digital, one archive',
    body: 'Blu-ray discs, DVDs and digital rips live in the same catalogue, so you always know exactly what you own and where.',
  },
  {
    icon: IconStar,
    title: 'Real IMDb ratings and details',
    body: 'Every title carries its rating, cast, director, genre and synopsis, kept in sync so the archive stays accurate.',
  },
  {
    icon: IconPin,
    title: 'Exact shelf and drive locations',
    body: 'Closet, row and shelf for physical media, drive number for digital — find any title in seconds.',
  },
  {
    icon: IconBarChart,
    title: 'A dashboard for the whole collection',
    body: 'Decades, genres, directors, watch history and more, visualised across the entire archive.',
  },
  {
    icon: IconHandshake,
    title: 'Loan tracking',
    body: 'Know who borrowed what disc and when it is due back, without losing track of a single title.',
  },
  {
    icon: IconTrophy,
    title: 'Festival and awards badges',
    body: 'Criterion spine numbers, Oscar wins and festival honours are marked right on the poster.',
  },
]

const ROTATING_WORDS = ['Criterion spines', '4K UHD discs', 'NAS rips', 'box sets']

function PosterWallBackground() {
  const columns = 6
  const perCol = 5
  return (
    <div className="landing-wall" aria-hidden="true">
      <div className="landing-wall-grid">
        {Array.from({ length: columns }).map((_, col) => {
          const items = Array.from({ length: perCol }).map(
            (_, i) => WALL_POSTERS[(col * perCol + i) % WALL_POSTERS.length]
          )
          const loop = [...items, ...items]
          return (
            <div
              key={col}
              className={`landing-wall-col ${col % 2 === 0 ? 'landing-wall-up' : 'landing-wall-down'} ${col >= 4 ? 'landing-wall-lg' : ''} ${col === 3 ? 'landing-wall-sm' : ''}`}
              style={{ '--dur': `${86 + col * 9}s` }}
            >
              {loop.map((src, i) => (
                <div className="landing-wall-poster" key={`${col}-${i}`}>
                  <img src={proxyImg(src)} alt="" loading={col < 2 && i < 2 ? 'eager' : 'lazy'} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <div className="landing-wall-tone" />
      <div className="landing-wall-vignette" />
    </div>
  )
}

export default function Landing() {
  const { openLogin } = useAuth()
  const [counts, setCounts] = useState(null)
  const [decades, setDecades] = useState(null)
  const [wordIdx, setWordIdx] = useState(0)

  useEffect(() => {
    fetch('/api/films/counts')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object' && !data.error) setCounts(data)
      })
      .catch(() => {})
    fetch('/api/decades')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDecades(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING_WORDS.length), 2600)
    return () => clearInterval(t)
  }, [])

  const physical = counts ? Number(counts.physical || 0) : 5147
  const physicalSeries = counts ? Number(counts.physicalSeries || 0) : 214
  const digitalMovies = counts ? Number(counts.digitalMovies || 0) : 9974
  const digitalSeries = counts ? Number(counts.digitalSeries || 0) : 660
  const total = physical + physicalSeries + digitalMovies + digitalSeries
  const fmt = (n) => n.toLocaleString('en-US')

  const tiles = [
    { icon: IconArchiveLike, label: 'Blu-ray Movies', meta: `Physical · ${fmt(physical)} items` },
    { icon: IconLayers, label: 'Blu-ray Series', meta: `Physical · ${fmt(physicalSeries)} sets` },
    { icon: IconClapper, label: 'Digital Movies', meta: `Drive · ${fmt(digitalMovies)} items` },
    { icon: IconTV, label: 'Digital Series', meta: `Drive · ${fmt(digitalSeries)} items` },
    { icon: IconTrophy, label: 'Criterion Collection', meta: 'Special editions' },
    { icon: IconBarChart, label: 'Dashboard', meta: 'Info & statistics' },
  ]

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <span className="landing-logo">
            <img src="/logo.png" alt="" width="30" height="30" className="landing-logo-img" />
            <span className="landing-logo-word">
              Cinefilm<span className="landing-gold-word">Archive</span>
            </span>
          </span>
          <button type="button" className="landing-btn landing-btn-outline landing-nav-cta" onClick={openLogin}>
            Log in
          </button>
        </div>
      </header>

      <section className="landing-hero grain">
        <PosterWallBackground />

        <div className="landing-hero-inner">
          <div className="landing-hero-text">
            <span className="landing-eyebrow">
              <span className="landing-pulse-dot" />
              Now showing · personal film archive
            </span>

            <h1 className="landing-h1">
              Every film you own,
              <br />
              <span className="landing-gold-text landing-serif-italic">finally in one archive.</span>
            </h1>

            <p className="landing-hero-copy">
              A physical and digital media catalogue built to actually find things — turning a
              wall of shelves and years of hard drives into one searchable, beautiful record.
            </p>

            <div className="landing-rotating" aria-live="polite">
              <IconSparkles width={15} height={15} className="landing-rotating-icon" />
              <span>Built for</span>
              <span className="landing-rotating-word" key={wordIdx}>
                {ROTATING_WORDS[wordIdx]}
              </span>
            </div>

            <div className="landing-hero-actions">
              <button type="button" className="landing-btn landing-btn-gold landing-btn-lg" onClick={openLogin}>
                Log in to the archive
              </button>
              <a href="#features" className="landing-btn landing-btn-outline landing-btn-lg">
                See what's inside
              </a>
            </div>

            <div className="landing-mini-stats">
              <div className="landing-mini-stat">
                <span className="landing-hero-stat-num">{fmt(total)}</span>
                <span>titles catalogued</span>
              </div>
              {counts?.minYear && (
                <div className="landing-mini-stat">
                  <span className="landing-hero-stat-num">{counts.minYear}</span>
                  <span>earliest title</span>
                </div>
              )}
              {decades?.length > 0 && (
                <div className="landing-mini-stat">
                  <span className="landing-hero-stat-num">{decades.length}</span>
                  <span>decades represented</span>
                </div>
              )}
            </div>
          </div>

          <div className="landing-panel-wrap">
            <div className="landing-panel-glow" aria-hidden="true" />
            <div className="landing-panel glass">
              <div className="landing-search">
                <IconSearch width={17} height={17} />
                <span>Search the archive…</span>
                <kbd>⌘K</kbd>
              </div>

              <div className="landing-tiles">
                {tiles.map((t) => (
                  <div className="landing-tile" key={t.label}>
                    <span className="landing-tile-icon">
                      <t.icon width={17} height={17} />
                    </span>
                    <span className="landing-tile-text">
                      <span className="landing-tile-label">{t.label}</span>
                      <span className="landing-tile-meta">{t.meta}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-chip landing-chip-a glass">
              <span className="landing-chip-dot" />
              Archive online
            </div>
            <div className="landing-chip landing-chip-b glass">
              <IconTrophy width={17} height={17} className="landing-gold-icon" />
              <span>
                <b>{fmt(physical + physicalSeries)}</b> physical titles on the shelf
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-section-head">
          <span className="landing-eyebrow landing-eyebrow-static">Inside the archive</span>
          <h2>
            Built for a collection that
            <br />
            <span className="landing-gold-text landing-serif-italic">outgrew a spreadsheet.</span>
          </h2>
        </div>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div className="landing-feature-card" key={f.title}>
              <span className="landing-feature-icon">
                <f.icon width={18} height={18} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <LandingShowcase />

      <section className="landing-cta">
        <IconBookshelf width={26} height={26} className="landing-gold-icon" />
        <h2>Step inside the archive</h2>
        <p>Log in to browse the full catalogue, shelves and all.</p>
        <button type="button" className="landing-btn landing-btn-gold landing-btn-lg" onClick={openLogin}>
          Log in
        </button>
      </section>

      <footer className="landing-footer">
        <p>Cinefilm Archive — personal physical-media collection of Alireza Mazlaghani</p>
      </footer>
    </div>
  )
}

function IconArchiveLike(props) {
  return <IconDisc {...props} />
}
