import { useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../api/apiService'
import { getOrCreateDeviceToken, saveEnrollment } from '../utils/deviceEnrollment'

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  borderRadius: 'var(--r-sm)',
  background: 'var(--surface-2)',
  border: '1.5px solid var(--border)',
  color: 'var(--text-1)',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--brand)',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  marginBottom: 6,
}

type Station = {
  stationId: number
  stationName: string
  stationCode?: string
  counterNo?: number | null
  branchName?: string | null
}

export default function EnrollPage() {
  const navigate = useNavigate()

  const [creds, setCreds] = useState({ adminUsername: '', adminPassword: '' })
  const [stations, setStations] = useState<Station[] | null>(null)
  const [stationId, setStationId] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step = stations === null ? 1 : 2
  const credField = (k: 'adminUsername' | 'adminPassword') => (e: ChangeEvent<HTMLInputElement>) => {
    setCreds((f) => ({ ...f, [k]: e.target.value }))
    setError(null)
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    const { adminUsername, adminPassword } = creds
    if (!adminUsername || !adminPassword) {
      setError('Email and password are required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await apiService.enrollListStations({ adminUsername, adminPassword })
      const list = Array.isArray(result.stations) ? (result.stations as Station[]) : []
      if (!list.length) {
        setError(
          'No Restaurant POS stations found for this company. Create one in Station Management first.',
        )
        return
      }
      setStations(list)
      if (list.length === 1) setStationId(String(list[0].stationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stations')
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async (e: FormEvent) => {
    e.preventDefault()
    if (!stationId) {
      setError('Select a station')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const deviceToken = getOrCreateDeviceToken()
      const picked = stations?.find((s) => String(s.stationId) === stationId)
      const result = await apiService.enrollDevice({
        adminUsername: creds.adminUsername,
        adminPassword: creds.adminPassword,
        label: label || null,
        deviceToken,
        stationId: Number(stationId),
      })
      const companyId = Number(result.companyId)
      if (!Number.isFinite(companyId) || companyId < 1) {
        throw new Error('Enrollment response missing companyId')
      }
      saveEnrollment({
        companyId,
        stationId: Number(result.stationId ?? stationId),
        stationName: String(result.stationName ?? picked?.stationName ?? ''),
        deviceToken,
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Device enrollment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: '40px 36px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.10)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(145deg, var(--brand), var(--brand-2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 9,
            }}
          >
            <img src="/icon-mark-white.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-heading)', color: 'var(--text-1)' }}>Device Setup</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2, fontWeight: 600 }}>
              {step === 1 ? 'Register this terminal to a station' : 'Select station for this terminal'}
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--red-bg)',
              border: '1px solid var(--red-border)',
              color: 'var(--red)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleVerify}>
            {(
              [
                { key: 'adminUsername' as const, label: 'Admin Email', type: 'text', placeholder: 'admin@example.com' },
                { key: 'adminPassword' as const, label: 'Password', type: 'password', placeholder: '••••••••' },
              ]
            ).map(({ key, label: lbl, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{lbl.toUpperCase()}</label>
                <input
                  type={type}
                  value={creds[key]}
                  onChange={credField(key)}
                  placeholder={placeholder}
                  style={inputStyle}
                  autoComplete={key === 'adminPassword' ? 'current-password' : 'username'}
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 8,
                padding: '13px 0',
                borderRadius: 10,
                background: loading
                  ? 'var(--surface-3)'
                  : 'linear-gradient(145deg, var(--brand), var(--brand-2))',
                color: loading ? 'var(--text-3)' : '#fff',
                fontSize: 13.5,
                fontWeight: 800,
                letterSpacing: 0.8,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 18px rgba(107,0,0,0.28)',
              }}
            >
              {loading ? 'Verifying…' : 'NEXT →'}
            </button>
          </form>
        )}

        {step === 2 && stations && (
          <form onSubmit={handleEnroll}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>RESTAURANT POS STATION</label>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                <option value="">— Select station —</option>
                {stations.map((s) => (
                  <option key={s.stationId} value={String(s.stationId)}>
                    {s.stationName}
                    {s.stationCode ? ` (${s.stationCode})` : ''}
                    {s.branchName ? ` · ${s.branchName}` : ''}
                    {s.counterNo != null ? ` · Counter ${s.counterNo}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>TERMINAL LABEL (OPTIONAL)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Dining Till 1"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setStations(null)
                  setStationId('')
                  setLabel('')
                  setError(null)
                }}
                disabled={loading}
                style={{
                  flex: '0 0 auto',
                  padding: '13px 18px',
                  borderRadius: 10,
                  background: 'var(--surface-2)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading || !stationId}
                style={{
                  flex: 1,
                  padding: '13px 0',
                  borderRadius: 10,
                  background: loading || !stationId
                    ? 'var(--surface-3)'
                    : 'linear-gradient(145deg, var(--brand), var(--brand-2))',
                  color: loading || !stationId ? 'var(--text-3)' : '#fff',
                  fontSize: 13.5,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  cursor: loading || !stationId ? 'not-allowed' : 'pointer',
                  boxShadow: loading || !stationId ? 'none' : '0 4px 18px rgba(107,0,0,0.28)',
                }}
              >
                {loading ? 'Registering…' : 'REGISTER DEVICE'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
