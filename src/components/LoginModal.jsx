import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginModal() {
  const { loginOpen, setLoginOpen, login, loginError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loginOpen) return null

  const close = () => {
    setLoginOpen(false)
    setUsername('')
    setPassword('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setSubmitting(true)
    const ok = await login(username.trim(), password)
    setSubmitting(false)
    if (ok) {
      setUsername('')
      setPassword('')
    }
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="edit-modal" style={{ width: 'min(380px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={close} aria-label="Close">
          ✕
        </button>
        <h2 className="edit-title">Log in to the Archive</h2>
        <form onSubmit={submit} className="edit-form" style={{ gridTemplateColumns: '1fr' }}>
          <label className="edit-field full">
            <span>Username</span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="edit-field full">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {loginError && (
            <p style={{ color: '#e2555b', fontSize: 13, margin: '0 0 4px' }}>{loginError}</p>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ justifySelf: 'start' }}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 14 }}>
          You can browse and search the whole archive without logging in — only editing and adding require login.
        </p>
      </div>
    </div>
  )
}
