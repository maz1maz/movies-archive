import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { proxyImg } from '../utils/proxyImg.js'
import {
  IconArchive,
  IconStar,
  IconLayers,
  IconBookshelf,
  IconHandshake,
  IconBarChart,
  IconTrophy,
  IconPin,
  IconSparkles,
} from './icons.jsx'

// Real titles from the archive, picked for a recognisable hero wall.
const SHOWCASE_POSTERS = [
  { title: 'The Godfather', year: 1972, poster: 'https://m.media-amazon.com/images/M/MV5BNGEwYjgwOGQtYjg5ZS00Njc1LTk2ZGEtM2QwZWQ2NjdhZTE5XkEyXkFqcGc@._V1_QL75_UY562_CR8,0,380,562_.jpg' },
  { title: 'The Dark Knight', year: 2008, poster: 'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_QL75_UX380_CR0,0,380,562_.jpg' },
  { title: 'Inception', year: 2010, poster: 'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_QL75_UX380_CR0,0,380,562_.jpg' },
  { title: 'Interstellar', year: 2014, poster: 'https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg' },
  { title: 'Goodfellas', year: 1990, poster: 'https://m.media-amazon.com/images/M/MV5BN2E5NzI2ZGMtY2VjNi00YTRjLWI1MDUtZGY5OWU1MWJjZjRjXkEyXkFqcGc@._V1_QL75_UX380_CR0,3,380,562_.jpg' },
  { title: 'The Matrix', year: 1999, poster: 'https://m.media-amazon.com/images/M/MV5BN2NmN2VhMTQtMDNiOS00NDlhLTliMjgtODE2ZTY0ODQyNDRhXkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg' },
  { title: 'Forrest Gump', year: 1994, poster: 'https://m.media-amazon.com/images/M/MV5BNDYwNzVjMTItZmU5YS00YjQ5LTljYjgtMjY2NDVmYWMyNWFmXkEyXkFqcGc@._V1_QL75_UY562_CR4,0,380,562_.jpg' },
  { title: 'The Good, the Bad and the Ugly', year: 1967, poster: 'https://m.media-amazon.com/images/M/MV5BMWM5ZjQxM2YtNDlmYi00ZDNhLWI4MWUtN2VkYjBlMTY1ZTkwXkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg' },
  { title: 'Fargo', year: 2014, poster: 'https://m.media-amazon.com/images/M/MV5BMjMzMTIzMTUwN15BMl5BanBnXkFtZTgwNjE0NTg0MTE@._V1_SX300.jpg' },
  { title: 'The Godfather Part II', year: 1974, poster: 'https://m.media-amazon.com/images/M/MV5BMDIxMzBlZDktZjMxNy00ZGI4LTgxNDEtYWRlNzRjMjJmOGQ1XkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg' },
  { title: 'Stop Making Sense', year: 1984, poster: 'https://m.media-amazon.com/images/M/MV5BOTY2Y2EzMTctYTZiMC00YzEzLWIwMDItODQyYWUyY2U2MTk4XkEyXkFqcGc@._V1_SX300.jpg' },
  { title: 'Death Note', year: 2006, poster: 'https://m.media-amazon.com/images/M/MV5BYTgyZDhmMTEtZDFhNi00MTc4LTg3NjUtYWJlNGE5Mzk2NzMxXkEyXkFqcGc@._V1_SX300.jpg' },
]

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

function StatBlock({ value, label }) {
  return (
    <div className="landing-stat">
      <span className="landing-stat-value">{value}</span>
      <span className="landing-stat-label">{label}</span>
    </div>
  )
}

export default function Landing() {
  const { openLogin } = useAuth()
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    fetch('/api/films/counts')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object' && !data.error) setCounts(data)
      })
      .catch(() => {})
  }, [])

  const totalTitles = counts ? (Number(counts.physical || 0) + Number(counts.digital || 0)).toLocaleString('en-US') : '15,781'
  const physicalCount = counts ? Number(counts.physical || 0).toLocaleString('en-US') : '5,147'
  const digitalCount = counts ? Number(counts.digital || 0).toLocaleString('en-US') : '10,634'

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <span className="landing-logo">
            <IconArchive width={22} height={22} />
            <span>
              Cinefilm Archive
              <small>Alireza Mazlaghani</small>
            </span>
          </span>
          <button type="button" className="btn btn-primary landing-nav-cta" onClick={openLogin}>
            Log in
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-text">
            <span className="landing-eyebrow">
              <IconSparkles width={14} height={14} /> A personal film archive
            </span>
            <h1>
              Every disc, every drive,
              <br />
              one archive.
            </h1>
            <p>
              A physical and digital media catalogue built to actually find things — by shelf,
              by drive, by director, by the night you decide to rewatch something.
            </p>
            <div className="landing-hero-actions">
              <button type="button" className="btn btn-primary landing-cta-lg" onClick={openLogin}>
                Log in to the archive
              </button>
            </div>
            <div className="landing-stats">
              <StatBlock value={totalTitles} label="titles catalogued" />
              <StatBlock value={physicalCount} label="physical discs" />
              <StatBlock value={digitalCount} label="digital titles" />
            </div>
          </div>

          <div className="landing-hero-wall" aria-hidden="true">
            {SHOWCASE_POSTERS.map((f, i) => (
              <div className="landing-poster" key={f.title} style={{ '--i': i }}>
                <img src={proxyImg(f.poster)} alt="" loading={i < 4 ? 'eager' : 'lazy'} />
              </div>
            ))}
          </div>
        </section>

        <section className="landing-features">
          <h2>Built for a collection that outgrew a spreadsheet</h2>
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

        <section className="landing-cta">
          <IconBookshelf width={26} height={26} />
          <h2>Step inside the archive</h2>
          <p>Log in to browse the full catalogue, shelves and all.</p>
          <button type="button" className="btn btn-primary landing-cta-lg" onClick={openLogin}>
            Log in
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <p>
          <IconArchive width={14} height={14} /> Cinefilm Archive — personal physical-media
          collection of Alireza Mazlaghani
        </p>
      </footer>
    </div>
  )
}
