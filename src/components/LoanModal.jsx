import { useEffect, useState } from 'react'
import { IconClose } from './icons.jsx'

export default function LoanModal({ film, onClose, onSaveLoan }) {
  const [borrowedTo, setBorrowedTo] = useState(film.borrowedTo || '')
  const [borrowedDate, setBorrowedDate] = useState(
    film.borrowedDate || new Date().toISOString().split('T')[0]
  )

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleSave = () => {
    onSaveLoan(film.id, {
      borrowedTo: borrowedTo.trim() || null,
      borrowedDate: borrowedTo.trim() ? borrowedDate : null,
    })
  }

  const handleReturn = () => {
    onSaveLoan(film.id, {
      borrowedTo: null,
      borrowedDate: null,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-loan" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close cine-close" onClick={onClose} aria-label="Close">
          <IconClose width={14} height={14} />
        </button>

        <div className="loan-header">
          <h2>🤝 Loan Tracker: {film.title}</h2>
          <p className="loan-sub">Track physical copy loans to friends & family</p>
        </div>

        {film.borrowedTo ? (
          <div className="loan-status-box active-loan">
            <div className="loan-status-badge">CURRENTLY LOANED OUT</div>
            <div className="loan-details">
              Borrowed by <strong>{film.borrowedTo}</strong> on{' '}
              <strong>{film.borrowedDate || 'recently'}</strong>
            </div>
            <button className="btn btn-primary btn-return" onClick={handleReturn}>
              ✅ Mark Film as Returned to Archive
            </button>
          </div>
        ) : (
          <div className="loan-status-box available-loan">
            <div className="loan-status-badge">AVAILABLE IN ARCHIVE</div>
            <p>Physical Location: Shelf <strong>{film.shelf || '—'}</strong> / Row <strong>{film.row || '—'}</strong></p>
          </div>
        )}

        <div className="loan-form">
          <label className="edit-field full">
            <span>Borrower's Name</span>
            <input
              value={borrowedTo}
              onChange={(e) => setBorrowedTo(e.target.value)}
              placeholder="e.g. Ali Rezaei"
            />
          </label>

          <label className="edit-field full">
            <span>Loan Date</span>
            <input
              type="date"
              value={borrowedDate}
              onChange={(e) => setBorrowedDate(e.target.value)}
            />
          </label>

          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              💾 Save Loan Info
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
