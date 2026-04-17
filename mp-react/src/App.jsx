import { Routes, Route, Navigate } from 'react-router-dom'
import FormPage from './pages/FormPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import LoginPage from './pages/LoginPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FormPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
