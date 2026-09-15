import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const HOLD_MS = 4200
const FADE_MS = 650

export default function SplashScreen() {
  // ویدیو فقط وقتی نشون داده می‌شه که قراره صفحه‌ی لاگین بیاد (یعنی مهمونی).
  // اگه از قبل لاگینی، ویدیو رد می‌شه و مستقیم همون توالی قدیمی (عکس splash
  // با hold/fade) شروع می‌شه — دیگه هر رفرش ویدیو نمیاد.
  const { isGuest, loading: authLoading } = useAuth()
  const [phase, setPhase] = useState('checking') // checking -> video|hold -> fading -> gone

  useEffect(() => {
    if (phase !== 'checking' || authLoading) return
    setPhase(isGuest ? 'video' : 'hold')
  }, [phase, authLoading, isGuest])

  useEffect(() => {
    if (phase !== 'hold') return
    const holdTimer = setTimeout(() => setPhase('fading'), HOLD_MS)
    return () => clearTimeout(holdTimer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'fading') return
    const fadeTimer = setTimeout(() => setPhase('gone'), FADE_MS)
    return () => clearTimeout(fadeTimer)
  }, [phase])

  if (phase === 'gone') return null

  // تا وضعیت لاگین معلوم بشه، یه صفحه‌ی ساده‌ی تیره (بدون فلیکر) نشون بده.
  if (phase === 'checking') {
    return <div className="splash-screen" aria-hidden="true" />
  }

  if (phase === 'video') {
    return (
      <div className="splash-screen" aria-hidden="true" onClick={() => setPhase('gone')} style={{ cursor: 'pointer' }}>
        <video
          autoPlay
          preload="auto"
          muted
          playsInline
          onEnded={() => setPhase('gone')}
          style={{ width: '100%', height: '100%' }}
          className="splash-video"
        >
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>
      </div>
    )
  }

  return (
    <div className={`splash-screen ${phase === 'fading' ? 'splash-fading' : ''}`} aria-hidden="true">
      <img src="/splash-cinefilm-archive.jpg" alt="" className="splash-image" loading="eager" />
    </div>
  )
}
