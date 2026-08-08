import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // null = مهمان
  const [loading, setLoading] = useState(true)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginError, setLoginError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (username, password) => {
    setLoginError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLoginError(data.error || 'ورود ناموفق بود')
        return false
      }
      setUser(data)
      setLoginOpen(false)
      return true
    } catch {
      setLoginError('اتصال به سرور ناموفق بود')
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    setUser(null)
  }, [])

  // اگه یه فراخوانی API با 401 برگرده (سشن منقضی شده)، همین تابع رو صدا بزن
  // تا هم وضعیت کاربر پاک بشه و هم مدال ورود باز بشه.
  const openLogin = useCallback(() => {
    setLoginError('')
    setLoginOpen(true)
  }, [])

  const value = {
    user,
    loading,
    isGuest: !user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    loginOpen,
    setLoginOpen,
    loginError,
    openLogin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
