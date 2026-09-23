import { useState } from 'react'
import { proxyImg } from '../utils/proxyImg.js'

// Top studios/networks in the archive with a representative poster & year.
const STUDIOS = [
  { name: 'Netflix', count: 132, year: 2020, title: "The Queen's Gambit", poster: 'https://static.tvmaze.com/uploads/images/original_untouched/510/1275203.jpg' },
  { name: 'HBO', count: 35, year: 2019, title: 'Chernobyl', poster: 'https://static.tvmaze.com/uploads/images/original_untouched/193/482599.jpg' },
  { name: 'Prime Video', count: 34, year: 2015, title: 'The Expanse', poster: 'https://static.tvmaze.com/uploads/images/original_untouched/445/1114081.jpg' },
  { name: 'Columbia Pictures', count: 24, year: 1961, title: 'A Raisin in the Sun', poster: 'https://commons.wikimedia.org/wiki/Special:FilePath/A%20Raisin%20in%20the%20Sun%20%281961%20film%20poster%29.jpg' },
  { name: 'Paramount Pictures', count: 23, year: 1951, title: 'Ace in the Hole', poster: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ace%20in%20the%20Hole%20%281951%20film%20poster%29.jpg' },
  { name: 'Metro-Goldwyn-Mayer', count: 20, year: 1935, title: 'A Tale of Two Cities', poster: 'https://upload.wikimedia.org/wikipedia/en/5/53/A_Tale_of_Two_Cities_1935_film.JPG' },
  { name: 'Warner Bros. Entertainment', count: 19, year: 1971, title: 'A Clockwork Orange', poster: 'https://m.media-amazon.com/images/M/MV5BMTY3MjM1Mzc4N15BMl5BanBnXkFtZTgwODM0NzAxMDE@._V1_SX300.jpg' },
  { name: 'FX', count: 18, year: 2014, title: 'Fargo', poster: 'https://m.media-amazon.com/images/M/MV5BMjMzMTIzMTUwN15BMl5BanBnXkFtZTgwNjE0NTg0MTE@._V1_SX300.jpg' },
  { name: 'Universal Pictures', count: 15, year: 2022, title: 'All Quiet on the Western Front', poster: 'https://upload.wikimedia.org/wikipedia/en/c/c3/All_quiet_on_the_western_front_%282022_film%29.jpg' },
  { name: '20th Century Studios', count: 15, year: 1950, title: 'All About Eve', poster: 'https://commons.wikimedia.org/wiki/Special:FilePath/All%20About%20Eve%20%281950%20poster%20-%20retouch%29.jpg' },
  { name: 'AMC', count: 11, year: 2008, title: 'Breaking Bad', poster: 'https://static.tvmaze.com/uploads/images/original_untouched/501/1253519.jpg' },
  { name: 'Marvel Studios', count: 6, year: 2015, title: 'Avengers: Age of Ultron', poster: 'https://m.media-amazon.com/images/M/MV5BODBhYTg1NGQtNGVmNS00ZTdiLThjYTYtZDFkNzRiNTZmNDZjXkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg' },
]

export default function StudioShowcase() {
  const [active, setActive] = useState(0)

  return (
    <section className="showcase studio-showcase" id="studios">
      <div className="landing-section-head">
        <span className="landing-eyebrow landing-eyebrow-static">By the numbers</span>
        <h2>
          Studios behind
          <br />
          <span className="landing-gold-text landing-serif-italic">every title on the shelf.</span>
        </h2>
      </div>

      <div className="studio-hover-rail glass" onMouseLeave={() => setActive(0)}>
        {STUDIOS.map((s, i) => (
          <button
            type="button"
            key={s.name}
            className={`studio-hover-col ${i === active ? 'studio-hover-col-active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
          >
            <span className="studio-hover-bg">
              <img src={proxyImg(s.poster)} alt="" loading="lazy" decoding="async" />
              <span className="studio-hover-scrim" />
            </span>
            <span className="studio-hover-year">{s.year}</span>
            <span className="studio-hover-label">
              {s.name}
              <em>{s.count} titles</em>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
