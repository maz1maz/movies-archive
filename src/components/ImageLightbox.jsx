import { useEffect } from 'react'
import { IconClose } from './icons.jsx'

// نمایش یه عکس (پوستر فیلم یا عکس بازیگر) به‌صورت بزرگ و وسط صفحه.
// کلیک روی پس‌زمینه یا زدن Escape می‌بندتش.
export default function ImageLightbox({ src, alt, onClose, grayscale = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!src) return null

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <IconClose width={16} height={16} />
      </button>
      <img
        src={src}
        alt={alt || ''}
        className={grayscale ? 'lightbox-img lightbox-img-gray' : 'lightbox-img'}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
