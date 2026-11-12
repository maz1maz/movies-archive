import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Landing from './components/Landing.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import LoginModal from './components/LoginModal.jsx'
import AdminUsersModal from './components/AdminUsersModal.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import './styles.css'

// زمان‌بندی بوت برای عیب‌یابی اپ تلویزیون (لاگ در نوار پایین اپ اندروید دیده میشه)
const bootT0 = performance.now()
export const bootMark = (msg) => console.info('[boot] ' + msg + ' ' + Math.round(performance.now() - bootT0) + 'ms')
bootMark('main start')

if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key.startsWith('film-archive-app')) {
        caches.delete(key)
      }
    })
  })
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update()
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    })
  })
}

// وقتی سقف روزانه‌ی D1 پر شده، سرور فیلم‌ها رو از آخرین بکاپ برای خواندن می‌ده و هدر
// X-Stale-Data می‌فرسته — یه نوار ثابت بالای صفحه نشون می‌دیم تا کاربر بدونه تغییرات غیرفعاله.
;(() => {
  const nativeFetch = window.fetch.bind(window)
  let shown = false
  window.fetch = async (...args) => {
    const res = await nativeFetch(...args)
    try {
      if (!shown && res.headers.get('X-Stale-Data')) {
        shown = true
        const bar = document.createElement('div')
        bar.textContent = 'Database daily limit reached — showing the saved copy. Changes are disabled until it resets (about 03:30 Tehran).'
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b45309;color:#fff;font:600 12.5px system-ui,sans-serif;padding:6px 12px;text-align:center'
        document.body.appendChild(bar)
      }
    } catch {}
    return res
  }
})()

function AdminModalMount() {
  const { adminOpen, setAdminOpen } = useAuth()
  return <AdminUsersModal open={adminOpen} onClose={() => setAdminOpen(false)} />
}

// Logged-out visitors land on the marketing page; only signed-in users see
// the actual archive. Auth status resolves before the splash screen fades,
// so there is no flash of the wrong view.
function RootView() {
  const { isGuest, loading } = useAuth()
  useEffect(() => {
    if (!loading) bootMark('auth ready')
  }, [loading])
  if (loading) return null
  return isGuest ? <Landing /> : <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RootView />
          <LoginModal />
          <AdminModalMount />
          <SplashScreen />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
