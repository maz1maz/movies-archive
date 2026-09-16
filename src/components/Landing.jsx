import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { proxyImg } from '../utils/proxyImg.js'
import { SHOWCASE_POSTERS, HERO_WALL_EXTRA_POSTERS } from '../data/showcasePosters.js'
import LandingShowcase from './LandingShowcase.jsx'
import LandingNews from './LandingNews.jsx'
import CinemaNewsPage from './CinemaNewsPage.jsx'
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

// یه زیرمجموعه‌ی کوچیک از پوسترهای تاییدشده، برای «قفسه»ی داخل پنل شیشه‌ای
// هیرو — به‌جای لیست آیکون‌های ساده، پوسترهای واقعی به شکل یه ردیف قفسه‌ی
// فیزیکی (کج، هم‌پوشان) چیده می‌شن.
const SHELF_STRIP_POSTERS = SHOWCASE_POSTERS.slice(0, 6)
const SHELF_TILTS = [-4, 3, -2, 4, -3, 2]

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
  const { theme, setTheme } = useTheme()
  const [counts, setCounts] = useState(null)
  const [decades, setDecades] = useState(null)
  const [wordIdx, setWordIdx] = useState(0)
  const [newsOpen, setNewsOpen] = useState(false)

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

  // مهمون‌ها هم می‌تونن نسخه‌ی عمومیِ صفحه‌ی «اخبار سینما» رو ببینن — بخش‌های
  // شخصی (تولدهای کالکشن، در راهِ کالکشن) چون سرور برای مهمون خالی برمی‌گردونه
  // خودشون مخفی می‌مونن؛ films=null یعنی دکمه‌ی «Order» (که به لاگین نیاز داره)
  // هم نشون داده نمی‌شه.
  if (newsOpen) {
    return (
      <CinemaNewsPage
        onBack={() => setNewsOpen(false)}
        onSelectPerson={openLogin}
        theme={theme}
        setTheme={setTheme}
        films={null}
      />
    )
  }

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
              Personal film archive · refined
            </span>

            <h1 className="landing-h1">
              Your entire cinematic world,
              <br />
              <span className="landing-gold-text landing-serif-italic">in a dream's splendor.</span>
            </h1>

            <p className="landing-hero-copy">
              No clunky spreadsheets. No lost discs. Just your pure obsession, transformed into a
              sleek, searchable private cinema.
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

              <div className="landing-panel-shelf">
                {SHELF_STRIP_POSTERS.map((src, i) => (
                  <div
                    className="landing-panel-shelf-poster"
                    key={src}
                    style={{ '--tilt': `${SHELF_TILTS[i % SHELF_TILTS.length]}deg` }}
                  >
                    <img src={proxyImg(src)} alt="" loading="lazy" />
                  </div>
                ))}
                <div className="landing-panel-shelf-ledge" aria-hidden="true" />
              </div>

              <div className="landing-panel-stats">
                {tiles.map((t) => (
                  <span className="landing-panel-stat" key={t.label}>
                    <t.icon width={13} height={13} />
                    {t.label}
                  </span>
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
            When a hobby turns into heritage,
            <br />
            <span className="landing-gold-text landing-serif-italic">it deserves better than Excel.</span>
          </h2>
        </div>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div className="landing-feature-card" key={f.title}>
              <span className="landing-feature-icon">
                <f.icon width={22} height={22} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <LandingShowcase />

      <LandingNews onSeeMore={() => setNewsOpen(true)} />

      <section className="landing-cta">
        <IconBookshelf width={26} height={26} className="landing-gold-icon" />
        <h2>Step inside the archive</h2>
        <p>Log in to browse the full catalogue, shelves and all.</p>
        <button type="button" className="landing-btn landing-btn-gold landing-btn-lg" onClick={openLogin}>
          Log in
        </button>
      </section>

      <footer className="landing-footer">
        <p className="landing-footer-tagline">
          One ticket, infinite stories{counts?.minYear ? ` · ${counts.minYear}–${new Date().getFullYear()}` : ''}
        </p>
        <p>Cinefilm Archive — personal physical-media collection of Alireza Mazlaghani</p>
      </footer>
    </div>
  )
}

function IconArchiveLike(props) {
  return <IconDisc {...props} />
}
