import { useMemo, useState } from 'react'
import EditModal from './EditModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// هر چک یه فیلتره روی آرایه‌ی films؛ اگه true برگردونه یعنی اون رکورد مشکل داره
const CHECKS = [
  { key: 'poster', label: 'بدون پوستر', test: (f) => !f.poster },
  { key: 'synopsis', label: 'بدون خلاصه', test: (f) => !f.synopsis || !f.synopsis.trim() },
  { key: 'director', label: 'بدون کارگردان', test: (f) => !f.director || !f.director.trim() },
  { key: 'genre', label: 'بدون ژانر', test: (f) => !f.genre || !f.genre.trim() },
  { key: 'year', label: 'بدون سال ساخت', test: (f) => !f.year },
  { key: 'cast', label: 'بدون بازیگر', test: (f) => !f.cast || !f.cast.trim() },
  { key: 'rating', label: 'بدون امتیاز (IMDb/TMDB)', test: (f) => !f.rating },
  {
    key: 'location',
    label: 'فیزیکی بدون لوکیشن (Closet/Row/Section)',
    test: (f) => f.mediaType === 'physical' && (!f.closet || !f.row || !f.shelf),
  },
  {
    key: 'drive',
    label: 'دیجیتال بدون درایو',
    test: (f) => f.mediaType === 'digital' && (!f.driveNumber || !f.driveNumber.trim()),
  },
  {
    key: 'seasons',
    label: 'سریال بدون تعداد فصل',
    test: (f) => f.itemType === 'series' && !f.totalSeasonsProduced,
  },
]

export default function DashboardHealthPanel({ films = [], onOpenFilm, onFilmsChanged }) {
  const { isGuest, openLogin } = useAuth()
  const [openKey, setOpenKey] = useState(null)
  const [editingFilm, setEditingFilm] = useState(null)

  const results = useMemo(() => {
    return CHECKS.map((c) => ({
      ...c,
      items: films.filter((f) => {
        try {
          return c.test(f)
        } catch {
          return false
        }
      }),
    }))
  }, [films])

  const totalIssues = results.reduce((sum, r) => sum + r.items.length, 0)

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          اسکن سریع کل آرشیو ({films.length.toLocaleString('en-US')} عنوان) برای رکوردهایی که فیلد مهمی رو کم دارن.
          فقط خواندنیه — چیزی رو خودکار تغییر نمی‌ده.
        </p>
      </div>

      <section>
        {totalIssues === 0 ? (
          <div className="empty">همه چیز کامله — هیچ نقصی پیدا نشد. 🎬</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {results
              .filter((r) => r.items.length > 0)
              .sort((a, b) => b.items.length - a.items.length)
              .map((r) => (
                <div key={r.key} className="card oscars-category-block" style={{ padding: 16 }}>
                  <h3
                    className="oscars-category-title"
                    style={{ borderBottom: 'none', marginBottom: 4, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => setOpenKey(openKey === r.key ? null : r.key)}
                  >
                    <span>{r.label}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>
                      {r.items.length.toLocaleString('en-US')} مورد {openKey === r.key ? '▲' : '▼'}
                    </span>
                  </h3>
                  {openKey === r.key && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, maxHeight: 420, overflowY: 'auto' }}>
                      {r.items.map((f) => (
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
                            {f.title} {f.year ? `(${f.year})` : ''} · {f.itemType === 'series' ? 'سریال' : 'فیلم'} ·{' '}
                            {f.mediaType === 'digital' ? 'دیجیتال' : 'فیزیکی'}
                          </div>
                          <button className="btn btn-sm" onClick={() => onOpenFilm(f)}>
                            نمایش
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => (isGuest ? openLogin() : setEditingFilm(f))}
                          >
                            ویرایش
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>

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
            if (onFilmsChanged) onFilmsChanged()
          }}
          onDelete={async () => {
            if (!window.confirm(`Delete this entry (${editingFilm.title})? This cannot be undone.`)) return
            await fetch(`/api/films/${editingFilm.id}`, { method: 'DELETE' })
            setEditingFilm(null)
            if (onFilmsChanged) onFilmsChanged()
          }}
        />
      )}
    </div>
  )
}
