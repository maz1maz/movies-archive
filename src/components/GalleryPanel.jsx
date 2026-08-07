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

    const vf = new Voroforce(containerRef.current, {
      cells: postersOnly.length,
      media: mediaConfig ?? { enabled: false },
      multiThreading: { enabled: false },
      ticker: { mode: 'auto' },
    })
    vfRef.current = vf

    const onCellSelected = (e) => {
      const cell = e.cell
      if (cell && postersOnly[cell.index]) onOpenFilm(postersOnly[cell.index])
    }
    vf.controls.listen('selected', onCellSelected)

    return () => {
      vf.controls.unlisten('selected', onCellSelected)
      vf.dispose?.()
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postersOnly.length, mediaStatus])

  return (
    <div className="folder-nav" style={{ overflow: 'hidden' }}>
      <button className="btn btn-ghost folder-back" onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, zIndex: 5 }}>
        ← Back
      </button>
      {mediaStatus === 'missing' && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 5,
            background: 'rgba(0,0,0,0.6)',
            color: '#eee',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          تکسچر پوسترها هنوز ساخته نشده — <code>node scripts/build-gallery-media.mjs</code> رو اجرا کن
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
    </div>
  )
}
