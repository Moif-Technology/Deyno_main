import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../api/apiService'
import { getEnrollment, clearEnrollment, getOrCreateDeviceToken } from '../utils/deviceEnrollment'
import { applyPinLoginSession } from '../utils/pinLoginSession'

const NUMPAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫']

type StaffOption = {
  staffId: number
  staffName: string
  roleName: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const enrollment = getEnrollment()

  const [staffList, setStaffList] = useState<StaffOption[] | null>(null)
  const [staffListError, setStaffListError] = useState<string | null>(null)
  const [staffListLoading, setStaffListLoading] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null)

  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enrollment) return
    let cancelled = false
    setStaffListLoading(true)
    setStaffListError(null)
    apiService
      .fetchPosStaffList(enrollment.deviceToken ?? getOrCreateDeviceToken())
      .then((rows) => {
        if (cancelled) return
        const options = rows
          .map((r) => ({
            staffId: Number(r.staffPk),
            staffName: String(r.staffName ?? ''),
            roleName: String(r.roleName ?? ''),
          }))
          .filter((s) => Number.isFinite(s.staffId) && s.staffName)
        setStaffList(options)
      })
      .catch((err) => {
        if (cancelled) return
        setStaffListError(err instanceof Error ? err.message : 'Could not load staff list')
      })
      .finally(() => {
        if (!cancelled) setStaffListLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollment?.deviceToken])

  const pressKey = useCallback((k: string) => {
    if (k === '⌫' || k === 'Backspace') {
      setPin((p) => p.slice(0, -1))
      setError(null)
      return
    }
    if (k === 'C' || k === 'Escape') {
      setPin('')
      setError(null)
      return
    }
    if (/^\d$/.test(k)) {
      setPin((p) => (p.length < 6 ? p + k : p))
      setError(null)
    }
  }, [])

  const login = useCallback(async () => {
    if (!selectedStaff) {
      setError('Select your name first')
      return
    }
    if (pin.length < 4) {
      setError('PIN must be 4–6 digits')
      return
    }
    if (!enrollment) {
      navigate('/enroll')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const session = await apiService.pinLogin({
        pin,
        companyId: enrollment.companyId,
        staffId: selectedStaff.staffId,
        deviceToken: enrollment.deviceToken ?? getOrCreateDeviceToken(),
      })
      applyPinLoginSession(session)
      navigate('/pos')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      const lower = msg.toLowerCase()
      if (
        lower.includes('not enrolled') ||
        lower.includes('different company') ||
        lower.includes('no station')
      ) {
        clearEnrollment()
        navigate('/enroll')
        return
      }
      setError(msg)
      setPin('')
    } finally {
      setLoading(false)
    }
  }, [pin, enrollment, navigate, selectedStaff])

  useEffect(() => {
    if (!selectedStaff) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        void login()
        return
      }
      pressKey(e.key)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pressKey, login, selectedStaff])

  const pinDots = Array.from({ length: 6 }, (_, i) => i < pin.length)

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 340,
          flexShrink: 0,
          background: 'linear-gradient(160deg, var(--brand) 0%, var(--brand-2) 60%, #450418 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
            backgroundSize: '28px 28px',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <img
          src="/logo-white.png"
          alt="Deyno"
          style={{ width: 200, height: 'auto', position: 'relative', marginBottom: 14 }}
        />
        <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', position: 'relative' }}>
          Restaurant POS
        </div>

        <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.2)', margin: '28px 0', position: 'relative' }} />

        <div style={{ position: 'relative', textAlign: 'center' }}>
          {['Table-side dining & KOT', 'Multi-course order flow', 'Counter X / Z reports'].map((feat) => (
            <div
              key={feat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                color: 'rgba(255,255,255,0.82)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
              {feat}
            </div>
          ))}
        </div>

        {enrollment && (
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              color: 'rgba(255,255,255,0.78)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.4,
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            {enrollment.stationName || 'Restaurant till'} · Co. {enrollment.companyId}
            <br />
            <button
              onClick={() => {
                clearEnrollment()
                navigate('/enroll')
              }}
              style={{
                color: 'rgba(255,255,255,0.78)',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'underline',
                marginTop: 2,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Re-enroll device
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 40px',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 320 }}>
          {!selectedStaff ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-heading)', color: 'var(--text-1)', lineHeight: 1.1 }}>Who's signing in?</h1>
                <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 5, fontWeight: 600 }}>Select your name to continue</p>
              </div>

              {staffListError && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--red-bg)',
                    border: '1px solid var(--red-border)',
                    color: 'var(--red)',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {staffListError}
                </div>
              )}

              {staffListLoading && (
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Loading staff…</div>
              )}

              {!staffListLoading && staffList && staffList.length === 0 && !staffListError && (
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
                  No staff with a PIN found for this station.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {staffList?.map((s) => (
                  <button
                    key={s.staffId}
                    type="button"
                    onClick={() => {
                      setSelectedStaff(s)
                      setError(null)
                      setPin('')
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '13px 16px',
                      borderRadius: 'var(--r-md)',
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-1)',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{s.staffName}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {s.roleName}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-heading)', color: 'var(--text-1)', lineHeight: 1.1 }}>Hi, {selectedStaff.staffName}</h1>
                <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 5, fontWeight: 600 }}>
                  Enter your PIN to continue ·{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaff(null)
                      setPin('')
                      setError(null)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--brand)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: 14,
                    }}
                  >
                    not you?
                  </button>
                </p>
              </div>

              {error && (
                <div
                  style={{
                    marginBottom: 16,
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

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--brand)', letterSpacing: 0.8, marginBottom: 10 }}>
                  PIN
                </label>
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '18px 18px',
                    borderRadius: 'var(--r-md)',
                    background: 'var(--surface)',
                    border: '1.5px solid var(--brand)',
                    boxShadow: '0 0 0 3px var(--brand-glow)',
                  }}
                >
                  {pinDots.map((filled, i) => (
                    <div
                      key={i}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: filled ? 'var(--brand)' : 'var(--border)',
                        transition: 'background 0.12s',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 18 }}>
                {NUMPAD.map((k) => {
                  const isAction = k === '⌫' || k === 'C'
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => pressKey(k)}
                      style={{
                        padding: '15px 0',
                        borderRadius: 'var(--r-md)',
                        border: `1.5px solid ${isAction ? 'var(--red-border)' : 'var(--border)'}`,
                        background: isAction ? 'var(--red-bg)' : 'var(--surface)',
                        color: isAction ? 'var(--red)' : 'var(--text-1)',
                        fontSize: isAction ? 13 : 20,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        fontVariantNumeric: 'tabular-nums',
                        boxShadow: 'var(--shadow-xs)',
                        transition: 'transform 0.08s, background 0.1s',
                        cursor: 'pointer',
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'scale(0.93)'
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                      }}
                    >
                      {k}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => void login()}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '15px 0',
                  borderRadius: 'var(--r-lg)',
                  background: loading
                    ? 'var(--surface-3)'
                    : 'linear-gradient(145deg, var(--brand) 0%, var(--brand-2) 100%)',
                  color: loading ? 'var(--text-3)' : '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 18px rgba(107,0,0,0.28)',
                  transition: 'all 0.18s',
                }}
              >
                {loading
                  ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        Signing in...
                      </span>
                    )
                  : 'SIGN IN'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
