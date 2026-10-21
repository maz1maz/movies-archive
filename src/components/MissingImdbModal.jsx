import { useEffect, useMemo, useState } from 'react'
import { IconClose } from './icons.jsx'
import { useOverlayClose } from '../hooks/useOverlayClose.js'

// فیلم‌هایی که هنوز شناسه‌ی IMDb ندارن — با کلیک، فرم ویرایش باز می‌شه تا
// لینک IMDb رو دستی بدی. لیست از روی آرشیوِ تازه حساب می‌شه، پس هر فیلمی که
// درست بشه خودش از لیست می‌ره.
export default function MissingImdbModal({ films, onClose, onEdit }) {
  const overlayHandlers = useOverlayClose(onClose)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const missing = useMemo(
    () =>
      (films || [])
        .filter((f) => !f.imdbId)
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))),
    [films]
  )
  const q = query.trim().toLowerCase()
  const shown = q ? missing.filter((f) => String(f.title || '').toLowerCase().includes(q)) : missing

  return (
    <div className="modal-overlay" {...overlayHandlers}>
      <div className="modal import-review-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose width={15} height={15} />
        </button>
        <h2 className="edit-title">Films without IMDb ID</h2>
        <p className="import-review-intro">
          {missing.length
            ? `${missing.length} films couldn't be matched automatically. Open one and paste its IMDb link to fix it.`
            : 'Every film in your archive has an IMDb ID.'}
        </p>
        {missing.length > 10 && (
          <input
            className="missing-imdb-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title…"
          />
        )}
        <ul className="missing-imdb-list">
          {shown.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onEdit(f)}>
                {f.poster ? <img src={f.poster} alt="" /> : <span className="title-suggest-noposter" />}
                <span className="title-suggest-text">
                  <span className="title-suggest-name">{f.title}</span>
                  <span className="title-suggest-meta">
                    {[f.year || 'no year', f.director || 'no director', f.mediaType === 'digital' ? 'Digital' : 'Blu-ray'].join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
