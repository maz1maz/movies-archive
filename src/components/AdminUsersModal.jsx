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
      if (!res.ok) throw new Error(data.error || 'Failed to load user list')
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
      if (!res.ok) throw new Error(data.error || 'Failed to add user')
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
    if (!window.confirm(`Delete user "${u.username}"?`)) return
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
    const pw = window.prompt(`New password for "${u.username}" (min 6 characters):`)
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
      if (!res.ok) throw new Error(data.error || 'Failed to change password')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-modal" style={{ width: 'min(520px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="edit-title">Manage Users</h2>

        {error && <p style={{ color: '#e2555b', fontSize: 13 }}>{error}</p>}

        {users === null ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
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
                    {u.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => handleResetPassword(u)}>
                    Change password
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => handleRoleToggle(u)}>
                    {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                  </button>
                  {u.id !== currentUser?.id && (
                    <button type="button" className="btn btn-danger-text" disabled={busy} onClick={() => handleDelete(u)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ fontSize: 15, margin: '4px 0 10px', color: 'var(--accent)' }}>Add New User</h3>
        <form onSubmit={handleAdd} className="edit-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="edit-field">
            <span>Username</span>
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
          </label>
          <label className="edit-field">
            <span>Password</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label className="edit-field">
            <span>Role</span>
            <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ alignSelf: 'end' }}>
            Add
          </button>
        </form>
      </div>
    </div>
  )
}
