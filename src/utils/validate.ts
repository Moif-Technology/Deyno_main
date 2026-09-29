/**
 * Input sanitisers (applied in onChange so bad characters never land in the
 * field) and validators (applied on save, for format rules a keystroke
 * filter can't enforce — e.g. a complete email address or a minimum length).
 */

/** Digits only, optionally capped in length. For counter no., TRN, etc. */
export function digits(value: string, maxLength?: number): string {
  const v = value.replace(/\D/g, '')
  return maxLength ? v.slice(0, maxLength) : v
}

/**
 * Non-negative decimal: digits with at most one dot and `places` decimals.
 * For qty, price, cost, amount and % fields.
 */
export function decimal(value: string, places = 3): string {
  const cleaned = value.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  const whole = cleaned.slice(0, dot)
  const frac = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, places)
  return `${whole}.${frac}`
}

/** Like `decimal`, but allows one leading minus (round-off adjustments). */
export function signedDecimal(value: string, places = 3): string {
  const negative = value.trimStart().startsWith('-')
  return (negative ? '-' : '') + decimal(value, places)
}

/** Percentage: a decimal capped at 100. */
export function percent(value: string, places = 2): string {
  const v = decimal(value, places)
  return Number(v) > 100 ? '100' : v
}

/** Phone: an optional leading "+" then digits, max 15 digits (E.164). */
export function phone(value: string): string {
  const plus = value.trimStart().startsWith('+')
  return (plus ? '+' : '') + digits(value, 15)
}

/** Strips spaces — they are never valid in an email address. */
export function email(value: string): string {
  return value.replace(/\s/g, '')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

/** 7–15 digits, optional leading "+". */
export function isPhone(value: string): boolean {
  return /^\+?\d{7,15}$/.test(value.trim())
}

/**
 * Returns an error message for an optional phone field, or null if it's
 * empty or valid.
 */
export function phoneError(value: string, label = 'Phone number'): string | null {
  if (!value.trim()) return null
  return isPhone(value) ? null : `${label} must be 7–15 digits`
}
