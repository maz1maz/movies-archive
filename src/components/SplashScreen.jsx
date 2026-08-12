import { useEffect, useState } from 'react'
import { SPLASH_POSTERS } from '../data/splashPosters.js'
import { IconBrandMark } from './icons.jsx'

const HOLD_MS = 3200
const FADE_MS = 550

// Deterministic-enough shuffle so the tile order varies a bit between visits
// without needing any randomness library.
function shuffled(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function SplashScreen() {
  const [phase, setPhase] = useState('hold') // hold -> fading -> gone
  const [tiles] = useState(() => shuffled(SPLASH_POSTERS))

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('fading'), HOLD_MS)
    return () => clearTimeout(holdTimer)
  }, [])

  useEffect(() => {
    if (phase !== 'fading') return
    const fadeTimer = setTimeout(() => setPhase('gone'), FADE_MS)
    return () => clearTimeout(fadeTimer)
  }, [phase])

  if (phase === 'gone') return null

  return (
    <div className={`splash-screen ${phase === 'fading' ? 'splash-fading' : ''}`} aria-hidden="true">
      <div className="splash-poster-grid">
        {tiles.map((f, idx) => (
          <div className="splash-poster-tile" key={f.title + idx}>
            <img src={f.poster} alt="" loading="eager" />
          </div>
        ))}
      </div>
      <div className="splash-vignette" />
      <div className="splash-brand">
        <IconBrandMark className="splash-mark" />
        <div className="splash-wordmark">
          <span className="splash-wordmark-main">Cinefilm</span>
          <span className="splash-wordmark-sub">Archive</span>
        </div>
      </div>
    </div>
  )
}
