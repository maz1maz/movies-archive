import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import LoginModal from './components/LoginModal.jsx'
import AdminUsersModal from './components/AdminUsersModal.jsx'
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
        <LoginModal />
        <AdminModalMount />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
