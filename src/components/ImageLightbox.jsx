import { useEffect, useState } from 'react'
import { IconClose } from './icons.jsx'

const MIN_SCALE = 1
const MAX_SCALE = 4

// نمایش یه عکس (پوستر فیلم یا عکس بازیگر) به‌صورت بزرگ و وسط صفحه.
// چرخوندن دکمه‌ی موس روی عکس زوم می‌کنه، کلیک روی پس‌زمینه یا Escape می‌بندتش.
export default function ImageLightbox({ src, alt, onClose, grayscale = false }) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    // با فاز capture ثبت می‌شه تا قبل از هر keydown-listener دیگه‌ای
    // (مثلاً مودال زیرینِ فیلم/بازیگر) اجرا بشه و جلوی بسته‌شدن هردوشون
    // با یه Escape رو بگیره.
    window.addEventListener('keydown', onKey, true)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // با هر عکس تازه (یا فیلم/بازیگر جدید)، زوم از اول شروع بشه
  useEffect(() => {
    setScale(1)
  }, [src])

  if (!src) return null

  const handleWheel = (e) => {
    e.preventDefault()
    setScale((prev) => {
      const next = prev - e.deltaY * 0.0015
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
    })
  }

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <IconClose width={16} height={16} />
      </button>
      <img
        src={src}
        alt={alt || ''}
        className={grayscale ? 'lightbox-img lightbox-img-gray' : 'lightbox-img'}
        style={{ transform: `scale(${scale})`, cursor: scale > 1 ? 'zoom-out' : 'zoom-in' }}
        onClick={(e) => {
          e.stopPropagation()
          setScale((prev) => (prev > 1 ? 1 : 2))
        }}
        onWheel={handleWheel}
        draggable={false}
      />
    </div>
  )
}
