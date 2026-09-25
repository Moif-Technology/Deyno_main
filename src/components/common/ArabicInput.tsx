/**
 * ArabicInput — the Arabic half of an English/Arabic field pair. Whenever the
 * English text (`source`) is edited, the Arabic value is re-translated and
 * replaced (debounced) — including when editing a saved record or after a
 * manual Arabic edit. When a record is loaded (English and Arabic change
 * together) the saved Arabic is kept as-is.
 */
import { useEffect, useRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { translateToArabic } from '../../utils/translate'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'dir'> & {
  value: string
  onValueChange: (value: string) => void
  /** The English text to convert — usually the field just above. */
  source: string
  maxLength?: number
  /** Called when translation fails (offline / provider down). */
  onTranslateError?: () => void
}

export function ArabicInput({
  value,
  onValueChange,
  source,
  maxLength,
  onTranslateError,
  className,
  ...inputProps
}: Props) {
  const prevSource = useRef(source)
  const prevValue = useRef(value)
  const latest = useRef({ onValueChange, onTranslateError, maxLength })
  latest.current = { onValueChange, onTranslateError, maxLength }

  useEffect(() => {
    const sourceChanged = source !== prevSource.current
    const valueChanged = value !== prevValue.current
    prevSource.current = source
    prevValue.current = value
    // Only react to the English text being edited on its own. If both moved
    // in the same update, a record was loaded or the form was reset.
    if (!sourceChanged || valueChanged) return
    const text = source.trim()
    if (!text) return
    let cancelled = false
    const timer = setTimeout(() => {
      translateToArabic(text)
        .then((translated) => {
          if (cancelled || !translated) return
          const { onValueChange: set, maxLength: max } = latest.current
          const next = max ? translated.slice(0, max) : translated
          prevValue.current = next
          set(next)
        })
        .catch(() => {
          if (!cancelled) latest.current.onTranslateError?.()
        })
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [source, value])

  return (
    <input
      dir="rtl"
      className={className}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onValueChange(e.target.value)}
      {...inputProps}
    />
  )
}

export default ArabicInput
