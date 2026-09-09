/**
 * Device enrollment persistence — pure localStorage, no backend.
 * Token is stable per browser; company/station are set after admin enroll.
 */

const KEYS = {
  deviceToken: 'deyno_device_token',
  companyId: 'deyno_company_id',
  stationId: 'deyno_station_id',
  stationName: 'deyno_station_name',
} as const

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Stable per-install identifier. Created once, reused forever. */
export function getOrCreateDeviceToken(): string {
  const existing = localStorage.getItem(KEYS.deviceToken)?.trim()
  if (existing) return existing
  const token = `deyno-${randomHex(16)}`
  localStorage.setItem(KEYS.deviceToken, token)
  return token
}

export function getDeviceToken(): string | null {
  const t = localStorage.getItem(KEYS.deviceToken)?.trim()
  return t || null
}

export function isDeviceEnrolled(): boolean {
  const companyId = Number(localStorage.getItem(KEYS.companyId))
  const token = getDeviceToken()
  return Boolean(token && Number.isFinite(companyId) && companyId > 0)
}

export type DeviceEnrollment = {
  deviceToken: string
  companyId: number
  stationId: number | null
  stationName: string
}

export function getEnrollment(): DeviceEnrollment | null {
  if (!isDeviceEnrolled()) return null
  const deviceToken = getDeviceToken()!
  const companyId = Number(localStorage.getItem(KEYS.companyId))
  const stationRaw = localStorage.getItem(KEYS.stationId)
  const stationId = stationRaw != null && stationRaw !== '' ? Number(stationRaw) : null
  return {
    deviceToken,
    companyId,
    stationId: Number.isFinite(stationId) && (stationId as number) > 0 ? stationId : null,
    stationName: localStorage.getItem(KEYS.stationName)?.trim() || '',
  }
}

export function saveEnrollment(opts: {
  companyId: number
  stationId?: number | null
  stationName?: string | null
  deviceToken?: string
}) {
  const token = opts.deviceToken?.trim() || getOrCreateDeviceToken()
  localStorage.setItem(KEYS.deviceToken, token)
  localStorage.setItem(KEYS.companyId, String(opts.companyId))
  if (opts.stationId != null && Number.isFinite(opts.stationId)) {
    localStorage.setItem(KEYS.stationId, String(opts.stationId))
  }
  if (opts.stationName != null) {
    localStorage.setItem(KEYS.stationName, opts.stationName)
  }
  // Keep SessionManager device/company in sync for API headers after login.
  localStorage.setItem('deviceToken', token)
  localStorage.setItem('companyId', String(opts.companyId))
}

/** Unpair station/company. Keeps the device token so re-enroll reuses the same row. */
export function clearEnrollment() {
  localStorage.removeItem(KEYS.companyId)
  localStorage.removeItem(KEYS.stationId)
  localStorage.removeItem(KEYS.stationName)
}
