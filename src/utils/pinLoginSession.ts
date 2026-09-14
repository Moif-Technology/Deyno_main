/**
 * Apply / clear staff session after PIN login.
 * Logout clears JWT only; device enrollment stays so the next staff enters PIN.
 */
import { SessionManager } from './sessionManager'
import { getEnrollment } from './deviceEnrollment'
import { isAccessTokenExpired } from './tokenExpiry'

export function applyPinLoginSession(session: Record<string, unknown>): void {
  const stationId = String(session.stationId ?? '').trim()
  const staffName = String(session.staffName ?? '').trim()
  const staffID = String(session.staffID ?? '').trim()
  const roleId = String(session.roleId ?? session.role ?? '').trim()
  const roleName = String(session.roleName ?? '').trim()
  const accessToken = String(session.accessToken ?? '').trim()
  const refreshToken = session.refreshToken ? String(session.refreshToken) : undefined
  const enrollment = getEnrollment()
  const companyId = String(session.companyId ?? enrollment?.companyId ?? '').trim()
  const deviceToken = enrollment?.deviceToken ?? SessionManager.deviceToken ?? undefined

  if (!stationId || !staffName || !staffID || !accessToken) {
    throw new Error('Login response incomplete (missing stationId / staffName / staffID / token).')
  }

  SessionManager.setSession({
    stationId,
    staffName,
    staffID,
    roleId,
    roleName,
    accessToken,
    refreshToken,
    companyId: companyId || undefined,
    deviceToken,
    subscription: (session.subscription as Record<string, unknown>) ?? undefined,
    features: (session.features as Record<string, unknown>) ?? undefined,
    limits: (session.limits as Record<string, unknown>) ?? undefined,
    permissions: Array.isArray(session.permissions) ? session.permissions : undefined,
  })
}

/** True when we have a usable staff JWT (enrolled device alone is not enough). */
export function hasActiveStaffSession(): boolean {
  return Boolean(
    SessionManager.accessToken &&
      SessionManager.staffID &&
      SessionManager.stationId &&
      !isAccessTokenExpired(SessionManager.accessToken),
  )
}

/**
 * End the current staff JWT. Keeps device enrollment (companyId + deviceToken).
 */
export function clearStaffSession(): void {
  const enrollment = getEnrollment()
  SessionManager.clearSession()
  if (enrollment) {
    SessionManager.deviceToken = enrollment.deviceToken
    SessionManager.companyId = String(enrollment.companyId)
    localStorage.setItem('deviceToken', enrollment.deviceToken)
    localStorage.setItem('companyId', String(enrollment.companyId))
  }
}
