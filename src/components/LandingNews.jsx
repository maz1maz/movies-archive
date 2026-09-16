import { useEffect, useState } from 'react'
import { proxyImg } from '../utils/proxyImg.js'
import { IconClapperPlay } from './icons.jsx'

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

// یه پیش‌نمایش عمومی از صفحه‌ی «اخبار سینما» رو تو لندینگ نشون می‌ده — فقط
// فیلم‌های در راه (TMDB، عمومی)، هیچ داده‌ی مربوط به کالکشن شخصی کاربر
// (تولدها/در راهِ کالکشن) اینجا نیست؛ سرور هم برای مهمون‌ها اونا رو خالی
// برمی‌گردونه.
export default function LandingNews() {
  const [movies, setMovies] = useState([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/cinema-news')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const list = data?.generalUpcoming?.movies || []
        setMovies(list.slice(0, 6))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (movies.length === 0) return null

  return (
    <section className="landing-news">
      <div className="landing-section-head">
        <span className="landing-eyebrow landing-eyebrow-static">Coming soon</span>
        <h2>
          New releases worth
          <br />
          <span className="landing-gold-text landing-serif-italic">making room on the shelf for.</span>
        </h2>
      </div>
      <div className="landing-news-strip">
        {movies.map((m) => (
          <a
            key={`${m.title}-${m.releaseDate}`}
            className="landing-news-card"
            href={m.infoUrl || `https://www.themoviedb.org/search?query=${encodeURIComponent(m.title)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {m.poster ? (
              <img src={proxyImg(m.poster)} alt="" loading="lazy" className="landing-news-poster" />
            ) : (
              <span className="landing-news-poster landing-news-poster-empty">
                <IconClapperPlay width={20} height={20} />
              </span>
            )}
            <span className="landing-news-info">
              <span className="landing-news-title">{m.title}</span>
              <span className="landing-news-date">{formatDate(m.releaseDate)}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
