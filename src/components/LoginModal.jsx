import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useOverlayClose } from '../hooks/useOverlayClose.js'
import './LoginModal.css'

export default function LoginModal() {
  const { loginOpen, setLoginOpen, login, loginError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const close = () => {
    setLoginOpen(false)
    setUsername('')
    setPassword('')
  }
  const overlayHandlers = useOverlayClose(close)

  if (!loginOpen) return null

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
    <div className="modal-overlay" {...overlayHandlers}>
      <div
        className="uv-login"
        role="dialog"
        aria-modal="true"
        aria-labelledby="uv-login-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="uv-login-box">
          <button type="button" className="modal-close uv-login-close" onClick={close} aria-label="Close">
            ✕
          </button>
          <form onSubmit={submit} className="uv-login-form">
            <div className="uv-login-logo" aria-hidden="true" />
            <h2 id="uv-login-title" className="uv-login-header">Log in to the Archive</h2>
            <input
              className="uv-login-input"
              autoFocus
              placeholder="Username"
              aria-label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              className="uv-login-input"
              type="password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {loginError && (
              <p className="uv-login-error" role="alert">
                {loginError}
              </p>
            )}
            <button type="submit" className="uv-login-button" disabled={submitting}>
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
            <p className="uv-login-footer">
              Log in to browse the archive, search the catalogue and manage titles.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
