import { SessionManager } from './sessionManager'

/** Session fields used for settle / job save (from SessionManager). */
export function getPosSession() {
  return {
    accessToken: SessionManager.accessToken || '',
    stationId: Number(SessionManager.stationId || 0) || 0,
    staffId: Number(SessionManager.staffID || 0) || 0,
    staffName: SessionManager.staffName || 'Admin',
    counterNo: Number(SessionManager.stationId || 1) || 1,
  }
}

export function parseProductId(id: string | number): number {
  if (typeof id === 'number' && Number.isFinite(id)) return id
  const n = Number(id)
  if (Number.isFinite(n) && n > 0) return n
  const digits = String(id).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function fmtMoney(v: number, decimals = 2) {
  return v.toFixed(decimals)
}

export function parseMoney(s: string) {
  const cleaned = s.trim().replace(/,/g, '')
  if (!cleaned) return 0
  return Number(cleaned) || 0
}
