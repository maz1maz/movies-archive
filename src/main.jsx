import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import LoginModal from './components/LoginModal.jsx'
import AdminUsersModal from './components/AdminUsersModal.jsx'
import './styles.css'

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))

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
