import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import EnrollPage from './pages/EnrollPage'
import LoginPage from './pages/LoginPage'
import TillPlaceholderPage from './pages/TillPlaceholderPage'
import PosMainPage from './pages/pos/PosMainPage'
import { getEnrollment } from './utils/deviceEnrollment'
import { clearStaffSession, hasActiveStaffSession } from './utils/pinLoginSession'
import { setUnauthorizedHandler } from './lib/api'
import { handleEnterMovesFocus } from './utils/focusNav'

function RequireEnrollment({ children }: { children: React.ReactNode }) {
  const enrollment = getEnrollment()
  if (!enrollment) return <Navigate to="/enroll" replace />
  return children
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!hasActiveStaffSession()) return <Navigate to="/" replace />
  return children
}

export default function App() {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStaffSession()
      window.location.assign('/')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  return (
    // Enter-moves-to-next-field for every form in the app — attached once
    // here (rather than per-page) so it also covers Login/Enroll, not just
    // the POS screen. Tab already does this natively; only Enter needs it.
    <div onKeyDown={handleEnterMovesFocus}>
      <BrowserRouter>
        <Routes>
          <Route path="/enroll" element={<EnrollPage />} />
          <Route
            path="/"
            element={
              <RequireEnrollment>
                <LoginPage />
              </RequireEnrollment>
            }
          />
          <Route
            path="/pos"
            element={
              <RequireAuth>
                <PosMainPage />
              </RequireAuth>
            }
          />
          <Route
            path="/pos-placeholder"
            element={
              <RequireAuth>
                <TillPlaceholderPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}
