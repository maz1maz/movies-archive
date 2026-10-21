import { useEffect, useState } from 'react'
import { IconClose } from './icons.jsx'
import { useOverlayClose } from '../hooks/useOverlayClose.js'

function matchLocation(m) {
  if (m.mediaType === 'digital') return m.driveNumber ? `Drive ${m.driveNumber}` : 'Digital'
  return [m.closet, m.shelf, m.row].filter(Boolean).join(' · ') || 'Blu-ray'
}

const formatLabel = (mediaType) => (mediaType === 'digital' ? 'Digital' : 'Blu-ray')

// پیش‌نمایش ایمپورت اکسل: هر ردیفی که هم‌عنوانش تو آرشیو هست، کنار پوستر
// مشابه‌ها نشون داده می‌شه و کاربر انتخاب می‌کنه ادغام بشه، جدید اضافه بشه یا رد بشه.
// decisions: { [rowIndex]: {action:'merge', targetId} | {action:'new'} | {action:'skip'} }
export default function ImportReviewModal({ flagged, total, newCount, onCancel, onConfirm }) {
  const overlayHandlers = useOverlayClose(onCancel)
  const defaults = () =>
    Object.fromEntries(
      flagged.map((r) => [
        r.index,
        r.defaultAction === 'merge' ? { action: 'merge', targetId: r.defaultTargetId } : { action: 'new' },
      ])
    )
  const [decisions, setDecisions] = useState(defaults)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onCancel])

  const decide = (index, decision) => setDecisions((prev) => ({ ...prev, [index]: decision }))
  const setAll = (action) => setDecisions(Object.fromEntries(flagged.map((r) => [r.index, { action }])))

  return (
    <div className="modal-overlay" {...overlayHandlers}>
      <div className="modal import-review-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onCancel} aria-label="Close">
          <IconClose width={15} height={15} />
        </button>
        <h2 className="edit-title">Review possible duplicates</h2>
        <p className="import-review-intro">
          {flagged.length} of {total} rows share a title with films already in your archive. Compare posters and
          pick what to do with each — other rows import as usual.
        </p>
        <div className="import-review-summary">
          <span><strong>{total}</strong> rows in file</span>
          <span><strong>{newCount ?? total - flagged.length}</strong> new — import directly</span>
          <span><strong>{flagged.length}</strong> to review</span>
        </div>
        <div className="import-review-bulk">
          <button type="button" className="btn btn-ghost" onClick={() => setDecisions(defaults())}>Use suggestions</button>
          <button type="button" className="btn btn-ghost" onClick={() => setAll('new')}>All as new</button>
          <button type="button" className="btn btn-ghost" onClick={() => setAll('skip')}>Skip all</button>
        </div>

        <div className="import-review-list">
          {flagged.map((r) => {
            const d = decisions[r.index] || { action: 'new' }
            return (
              <div key={r.index} className="import-review-row">
                <div className="duplicate-compare">
                  <div className="duplicate-card duplicate-card-new">
                    <div className="duplicate-noposter import-review-excel">Excel row {r.index + 2}</div>
                    <div className="duplicate-card-label">{formatLabel(r.mediaType)}</div>
                    <div className="duplicate-card-title">{r.title}</div>
                    <div className="duplicate-card-meta">{r.year || '—'}</div>
                    {r.director && <div className="duplicate-card-meta">{r.director}</div>}
                  </div>
                  {r.matches.map((m) => {
                    const selected = d.action === 'merge' && d.targetId === m.id
                    return (
                      <button
                        type="button"
                        key={m.id}
                        className={`duplicate-card import-review-match${selected ? ' selected' : ''}`}
                        onClick={() => decide(r.index, { action: 'merge', targetId: m.id })}
                        title="Merge this row into this archive film (only empty fields are filled)"
                      >
                        {m.poster ? <img src={m.poster} alt="" /> : <div className="duplicate-noposter" />}
                        <div className="duplicate-card-label">
                          {selected ? '✓ Merge into' : 'In archive'} · {formatLabel(m.mediaType)}
                        </div>
                        <div className="duplicate-card-title">{m.title}</div>
                        <div className="duplicate-card-meta">{[m.year, matchLocation(m)].filter(Boolean).join(' · ')}</div>
                        {m.director && <div className="duplicate-card-meta">{m.director}</div>}
                      </button>
                    )
                  })}
                </div>
                <div className="import-review-actions">
                  <label>
                    <input type="radio" checked={d.action === 'new'} onChange={() => decide(r.index, { action: 'new' })} /> Add as new
                  </label>
                  <label>
                    <input type="radio" checked={d.action === 'skip'} onChange={() => decide(r.index, { action: 'skip' })} /> Skip
                  </label>
                  {d.action === 'merge' && <span className="import-review-hint">Merging — click “Add as new” if it's a different film</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="edit-actions">
          <div className="edit-primary-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel import</button>
            <button type="button" className="btn btn-primary" onClick={() => onConfirm(decisions)}>Import</button>
          </div>
        </div>
      </div>
    </div>
  )
}
