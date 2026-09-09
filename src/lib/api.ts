/**
 * HTTP client for the Moifone ERP API.
 *
 * Base is `/api` by default so the Vite dev proxy (see vite.config.ts) handles
 * CORS and cookies in development; set VITE_API_BASE to hit an origin directly
 * from a packaged Tauri/Capacitor build.
 *
 * Auth: every protected call carries the POS-scoped bearer token minted by
 * `POST /api/pos/device/pin-login`. That token lives 8 hours — a full shift —
 * so there is deliberately NO refresh-on-401 retry here. Two reasons:
 *
 *   1. `POST /api/auth/refresh` only accepts ERP sessions
 *      (`hasActiveSession(pool, staffPk, 'erp')`), so a POS session's refresh
 *      token is rejected with "Session expired" every time.
 *   2. Even if it succeeded it re-signs a plain access token with no `scope`
 *      and no `sid` claim, so the till would silently lose its station binding
 *      and start writing KOTs against the staff row's default station.
 *
 * A 401 therefore means the shift token is genuinely done. We clear the staff
 * session and let SessionGate drop back to the PIN screen — the cashier taps
 * four digits and carries on. Device enrollment survives.
 */
import { SessionManager } from '../utils/sessionManager'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export class ApiError extends Error {
  status: number
  code: string | null
  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Notified when the server rejects our token, so the UI can return to PIN login. */
type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOpts {
  /** Skip the Authorization header — for the public enroll / PIN endpoints. */
  public?: boolean
  signal?: AbortSignal
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  opts: RequestOpts = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (!opts.public) {
    const token = SessionManager.accessToken?.trim()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: opts.signal,
  })

  // 204 and other empty bodies must not blow up on res.json().
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const payload = (data ?? {}) as Record<string, unknown>
    const message =
      (typeof payload.message === 'string' && payload.message) ||
      `Request failed (${res.status})`
    const code = typeof payload.code === 'string' ? payload.code : null

    // The token is dead or the session was revoked server-side. Public calls are
    // exempt: a wrong PIN is also a 401 and must not wipe the session.
    if (res.status === 401 && !opts.public) onUnauthorized?.()

    throw new ApiError(message, res.status, code)
  }

  return data as T
}

/** Build a querystring from defined, non-empty values only. */
export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    const s = String(value).trim()
    if (s === '') continue
    sp.set(key, s)
  }
  const out = sp.toString()
  return out ? `?${out}` : ''
}

export const api = {
  get:    <T>(path: string, opts?: RequestOpts) => request<T>('GET', path, undefined, opts),
  post:   <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('POST', path, body, opts),
  put:    <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PUT', path, body, opts),
  patch:  <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PATCH', path, body, opts),
  delete: <T>(path: string, opts?: RequestOpts) => request<T>('DELETE', path, undefined, opts),
}

export default api
