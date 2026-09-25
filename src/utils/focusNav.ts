/**
 * Enter → move to the next field, everywhere. Tab already does this
 * natively (browsers walk focusable elements in DOM order on their own),
 * so only Enter needs teaching — a bare <input> has no default behavior
 * for it.
 */
import type { KeyboardEvent } from 'react'

/** Scoped to the nearest dialog (every modal in this app renders
 * role="dialog") so Enter never jumps focus out of an open modal and into
 * the page behind it; falls back to the whole page for fields that aren't
 * inside a modal. */
export function focusNextField(current: HTMLElement) {
  const scope =
    (current.closest('[role="dialog"]') as HTMLElement | null) ??
    (current.closest('#root') as HTMLElement | null) ??
    document.body
  const focusable = Array.from(
    scope.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null)
  const idx = focusable.indexOf(current)
  if (idx === -1) return
  const next = focusable[idx + 1]
  if (!next) {
    current.blur()
    return
  }
  next.focus()
  if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
    next.select()
  }
}

/** Attach as onKeyDown on any page/dialog root. Skips <textarea> (Enter
 * should still insert a newline there) and <button> (Enter should still
 * activate it). */
export function handleEnterMovesFocus(e: KeyboardEvent) {
  if (e.key !== 'Enter') return
  const target = e.target as HTMLElement
  if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return
  e.preventDefault()
  focusNextField(target)
}
