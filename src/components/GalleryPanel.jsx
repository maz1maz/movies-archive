import { useEffect, useRef, useState } from 'react'
import { Voroforce } from '../voroforce/index'

// پنل «گالری» — نمای بصری voronoi از پوسترها با موتور واقعی Voroforce.
// از همون allFilmsUnfiltered که بقیه‌ی اپ استفاده می‌کنه تغذیه می‌شه،
// یعنی نیازی به دیتای جدا یا هماهنگ‌سازی دستی نیست.
export default function GalleryPanel({ films, onBack, onOpenFilm }) {
  const containerRef = useRef(null)
  const vfRef = useRef(null)
  const [mediaConfig, setMediaConfig] = useState(undefined)
  const [mediaStatus, setMediaStatus] = useState('loading') // 'loading' | 'ready' | 'missing'
  const [engineError, setEngineError] = useState(null)

  // خروجی scripts/build-gallery-media.mjs را می‌خواند.
  // اگر هنوز اجرا نشده، بدون تکسچر (فقط سلول‌های رنگی voronoi) نشون می‌ده.
  useEffect(() => {
    fetch('/gallery-media/vf-media-config.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        setMediaConfig(cfg || undefined)
        setMediaStatus(cfg ? 'ready' : 'missing')
      })
      .catch(() => setMediaStatus('missing'))
  }, [])

  // مهم: باید دقیقاً همون ترتیبی باشه که scripts/build-gallery-media.mjs
  // موقع ساخت اطلس استفاده کرده (sort بر اساس id) — وگرنه index هر سلول
  // به پوستر اشتباهی اشاره می‌کنه.
  const postersOnly = films
    .filter((f) => f.poster)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  useEffect(() => {
    if (!containerRef.current || postersOnly.length === 0 || mediaStatus === 'loading') return

    let vf
    let cancelled = false

    const init = () => {
      if (cancelled || !containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      if (clientWidth === 0 || clientHeight === 0) {
        // هنوز layout مرورگر کامل نشده (کانتینر اندازه‌ی صفر داره) — یه فریم
        // دیگه صبر کن. اگه بدون این چک بریم جلو، calculateOptimalLattice
        // موتور یه گرید ۱x۱ می‌سازه و برای هزاران سلول خطای «Invalid index»
        // پرت می‌کنه.
        requestAnimationFrame(init)
        return
      }
      try {
        vf = new Voroforce(containerRef.current, {
          cells: postersOnly.length,
          media: mediaConfig ?? { enabled: false },
          multiThreading: { enabled: false },
          ticker: { mode: 'auto' },
        })
        vfRef.current = vf
      } catch (err) {
        // اگه موتور (مثلاً به‌خاطر نبود WebGL2 روی این مرورگر/GPU) کرش کرد،
        // به‌جای صفحه‌ی مشکی بی‌توضیح، پیام خطا نشون بده و دکمه‌ی برگشت رو نگه دار
        console.error('Voroforce init failed:', err)
        setEngineError(err.message || String(err))
        return
      }

      const onCellSelected = (e) => {
        const cell = e.cell
        if (cell && postersOnly[cell.index]) onOpenFilm(postersOnly[cell.index])
      }
      vf.controls.listen('selected', onCellSelected)
      vf._onCellSelected = onCellSelected
    }

    init()

    return () => {
      cancelled = true
      if (vf) {
        vf.controls.unlisten('selected', vf._onCellSelected)
        vf.dispose?.()
      }
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postersOnly.length, mediaStatus])

  return (
    <div className="folder-nav" style={{ overflow: 'hidden' }}>
      {/* position: fixed تا مستقل از هر مشکل stacking/overflow توی این صفحه، همیشه بالا و کلیک‌پذیر بمونه */}
      <button
        className="btn btn-ghost"
        onClick={onBack}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.55)',
          color: '#f4f3f0',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          padding: '8px 16px',
          cursor: 'pointer',
        }}
      >
        ← Back
      </button>

      {mediaStatus === 'missing' && !engineError && (
        <div style={badgeStyle}>
          Poster texture not built yet — run <code>node scripts/build-gallery-media.mjs</code>
        </div>
      )}

      {engineError && (
        <div style={{ ...badgeStyle, top: 64, maxWidth: 420, right: 16, left: 'auto' }}>
          Gallery engine failed to start: {engineError}
          <br />
          (Check the browser console for details — F12)
        </div>
      )}

      <div ref={containerRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }} />
    </div>
  )
}

const badgeStyle = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 9999,
  background: 'rgba(0,0,0,0.6)',
  color: '#eee',
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
}
