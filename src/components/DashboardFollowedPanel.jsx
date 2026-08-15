import { useEffect, useState } from 'react'
import { IconUser, IconClose } from './icons.jsx'
import { proxyImg } from '../utils/proxyImg.js'

export default function DashboardFollowedPanel({ onOpenPerson }) {
  const [people, setPeople] = useState(null)

  const load = () => {
    fetch('/api/followed')
      .then((r) => r.json())
      .then((data) => setPeople(Array.isArray(data) ? data : []))
      .catch(() => setPeople([]))
  }

  useEffect(load, [])

  const unfollow = async (name) => {
    setPeople((prev) => prev.filter((p) => p.name !== name))
    try {
      await fetch(`/api/followed/${encodeURIComponent(name)}`, { method: 'DELETE' })
    } catch {
      load()
    }
  }

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          هنرمندهایی که دنبال کردی — رو صفحه‌ی هرکدوم دکمه‌ی Follow رو بزن تا اینجا اضافه بشه.
        </p>
      </div>

      {people === null ? (
        <div className="empty">در حال بارگذاری…</div>
      ) : people.length === 0 ? (
        <div className="empty">هنوز کسی رو دنبال نکردی.</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 14,
            marginTop: 16,
          }}
        >
          {people.map((p) => (
            <div
              key={p.name}
              className="card"
              style={{ padding: 12, textAlign: 'center', cursor: 'pointer', position: 'relative' }}
              onClick={() => onOpenPerson && onOpenPerson(p.name)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  unfollow(p.name)
                }}
                title="Unfollow"
                style={{
                  position: 'absolute',
                  top: 6,
                  insetInlineEnd: 6,
                  background: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <IconClose width={11} height={11} />
              </button>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '0 auto 8px',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p.photo ? (
                  <img src={proxyImg(p.photo)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <IconUser width={28} height={28} />
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, textTransform: 'capitalize' }}>
                {p.type || ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
