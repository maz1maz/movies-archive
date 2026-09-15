import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('fa_theme') || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  )

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
    localStorage.setItem('fa_theme', theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
