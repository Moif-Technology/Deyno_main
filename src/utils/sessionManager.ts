/**
 * Persists the POS till session.
 * Persists to localStorage so refresh keeps the till session.
 */
const KEYS = {
  stationId: 'stationId',
  staffName: 'staffName',
  staffID: 'staffId',
  roleId: 'roleId',
  roleName: 'roleName',
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  companyId: 'companyId',
  deviceToken: 'deviceToken',
} as const

class SessionManagerImpl {
  stationId: string | null = localStorage.getItem(KEYS.stationId)
  staffName: string | null = localStorage.getItem(KEYS.staffName)
  staffID: string | null = localStorage.getItem(KEYS.staffID)
  roleId: string | null = localStorage.getItem(KEYS.roleId)
  roleName: string | null = localStorage.getItem(KEYS.roleName)
  accessToken: string | null = localStorage.getItem(KEYS.accessToken)
  refreshToken: string | null = localStorage.getItem(KEYS.refreshToken)
  companyId: string | null = localStorage.getItem(KEYS.companyId)
  deviceToken: string | null = localStorage.getItem(KEYS.deviceToken)
  subscription: Record<string, unknown> | null = null
  features: Record<string, unknown> | null = null
  limits: Record<string, unknown> | null = null
  permissions: unknown[] | null = null
  businessType: string | null = null
  branding: Record<string, unknown> | null = null

  setSession(opts: {
    stationId: string
    staffName: string
    staffID: string
    roleId?: string
    roleName?: string
    accessToken?: string
    refreshToken?: string
    companyId?: string
    deviceToken?: string
    subscription?: Record<string, unknown>
    features?: Record<string, unknown>
    limits?: Record<string, unknown>
    permissions?: unknown[]
    businessType?: string
    branding?: Record<string, unknown>
  }) {
    this.stationId = opts.stationId
    this.staffName = opts.staffName
    this.staffID = opts.staffID
    if (opts.roleId !== undefined) this.roleId = opts.roleId || null
    if (opts.roleName !== undefined) this.roleName = opts.roleName || null
    this.accessToken = opts.accessToken ?? this.accessToken
    this.refreshToken = opts.refreshToken ?? this.refreshToken
    this.companyId = opts.companyId ?? this.companyId
    this.deviceToken = opts.deviceToken ?? this.deviceToken
    this.subscription = opts.subscription ?? this.subscription
    this.features = opts.features ?? this.features
    this.limits = opts.limits ?? this.limits
    this.permissions = opts.permissions ?? this.permissions
    this.businessType = opts.businessType ?? this.businessType
    this.branding = opts.branding ?? this.branding

    localStorage.setItem(KEYS.stationId, opts.stationId)
    localStorage.setItem(KEYS.staffName, opts.staffName)
    localStorage.setItem(KEYS.staffID, opts.staffID)
    if (opts.roleId !== undefined) {
      if (opts.roleId) localStorage.setItem(KEYS.roleId, opts.roleId)
      else localStorage.removeItem(KEYS.roleId)
    }
    if (opts.roleName !== undefined) {
      if (opts.roleName) localStorage.setItem(KEYS.roleName, opts.roleName)
      else localStorage.removeItem(KEYS.roleName)
    }
    if (opts.accessToken) localStorage.setItem(KEYS.accessToken, opts.accessToken)
    if (opts.refreshToken) localStorage.setItem(KEYS.refreshToken, opts.refreshToken)
    if (opts.companyId) localStorage.setItem(KEYS.companyId, opts.companyId)
    if (opts.deviceToken) localStorage.setItem(KEYS.deviceToken, opts.deviceToken)
  }

  /**
   * Clears staff JWT + session fields.
   * Prefer `clearStaffSession()` from pinLoginSession when logout should keep enrollment.
   */
  clearSession() {
    this.stationId = null
    this.staffName = null
    this.staffID = null
    this.roleId = null
    this.roleName = null
    this.accessToken = null
    this.refreshToken = null
    this.companyId = null
    this.deviceToken = null
    this.subscription = null
    this.features = null
    this.limits = null
    this.permissions = null
    this.businessType = null
    this.branding = null
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
  }
}

export const SessionManager = new SessionManagerImpl()
