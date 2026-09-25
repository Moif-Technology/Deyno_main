/**
 * Scales the whole POS screen from its 1280×1024 reference layout so larger
 * displays show the same design bigger (text, buttons, panels all together)
 * instead of stretching only the grids while text stays small.
 *
 * The factor is the geometric mean of the width and height ratios, floored at
 * 1 (smaller screens keep their own fitted layout rather than shrinking text)
 * and capped so the scaled-down "virtual" height never drops below 860px,
 * where the short-screen rules would start kicking in.
 *
 * It sets `zoom` on <html> plus a `--ui-zoom` custom property; every vh/vw in
 * the stylesheets divides by `--ui-zoom`, so viewport-sized boxes still fit
 * the real window after zooming. Popups that position themselves from
 * getBoundingClientRect / mouse coordinates should divide by `uiZoom()`.
 */
import { useEffect } from 'react'

const REF_W = 1280
const REF_H = 1024
const MIN_VIRTUAL_H = 860

export function computeUiZoom(w: number, h: number) {
  const byArea = Math.sqrt((w / REF_W) * (h / REF_H))
  const byHeight = h / MIN_VIRTUAL_H
  const z = Math.min(byArea, byHeight)
  return z > 1 ? Math.round(z * 1000) / 1000 : 1
}

/** Current zoom factor (1 when not zoomed). */
export function uiZoom() {
  const v = Number(document.documentElement.style.getPropertyValue('--ui-zoom'))
  return Number.isFinite(v) && v > 0 ? v : 1
}

export function useUiZoom() {
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const z = computeUiZoom(window.innerWidth, window.innerHeight)
      root.style.setProperty('--ui-zoom', String(z))
      root.style.zoom = z === 1 ? '' : String(z)
      // Media queries see the real window, not the zoomed layout, so wide-
      // screen rules key off these classes (virtual width) instead.
      const vw = window.innerWidth / z
      root.classList.toggle('ui-w1600', vw >= 1600)
      root.classList.toggle('ui-w1800', vw >= 1800)
    }
    apply()
    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
      root.style.removeProperty('--ui-zoom')
      root.style.zoom = ''
      root.classList.remove('ui-w1600', 'ui-w1800')
    }
  }, [])
}
