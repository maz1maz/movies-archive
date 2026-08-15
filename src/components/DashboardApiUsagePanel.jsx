import { useEffect, useMemo, useState } from 'react'

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DashboardApiUsagePanel() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/usage-stats')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ rows: [], omdbDailyLimit: 1000 }))
  }, [])

  const { days, maxCount, todayOmdb } = useMemo(() => {
    if (!data) return { days: [], maxCount: 1, todayOmdb: 0 }
    const byDate = {}
    for (const r of data.rows) {
      byDate[r.date] = byDate[r.date] || {}
      byDate[r.date][r.service] = r.count
    }
    const dates = Object.keys(byDate).sort()
    const days = dates.map((date) => ({ date, omdb: byDate[date].omdb || 0 }))
    const maxCount = Math.max(1, ...days.map((d) => d.omdb))
    const today = new Date().toISOString().slice(0, 10)
    return { days, maxCount, todayOmdb: byDate[today]?.omdb || 0 }
  }, [data])

  return (
    <div className="oscars-panel">
      <div className="card oscars-controls">
        <p className="oscars-intro">
          مصرف روزانه‌ی OMDb تو ۳۰ روز اخیر (سقف روزانه: {(data?.omdbDailyLimit ?? 1000).toLocaleString('en-US')} درخواست).
          TMDB و Wikidata سقف روزانه‌ی محدودکننده ندارن، برای همین اینجا ردیابی نمی‌شن.
        </p>
      </div>

      <div className="stats-box">
        <h3>مصرف OMDb امروز</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
          {todayOmdb.toLocaleString('en-US')} / {(data?.omdbDailyLimit ?? 1000).toLocaleString('en-US')}
        </p>
      </div>

      {data === null ? (
        <div className="empty">در حال بارگذاری…</div>
      ) : days.length === 0 ? (
        <div className="empty">هنوز هیچ مصرفی ثبت نشده.</div>
      ) : (
        <div className="stats-box" style={{ marginTop: 12 }}>
          <h3>روند ۳۰ روز اخیر</h3>
          <div className="stats-timeline" style={{ overflowX: 'auto' }}>
            {days.map((d) => (
              <div key={d.date} className="timeline-col" title={`${d.date}: ${d.omdb} درخواست`}>
                <span className="timeline-count">{d.omdb}</span>
                <div
                  className="timeline-bar"
                  style={{ height: `${Math.max(6, Math.round((d.omdb / maxCount) * 100))}%` }}
                />
                <span className="timeline-label">{formatShortDate(d.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
