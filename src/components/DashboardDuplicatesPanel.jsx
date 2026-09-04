import { useEffect, useState } from 'react'
import { IconClose } from './icons.jsx'
import FilmModal from './FilmModal.jsx'
import EditModal from './EditModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const SCOPES = [
  { key: 'all', label: 'Everything' },
  { key: 'both', label: 'Physical + Digital' },
  { key: 'physical', label: 'Blu-ray (Physical)' },
  { key: 'digital', label: 'Digital' },
  { key: 'series', label: 'Series only' },
  { key: 'movies', label: 'Movies only' },
]

export default function DashboardDuplicatesPanel({ films = [], onOpenFilm, onFilmsChanged }) {
  const { isGuest, openLogin } = useAuth()
  const [scope, setScope] = useState('all')
  const [groups, setGroups] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [compareGroup, setCompareGroup] = useState(null)
  const [editingFilm, setEditingFilm] = useState(null)

  // این اسکن کل جدول رو می‌خونه، برای همین دیگه خودکار (با باز شدن تب) اجرا
  // نمی‌شه — فقط با کلیک صریح و وارد کردن دوباره‌ی رمز.
  const load = (s) => {
    const password = window.prompt('برای اجرای اسکن دوباره‌ی موارد تکراری، رمز عبورت رو وارد کن:')
    if (!password) return
    setGroups(null)
    fetch(`/api/duplicates?scope=${s}`, { headers: { 'X-Confirm-Password': password } })
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(new Error(e.error || 'Failed')))
        return r.json()
      })
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch((e) => {
        alert(e.message === 'Incorrect password' ? 'رمز اشتباهه.' : 'خطا در اسکن.')
        setGroups([])
      })
  }

  // این اسکن کل جدول رو می‌خونه، پس دیگه با باز شدن تب یا عوض شدن scope
  // خودکار اجرا نمی‌شه — فقط با کلیک صریح روی دکمه‌ی «اسکن» و وارد کردن رمز.

  const handleDelete = async (id) => {
    if (isGuest) return openLogin()
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
          {scope === 'both'
            ? 'Titles you own on both Blu-ray and digital — not duplicates to clean up, just a combined view.'
            : 'Same title, year, and media type appearing more than once — usually an accidental double entry, not intentional multi-copy tracking (that uses the Copies counter on a single entry instead).'}
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
          <button className="btn btn-primary" onClick={() => load(scope)} style={{ alignSelf: 'flex-end' }}>
            Scan for duplicates
          </button>
        </div>
      </div>

      <section>
        {groups === null ? (
          <div className="empty">Click "Scan for duplicates" to check — this reads the whole archive, so it asks for your password each time.</div>
        ) : groups.length === 0 ? (
          <div className="empty">No duplicates found here — looks clean. 🎬</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
            {groups.map((group, gi) => (
              <div key={gi} className="card oscars-category-block" style={{ padding: 16 }}>
                <h3
                  className="oscars-category-title"
                  style={{ borderBottom: 'none', marginBottom: 4, cursor: 'pointer' }}
                  onClick={() => setCompareGroup(group)}
                  title="Click to compare these entries side by side"
                >
                  {group[0].title} {group[0].year ? `(${group[0].year})` : ''} — {group.length} entries
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginInlineStart: 10 }}>
                    Compare →
                  </span>
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
                          : `Closet ${f.closet || '—'} / Row ${f.row || '—'} / Section ${f.shelf || '—'}`}{' '}
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

      {compareGroup && (
        <div className="modal-overlay" onClick={() => setCompareGroup(null)}>
          <div
            className="modal modal-compare"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1400px, 96vw)', maxHeight: '92vh', overflowY: 'auto', padding: 20 }}
          >
            <div className="stats-header">
              <h2>
                Comparing {compareGroup.length} entries — {compareGroup[0].title}
              </h2>
              <button className="icon-btn" onClick={() => setCompareGroup(null)}>
                <IconClose width={18} height={18} />
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(compareGroup.length, 2)}, 1fr)`,
                gap: 16,
              }}
            >
              {compareGroup.map((entry) => {
                const full = films.find((f) => f.id === entry.id) || entry
                return (
                  <div key={entry.id} className="card" style={{ padding: 12, overflow: 'hidden' }}>
                    <FilmModal
                      film={full}
                      films={films}
                      panel
                      hasBluray={false}
                      hasDigital={false}
                      onClose={() => {}}
                      onEdit={(f) => {
                        if (isGuest) return openLogin()
                        setEditingFilm(f)
                      }}
                      onNavigate={() => {}}
                      onSaveSeasonDrive={async (f, seasonDrives) => {
                        await fetch(`/api/films/${f.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ seasonDrives }),
                        })
                        if (onFilmsChanged) onFilmsChanged()
                      }}
                    />
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ marginTop: 10, width: '100%', color: 'var(--marquee-ruby, #9c2b3c)' }}
                      onClick={async () => {
                        if (!window.confirm(`Delete this entry (${full.title})? This cannot be undone.`)) return
                        setBusyId(entry.id)
                        await fetch(`/api/films/${entry.id}`, { method: 'DELETE' })
                        setBusyId(null)
                        setCompareGroup(null)
                        load(scope)
                        if (onFilmsChanged) onFilmsChanged()
                      }}
                      disabled={busyId === entry.id}
                    >
                      {busyId === entry.id ? 'Deleting…' : 'Delete this one'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {editingFilm && (
        <EditModal
          film={editingFilm}
          onClose={() => setEditingFilm(null)}
          onSave={async (patch) => {
            await fetch(`/api/films/${editingFilm.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch),
            })
            setEditingFilm(null)
            load(scope)
            if (onFilmsChanged) onFilmsChanged()
          }}
          onDelete={async () => {
            if (!window.confirm(`Delete this entry (${editingFilm.title})? This cannot be undone.`)) return
            await fetch(`/api/films/${editingFilm.id}`, { method: 'DELETE' })
            setEditingFilm(null)
            setCompareGroup(null)
            load(scope)
            if (onFilmsChanged) onFilmsChanged()
          }}
        />
      )}
    </div>
  )
}
