import { useEffect, useState } from 'react'

const SCOPES = [
  { key: 'all', label: 'Everything' },
  { key: 'physical', label: 'Blu-ray (Physical)' },
  { key: 'digital', label: 'Digital' },
  { key: 'series', label: 'Series only' },
  { key: 'movies', label: 'Movies only' },
]

export default function DashboardDuplicatesPanel({ onOpenFilm, onFilmsChanged }) {
  const [scope, setScope] = useState('all')
  const [groups, setGroups] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = (s) => {
    setGroups(null)
    fetch(`/api/duplicates?scope=${s}`)
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
  }

  useEffect(() => {
    load(scope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this entry? This cannot be undone.')) return
    setBusyId(id)
    try {
      await fetch(`/api/films/${id}`, { method: 'DELETE' })
      load(scope)
      if (onFilmsChanged) onFilmsChanged()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          Same title, year, and media type appearing more than once — usually an accidental double entry, not
          intentional multi-copy tracking (that uses the Copies counter on a single entry instead).
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field">
            <label>Check where?</label>
            <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
              {SCOPES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section>
        {groups === null ? (
          <div className="empty">Scanning your archive…</div>
        ) : groups.length === 0 ? (
          <div className="empty">No duplicates found here — looks clean. 🎬</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
            {groups.map((group, gi) => (
              <div key={gi} className="card oscars-category-block" style={{ padding: 16 }}>
                <h3 className="oscars-category-title" style={{ borderBottom: 'none', marginBottom: 4 }}>
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
                        · {f.itemType === 'series' ? 'Series' : 'Movie'} · {f.format || '—'} ·{' '}
                        {f.copies > 1 ? `${f.copies} copies` : '1 copy'}
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
      </section>
    </div>
  )
}
