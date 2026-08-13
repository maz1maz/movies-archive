import { useEffect, useState } from 'react'

const HOLD_MS = 4200
const FADE_MS = 650

export default function SplashScreen() {
  const [phase, setPhase] = useState('hold') // hold -> fading -> gone

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
      <img src="/splash-cinefilm-archive.jpg" alt="" className="splash-image" loading="eager" />
    </div>
  )
}
