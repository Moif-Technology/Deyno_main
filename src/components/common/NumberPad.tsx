/**
 * NumberPad — the app's standard number keypad (the same `.pd-key` buttons as
 * the home screen and qty dialogs): 7-8-9 / 4-5-6 / 1-2-3 / last row.
 *
 * Tapping a key calls `onKey` with the key value. The keypad never steals
 * focus, so the cursor stays in whichever input the numbers go into.
 *
 *   <NumberPad onKey={press} />                                  // … C 0 .
 *   <NumberPad keys={['C', '0', 'next']} labels={{ next: 'Next' }} onKey={press} />
 *
 * Styles: `.pd-key` in pages/pos/posMain.css; layout in ./NumberPad.css.
 */
import type { ReactNode } from 'react'
import './NumberPad.css'

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'] as const

export type NumberPadProps = {
  onKey: (key: string) => void
  /** The bottom row (3 keys). Default: C · 0 · . */
  keys?: [string, string, string]
  /** Custom content for any key, e.g. { next: <>Next →</> }. */
  labels?: Record<string, ReactNode>
  disabled?: boolean
  className?: string
}

export function NumberPad({ onKey, keys = ['C', '0', '.'], labels = {}, disabled, className }: NumberPadProps) {
  return (
    <div className={`ui-numpad${className ? ` ${className}` : ''}`} role="group" aria-label="Keypad">
      {[...DIGITS, ...keys].map((k) => (
        <button
          key={k}
          type="button"
          className={`pd-key${k === 'C' ? ' is-clear' : ''}${!/^[\d.]$/.test(k) && k !== 'C' ? ' is-action' : ''}`}
          disabled={disabled}
          // Keep the cursor in the field the numbers go into.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onKey(k)}
        >
          {labels[k] ?? k}
        </button>
      ))}
    </div>
  )
}

export default NumberPad
