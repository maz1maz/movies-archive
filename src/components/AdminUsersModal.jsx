import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function AdminUsersModal({ open, onClose }) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setError('')
    try {
      const res = await fetch('/api/auth/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در دریافت لیست کاربران')
      setUsers(data)
    } catch (e) {
      setError(e.message)
      setUsers([])
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  if (!open) return null

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'افزودن کاربر ناموفق بود')
      setNewUsername('')
      setNewPassword('')
      setNewRole('user')
      load()
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`کاربر «${u.username}» حذف بشه؟`)) return
    setBusy(true)
    try {
      await fetch(`/api/auth/users/${u.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusy(false)
    }
  }

  const handleRoleToggle = async (u) => {
    const nextRole = u.role === 'admin' ? 'user' : 'admin'
    setBusy(true)
    try {
      await fetch(`/api/auth/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      })
      load()
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async (u) => {
    const pw = window.prompt(`رمز عبور جدید برای «${u.username}» (حداقل ۶ کاراکتر):`)
    if (!pw) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/auth/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'تغییر رمز ناموفق بود')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-modal" style={{ width: 'min(520px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="بستن">
          ✕
        </button>
        <h2 className="edit-title">مدیریت کاربران</h2>

        {error && <p style={{ color: '#e2555b', fontSize: 13 }}>{error}</p>}

        {users === null ? (
          <p style={{ color: 'var(--muted)' }}>در حال بارگذاری…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 10px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10,
                }}
              >
                <div>
                  <strong>{u.username}</strong>{' '}
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {u.role === 'admin' ? 'ادمین' : 'کاربر'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => handleResetPassword(u)}>
                    تغییر رمز
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => handleRoleToggle(u)}>
                    {u.role === 'admin' ? 'تنزل به کاربر' : 'ارتقا به ادمین'}
                  </button>
                  {u.id !== currentUser?.id && (
                    <button type="button" className="btn btn-danger-text" disabled={busy} onClick={() => handleDelete(u)}>
                      حذف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ fontSize: 15, margin: '4px 0 10px', color: 'var(--accent)' }}>افزودن کاربر جدید</h3>
        <form onSubmit={handleAdd} className="edit-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="edit-field">
            <span>نام کاربری</span>
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
          </label>
          <label className="edit-field">
            <span>رمز عبور</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label className="edit-field">
            <span>نقش</span>
            <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="user">کاربر</option>
              <option value="admin">ادمین</option>
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ alignSelf: 'end' }}>
            افزودن
          </button>
        </form>
      </div>
    </div>
  )
}
