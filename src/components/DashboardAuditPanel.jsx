import { useEffect, useState } from 'react'

const ACTION_LABEL = {
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
}

const ACTION_COLOR = {
  create: 'var(--success, #3c9d5f)',
  update: 'var(--accent)',
  delete: 'var(--marquee-ruby, #9c2b3c)',
}

function formatValue(v) {
  if (v === null || v === undefined || v === '') return '—'
  const s = String(v)
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

export default function DashboardAuditPanel({ onOpenFilm, films = [] }) {
  const [rows, setRows] = useState(null)
  const [filterAction, setFilterAction] = useState('all')

  useEffect(() => {
    fetch('/api/audit-log?limit=300')
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
  }, [])

  const filtered = rows ? rows.filter((r) => filterAction === 'all' || r.action === filterAction) : null

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          تاریخچه‌ی تغییرات — کی، کِی، چه رکوردی رو تغییر داد و مقدار قبل/بعدش چی بود. آخرین ۳۰۰ رویداد.
        </p>
        <div className="row row-wrap oscars-filters">
          <div className="oscars-field">
            <label>نوع رویداد</label>
            <select className="input" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option value="all">همه</option>
              <option value="create">ایجاد</option>
              <option value="update">ویرایش</option>
              <option value="delete">حذف</option>
            </select>
          </div>
        </div>
      </div>

      <section>
        {filtered === null ? (
          <div className="empty">در حال بارگذاری…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">هنوز رویدادی ثبت نشده.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {filtered.map((r) => {
              const film = films.find((f) => f.id === r.filmId)
              return (
                <div key={r.id} className="card" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: ACTION_COLOR[r.action] || 'var(--muted)',
                        border: `1px solid ${ACTION_COLOR[r.action] || 'var(--border)'}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                      }}
                    >
                      {ACTION_LABEL[r.action] || r.action}
                    </span>
                    <strong
                      style={{ cursor: film ? 'pointer' : 'default' }}
                      onClick={() => film && onOpenFilm && onOpenFilm(film)}
                    >
                      {r.filmTitle || 'بدون عنوان'}
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>توسط {r.changedBy || 'guest'}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginInlineStart: 'auto' }}>{r.changedAt}</span>
                  </div>
                  {r.action === 'update' && r.changes && Object.keys(r.changes).length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(r.changes).map(([field, [before, after]]) => (
                        <div key={field} style={{ fontSize: 12.5 }}>
                          <span style={{ color: 'var(--muted)' }}>{field}:</span>{' '}
                          <span style={{ opacity: 0.7 }}>{formatValue(before)}</span>{' '}→{' '}
                          <span>{formatValue(after)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
