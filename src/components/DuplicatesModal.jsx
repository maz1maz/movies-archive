import { useEffect, useState } from 'react'
import { IconClose, IconLayers } from './icons.jsx'

export default function DuplicatesModal({ onClose, onOpenFilm }) {
  const [groups, setGroups] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    setGroups(null)
    fetch('/api/duplicates')
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
  }

  useEffect(() => {
    load()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this entry? This cannot be undone.')) return
    setBusyId(id)
    try {
      await fetch(`/api/films/${id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-stats" onClick={(e) => e.stopPropagation()}>
        <div className="stats-header">
          <h2>
            <IconLayers width={18} height={18} /> Possible Duplicates
          </h2>
          <button className="icon-btn" onClick={onClose}>
            <IconClose width={18} height={18} />
          </button>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '-8px 0 4px' }}>
          Same title, year, and media type appearing more than once — usually an accidental double entry, not
          intentional multi-copy tracking (that uses the Copies counter on a single entry instead).
        </p>

        {groups === null ? (
          <div className="empty">Scanning your archive…</div>
        ) : groups.length === 0 ? (
          <div className="empty">No duplicates found — your archive looks clean. 🎬</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {groups.map((group, gi) => (
              <div key={gi} className="stats-box">
                <h3>
                  {group[0].title} {group[0].year ? `(${group[0].year})` : ''} — {group.length} entries
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {group.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ width: 32, height: 46, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'var(--surface-2)' }}>
                        {f.poster && <img src={f.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ flex: 1, fontSize: 12.5, color: 'var(--muted)' }}>
                        {f.mediaType === 'digital'
                          ? f.driveNumber || 'No drive set'
                          : `Shelf ${f.shelf || '—'} / Row ${f.row || '—'}`}{' '}
                        · {f.format || '—'} · {f.copies > 1 ? `${f.copies} copies` : '1 copy'}
                      </div>
                      <button className="btn btn-sm" onClick={() => onOpenFilm(f)}>
                        View
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleDelete(f.id)}
                        disabled={busyId === f.id}
                        style={{ color: 'var(--marquee-ruby, #9c2b3c)' }}
                      >
                        {busyId === f.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
