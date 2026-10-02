import { type ComponentType, useRef, useState, useEffect } from 'react'
import { uiZoom } from '../../../utils/useUiZoom'
import { ChevronRight } from 'lucide-react'
import { KEYS, QTY_PICKER_ROW_HEIGHT } from './posHelpers'
import { type NavMenuEntry } from './posTypes'

export function BtnIcon({
  icon: Icon,
  size = 14,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  size?: number
}) {
  return (
    <span className="pd-btn-ic" aria-hidden>
      <Icon size={size} strokeWidth={2.2} />
    </span>
  )
}

/** Shared 7-8-9 / 4-5-6 / 1-2-3 / C-0-. keypad — reused by the main entry pad
 * and every qty/price/discount change dialog. */
export function NumberKeypad({
  className = 'pd-keys',
  onKey,
}: {
  className?: string
  onKey: (k: string) => void
}) {
  return (
    <div className={className}>
      {KEYS.map((k) => (
        <button key={k} type="button" className="pd-key" onClick={() => onKey(k)}>
          {k}
        </button>
      ))}
    </div>
  )
}

/** Vertical scroll-wheel style picker (drag or mouse-wheel to change the
 * value) — sits alongside the keypad so the same value can be typed too. */
export function QtyScrollPicker({
  value,
  onChange,
  min = 1,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
}) {
  const dragRef = useRef<{ pointerId: number; startY: number; startValue: number } | null>(null)
  const isDraggingRef = useRef(false)
  const prevValueRef = useRef(value)
  const [trackY, setTrackY] = useState(0)
  const [animate, setAnimate] = useState(false)

  // Any value change that didn't come from an in-progress drag (wheel, click,
  // typing on the keypad) rolls the strip in from the row it came from
  // instead of just swapping the numbers in place.
  useEffect(() => {
    if (prevValueRef.current !== value && !isDraggingRef.current) {
      const from = (prevValueRef.current - value) * QTY_PICKER_ROW_HEIGHT
      setAnimate(false)
      setTrackY(from)
      const raf = requestAnimationFrame(() => {
        setAnimate(true)
        setTrackY(0)
      })
      prevValueRef.current = value
      return () => cancelAnimationFrame(raf)
    }
    prevValueRef.current = value
  }, [value])

  function commit(n: number) {
    if (n !== value) onChange(Math.max(min, n))
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    commit(value + (e.deltaY > 0 ? 1 : -1))
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    isDraggingRef.current = true
    setAnimate(false)
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, startValue: value }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const rawPx = (drag.startY - e.clientY) / uiZoom()
    const steps = Math.round(rawPx / QTY_PICKER_ROW_HEIGHT)
    setTrackY(-(rawPx - steps * QTY_PICKER_ROW_HEIGHT))
    commit(drag.startValue + steps)
  }

  function onPointerUp() {
    dragRef.current = null
    isDraggingRef.current = false
    setAnimate(true)
    setTrackY(0)
  }

  return (
    <div
      className="pd-qty-picker"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="pd-qty-picker-highlight" aria-hidden />
      <div
        className={`pd-qty-picker-track${animate ? ' is-settling' : ''}`}
        style={{ transform: `translateY(${trackY}px)` }}
      >
        {[-2, -1, 0, 1, 2].map((offset) => {
          const n = value + offset
          const isCurrent = offset === 0
          return (
            <button
              key={offset}
              type="button"
              className={`pd-qty-picker-row${isCurrent ? ' is-current' : ''} pd-qty-picker-row-d${Math.abs(offset)}`}
              style={n < min ? { visibility: 'hidden' } : undefined}
              tabIndex={-1}
              onClick={() => commit(n)}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Renders a nav item's submenu inline (accordion-style, indented under its
 * parent) instead of a flyout — entries with `children` expand/collapse in
 * place, tracked by a path string ("Reports/Reports A4/…") so each nesting
 * level opens independently. */
export function NavMenuInline({
  entries,
  path,
  depth,
  expanded,
  onToggle,
  onPick,
}: {
  entries: readonly NavMenuEntry[]
  path: string
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  onPick: (label: string, path: string) => void
}) {
  return (
    <>
      {entries.map((entry) => {
        const label = typeof entry === 'string' ? entry : entry.label
        const hasChildren = typeof entry !== 'string' && 'children' in entry
        const itemPath = `${path}/${label}`
        const isOpen = hasChildren && expanded.has(itemPath)
          return (
          <div key={itemPath} className="pd-subnav-item">
            <button
              type="button"
              className={`pd-subnav-btn${isOpen ? ' is-open' : ''}`}
              style={{ paddingLeft: 14 + depth * 14 }}
              onClick={() => (hasChildren ? onToggle(itemPath) : onPick(label, itemPath))}
            >
              <span>{label}</span>
              {hasChildren ? (
                <ChevronRight size={12} className="pd-subnav-arrow" />
              ) : null}
            </button>
            {hasChildren && isOpen ? (
              <NavMenuInline
                entries={(entry as { children: readonly NavMenuEntry[] }).children}
                path={itemPath}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onPick={onPick}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

/** SF Symbol-like dining table (top-down, four seats). */
/** SF Symbol-like side chair. */
export function ChairGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="16" y="6" width="14" height="34" rx="7" fill="currentColor" />
      <rect x="16" y="28" width="34" height="12" rx="6" fill="currentColor" />
      <rect x="16" y="38" width="7" height="20" rx="3.5" fill="currentColor" />
      <rect x="42" y="38" width="7" height="20" rx="3.5" fill="currentColor" />
      <rect x="20" y="31" width="26" height="6" rx="3" fill="#fff" opacity="0.35" />
    </svg>
  )
}
