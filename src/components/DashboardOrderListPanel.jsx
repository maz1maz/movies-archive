import { useEffect, useState } from 'react'
import { IconSave, IconPrinter } from './icons.jsx'

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

// تب «Order List» — همه‌ی عناوینی که از دکمه‌ی Order (تو Watchlists یا
// Coming Soon اخبار سینما) اضافه شدن، این‌جا جمع می‌شن و می‌شه چاپشون کرد.
export default function DashboardOrderListPanel() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    fetch('/api/order-list')
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const res = await fetch(`/api/order-list/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setError('Could not remove that item — try again.')
      load()
    }
  }

  if (items === null) {
    return <p className="person-extras-loading" style={{ marginTop: 18 }}>Loading order list…</p>
  }

  return (
    <div className="order-list-tab">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 12 }}>
        <p className="dashboard-eyebrow" style={{ margin: 0 }}>
          {items.length} title{items.length === 1 ? '' : 's'}
        </p>
        <button type="button" className="btn" onClick={() => window.print()} disabled={!items.length}>
          <IconPrinter width={14} height={14} /> Print
        </button>
      </div>

      {error && <p className="edit-lookup-error">{error}</p>}

      {items.length === 0 ? (
        <div className="stats-box">
          <span className="stats-box-sub">
            Nothing here yet — click "Order" on any missing title in Watchlists or Cinema News → Coming Soon to add it.
          </span>
        </div>
      ) : (
        <div className="stats-box order-list-print-area">
          <h3>
            <IconSave width={16} height={16} /> Order List
          </h3>
          <table className="order-list-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Release date</th>
                <th>Added from</th>
                <th>Added</th>
                <th className="order-list-no-print"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.title}</td>
                  <td>{formatDate(it.releaseDate)}</td>
                  <td>{it.source || '—'}</td>
                  <td>{formatDate(it.addedAt)}</td>
                  <td className="order-list-no-print">
                    <button type="button" className="btn-danger-text" onClick={() => remove(it.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
