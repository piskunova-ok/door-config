import React from 'react'
import ReactDOM from 'react-dom/client'
import PublicRoute from './PublicRoute.tsx'
import AdminPage from './admin/AdminPage.tsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{window.location.pathname.startsWith('/admin') ? <AdminPage /> : <PublicRoute />}</React.StrictMode>,
)
