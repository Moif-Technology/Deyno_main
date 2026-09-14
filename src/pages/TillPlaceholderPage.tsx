import { useNavigate } from 'react-router-dom'
import { SessionManager } from '../utils/sessionManager'
import { clearStaffSession } from '../utils/pinLoginSession'
import { clearEnrollment, getEnrollment } from '../utils/deviceEnrollment'

export default function TillPlaceholderPage() {
  const navigate = useNavigate()
  const enrollment = getEnrollment()

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          height: 52,
          flexShrink: 0,
          background: 'linear-gradient(145deg, var(--brand) 0%, var(--brand-2) 100%)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          color: '#fff',
          gap: 16,
        }}
      >
        <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>DEYNO PRO</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {SessionManager.staffName} · {enrollment?.stationName || `Station ${SessionManager.stationId}`}
        </div>
        <button
          type="button"
          onClick={() => {
            clearStaffSession()
            navigate('/')
          }}
          style={{
            marginLeft: 12,
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Sign out
        </button>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 32,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Till UI not built yet</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 18 }}>
            Device enrollment and PIN login are working. The dine-in screen replaces this placeholder.
          </p>
          <dl style={{ fontSize: 13, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 8 }}>
            <dt style={{ color: 'var(--text-3)' }}>Staff</dt>
            <dd>{SessionManager.staffName}</dd>
            <dt style={{ color: 'var(--text-3)' }}>Station</dt>
            <dd>{enrollment?.stationName || SessionManager.stationId}</dd>
            <dt style={{ color: 'var(--text-3)' }}>Company</dt>
            <dd>{SessionManager.companyId}</dd>
          </dl>
          <button
            type="button"
            onClick={() => {
              clearStaffSession()
              clearEnrollment()
              navigate('/enroll')
            }}
            style={{
              marginTop: 22,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--brand)',
              textDecoration: 'underline',
            }}
          >
            Re-enroll this device
          </button>
        </div>
      </main>
    </div>
  )
}
