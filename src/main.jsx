import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Landing from './components/Landing.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import LoginModal from './components/LoginModal.jsx'
import AdminUsersModal from './components/AdminUsersModal.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import './styles.css'

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

function AdminModalMount() {
  const { adminOpen, setAdminOpen } = useAuth()
  return <AdminUsersModal open={adminOpen} onClose={() => setAdminOpen(false)} />
}

// Logged-out visitors land on the marketing page; only signed-in users see
// the actual archive. Auth status resolves before the splash screen fades,
// so there is no flash of the wrong view.
function RootView() {
  const { isGuest, loading } = useAuth()
  if (loading) return null
  return isGuest ? <Landing /> : <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <RootView />
        <LoginModal />
        <AdminModalMount />
      </AuthProvider>
      <SplashScreen />
    </ErrorBoundary>
  </React.StrictMode>,
)
