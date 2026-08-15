import { useEffect, useMemo, useState } from 'react'
import EditModal from './EditModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// چک‌های عمومی که هم رو فیزیکی هم دیجیتال اجرا می‌شن
const GENERIC_CHECKS = [
  { key: 'poster', label: 'بدون پوستر', test: (f) => !f.poster },
  { key: 'synopsis', label: 'بدون خلاصه', test: (f) => !f.synopsis || !f.synopsis.trim() },
  { key: 'director', label: 'بدون کارگردان', test: (f) => !f.director || !f.director.trim() },
  { key: 'genre', label: 'بدون ژانر', test: (f) => !f.genre || !f.genre.trim() },
  { key: 'year', label: 'بدون سال ساخت', test: (f) => !f.year },
  { key: 'cast', label: 'بدون بازیگر', test: (f) => !f.cast || !f.cast.trim() },
  { key: 'rating', label: 'بدون امتیاز (IMDb/TMDB)', test: (f) => !f.rating },
  { key: 'seasons', label: 'سریال بدون تعداد فصل', test: (f) => f.itemType === 'series' && !f.totalSeasonsProduced },
]
// چک‌های مخصوص فیزیکی
const PHYSICAL_CHECKS = [
  { key: 'location', label: 'بدون لوکیشن (Closet/Row/Section)', test: (f) => !f.closet || !f.row || !f.shelf },
]
// چک‌های مخصوص دیجیتال
const DIGITAL_CHECKS = [
  { key: 'drive', label: 'بدون درایو', test: (f) => !f.driveNumber || !f.driveNumber.trim() },
]

function runChecks(checks, items) {
  return checks.map((c) => ({
    ...c,
    items: items.filter((f) => {
      try {
        return c.test(f)
      } catch {
        return false
      }
    }),
  }))
}


function HealthResultsList({ results, totalIssues, openKey, setOpenKey, onOpenFilm, isGuest, openLogin, setEditingFilm, keyPrefix }) {
  if (totalIssues === 0) {
    return <div className="empty">همه چیز کامله — هیچ نقصی پیدا نشد. 🎬</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      {results
        .filter((r) => r.items.length > 0)
        .sort((a, b) => b.items.length - a.items.length)
        .map((r) => {
          const uniqueKey = `${keyPrefix}:${r.key}`
          return (
            <div key={uniqueKey} className="card oscars-category-block" style={{ padding: 16 }}>
              <h3
                className="oscars-category-title"
                style={{ borderBottom: 'none', marginBottom: 4, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => setOpenKey(openKey === uniqueKey ? null : uniqueKey)}
              >
                <span>{r.label}</span>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>
                  {r.items.length.toLocaleString('en-US')} مورد {openKey === uniqueKey ? '▲' : '▼'}
                </span>
              </h3>
              {openKey === uniqueKey && (
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
                        {f.title} {f.year ? `(${f.year})` : ''} · {f.itemType === 'series' ? 'سریال' : 'فیلم'}
                      </div>
                      <button className="btn btn-sm" onClick={() => onOpenFilm(f)}>
                        نمایش
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => (isGuest ? openLogin() : setEditingFilm(f))}>
                        ویرایش
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

export default function DashboardHealthPanel({ films = [], onOpenFilm, onFilmsChanged }) {  const { isGuest, openLogin } = useAuth()
  const [openKey, setOpenKey] = useState(null)
  const [editingFilm, setEditingFilm] = useState(null)
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    fetch('/api/debug/checks')
      .then((r) => r.json())
      .then((data) => setUsage(data.usage || null))
      .catch(() => setUsage(null))
  }, [])

  const results = useMemo(() => {
    const physicalFilms = films.filter((f) => f.mediaType !== 'digital')
    const digitalFilms = films.filter((f) => f.mediaType === 'digital')
    return {
      physical: [...runChecks(GENERIC_CHECKS, physicalFilms), ...runChecks(PHYSICAL_CHECKS, physicalFilms)],
      digital: [...runChecks(GENERIC_CHECKS, digitalFilms), ...runChecks(DIGITAL_CHECKS, digitalFilms)],
    }
  }, [films])

  const totalIssuesPhysical = results.physical.reduce((sum, r) => sum + r.items.length, 0)
  const totalIssuesDigital = results.digital.reduce((sum, r) => sum + r.items.length, 0)

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          اسکن سریع کل آرشیو ({films.length.toLocaleString('en-US')} عنوان) برای رکوردهایی که فیلد مهمی رو کم دارن.
          فقط خواندنیه — چیزی رو خودکار تغییر نمی‌ده.
        </p>
      </div>

      {usage?.omdb && (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
            <span>مصرف امروز OMDb</span>
            <span style={{ color: usage.omdb.warning ? 'var(--marquee-ruby, #9c2b3c)' : 'var(--muted)' }}>
              {usage.omdb.count.toLocaleString('en-US')} / {usage.omdb.limit.toLocaleString('en-US')}
              {usage.omdb.warning ? ' — نزدیک به سقف!' : ''}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--surface-2)', marginTop: 8, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (usage.omdb.count / usage.omdb.limit) * 100)}%`,
                background: usage.omdb.warning ? 'var(--marquee-ruby, #9c2b3c)' : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}

      <section>
        <h3 style={{ marginTop: 8, marginBottom: 4 }}>📀 فیزیکی</h3>
        <HealthResultsList
          results={results.physical}
          totalIssues={totalIssuesPhysical}
          openKey={openKey}
          setOpenKey={setOpenKey}
          onOpenFilm={onOpenFilm}
          isGuest={isGuest}
          openLogin={openLogin}
          setEditingFilm={setEditingFilm}
          keyPrefix="phys"
        />
      </section>

      <section style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 8, marginBottom: 4 }}>💻 دیجیتال</h3>
        <HealthResultsList
          results={results.digital}
          totalIssues={totalIssuesDigital}
          openKey={openKey}
          setOpenKey={setOpenKey}
          onOpenFilm={onOpenFilm}
          isGuest={isGuest}
          openLogin={openLogin}
          setEditingFilm={setEditingFilm}
          keyPrefix="dig"
        />
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
