/** True when JWT `exp` is missing or already past (with 30s skew). */
export function isAccessTokenExpired(token: string | null | undefined): boolean {
  const t = token?.trim()
  if (!t) return true
  const parts = t.split('.')
  if (parts.length < 2) return true
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { exp?: number }
    if (typeof payload.exp !== 'number') return true
    return payload.exp * 1000 <= Date.now() + 30_000
  } catch {
    return true
  }
}
