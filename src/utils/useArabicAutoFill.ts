/**
 * For a single English/Arabic field pair held in plain useState: call the
 * returned function from the English input's onChange and the Arabic
 * value fills in itself (debounced). Never overwrites a manual edit — only
 * replaces the Arabic value while it's empty or still what auto-fill put
 * there last. See translate.ts for the caveat that this needs internet.
 */
import { useRef } from 'react'
import { translateToArabic } from './translate'

export function useArabicAutoFill(
  setArabic: (updater: (prev: string) => string) => void,
  maxLen?: number,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAuto = useRef('')

  return function onEnglishChange(value: string) {
    if (timer.current) clearTimeout(timer.current)
    const trimmed = value.trim()
    if (!trimmed) return
    timer.current = setTimeout(() => {
      translateToArabic(trimmed)
        .then((translated) => {
          if (!translated) return
          const next = maxLen ? translated.slice(0, maxLen) : translated
          setArabic((prev) => {
            if (prev && prev !== lastAuto.current) return prev
            lastAuto.current = next
            return next
          })
        })
        .catch(() => {
          // Offline / providers down — leave the Arabic field for manual entry.
        })
    }, 400)
  }
}
