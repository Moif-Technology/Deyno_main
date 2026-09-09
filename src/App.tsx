/**
 * Scaffold screen — proves the API wiring works, nothing more.
 *
 * It pings the backend, then reports whether this install is enrolled to a
 * company + RESTAURANT_POS station. The real till UI replaces this file; the
 * API layer under src/api and src/lib stays.
 */
import { useEffect, useState } from 'react'
import { getEnrollment, getOrCreateDeviceToken } from './utils/deviceEnrollment'

const HEALTH_URL = import.meta.env.VITE_API_BASE
  ? `${String(import.meta.env.VITE_API_BASE).replace(/\/api\/?$/, '')}/health`
  : '/health'

type Probe = { state: 'checking' } | { state: 'up'; detail: string } | { state: 'down'; detail: string }

export default function App() {
  const [probe, setProbe] = useState<Probe>({ state: 'checking' })
  const deviceToken = getOrCreateDeviceToken()
  const enrollment = getEnrollment()

  useEffect(() => {
    let alive = true
    fetch(HEALTH_URL)
      .then(async (res) => {
        const body = await res.text()
        if (!alive) return
        if (res.ok) setProbe({ state: 'up', detail: body.slice(0, 200) })
        else setProbe({ state: 'down', detail: `HTTP ${res.status}` })
      })
      .catch((err) => alive && setProbe({ state: 'down', detail: String(err) }))
    return () => {
      alive = false
    }
  }, [])

  return (
    <main className="min-h-screen bg-neutral-950 p-8 font-mono text-sm text-neutral-200">
      <h1 className="mb-6 text-xl font-bold">Deyno Pro — scaffold</h1>
      <dl className="space-y-2">
        <Row label="API base" value={String(import.meta.env.VITE_API_BASE ?? '/api (dev proxy)')} />
        <Row
          label="Backend"
          value={probe.state === 'checking' ? 'checking…' : `${probe.state} — ${probe.detail}`}
        />
        <Row label="Device token" value={deviceToken} />
        <Row
          label="Enrollment"
          value={
            enrollment
              ? `company ${enrollment.companyId}, station ${enrollment.stationId ?? '—'} ${enrollment.stationName}`
              : 'not enrolled — run the enroll flow (POST /api/pos/device/stations then /enroll)'
          }
        />
      </dl>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-32 shrink-0 text-neutral-500">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  )
}
