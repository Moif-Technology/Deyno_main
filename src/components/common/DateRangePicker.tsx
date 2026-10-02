/**
 * Reusable From–To date range picker. One field shows the range; it opens a
 * small popover: quick chips (Today / This Week / This Month / This Year), a
 * month calendar that highlights the range (tap first day, then last day) and
 * Cancel / Apply. Values are plain ISO (yyyy-mm-dd) strings, like DatePicker.
 *
 * The popover is portalled to <body> (fixed position) so dialogs with
 * overflow: hidden don't clip it.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { uiZoom } from '../../utils/useUiZoom'
import './DateRangePicker.css'

export interface DateRangePickerProps {
  /** ISO yyyy-mm-dd, or '' when not set. */
  from: string
  to: string
  onChange: (from: string, to: string) => void
  placeholder?: string
  disabled?: boolean
  /** Hide the quick chips (Today / This Week / …). */
  hidePresets?: boolean
}

type Preset = { label: string; range: () => [Date, Date] }

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))
const POP_W = 360

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function fromISO(iso: string | undefined): Date | null {
  if (!iso) return null
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

function day(y: number, m: number, d: number) {
  return new Date(y, m, d)
}

function sameDay(a: Date | null, b: Date | null) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fieldFmt(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

function longFmt(d: Date) {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/** Monday of the week containing `d`. */
function weekStart(d: Date) {
  const offset = (d.getDay() + 6) % 7
  return day(d.getFullYear(), d.getMonth(), d.getDate() - offset)
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

const PRESETS: Preset[] = [
  { label: 'Today', range: () => { const t = new Date(); return [t, t] } },
  {
    label: 'This Week',
    range: () => {
      const s = weekStart(new Date())
      return [s, day(s.getFullYear(), s.getMonth(), s.getDate() + 6)]
    },
  },
  {
    label: 'This Month',
    range: () => {
      const t = new Date()
      return [day(t.getFullYear(), t.getMonth(), 1), day(t.getFullYear(), t.getMonth() + 1, 0)]
    },
  },
  {
    label: 'This Year',
    range: () => {
      const y = new Date().getFullYear()
      return [day(y, 0, 1), day(y, 11, 31)]
    },
  },
]

/** 6-week grid for the month of `view`, weeks starting Monday. */
function buildGrid(view: Date) {
  const y = view.getFullYear()
  const m = view.getMonth()
  const lead = (day(y, m, 1).getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const date = day(y, m, i - lead + 1)
    return { date, inMonth: date.getMonth() === m }
  })
}

type Pos = { left: number; top?: number; bottom?: number; width: number }

export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Select date range',
  disabled,
  hidePresets,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [start, setStart] = useState<Date | null>(null)
  const [end, setEnd] = useState<Date | null>(null)
  const [editing, setEditing] = useState<'start' | 'end'>('start')
  const [hover, setHover] = useState<Date | null>(null)
  const [view, setView] = useState(() => fromISO(from) ?? new Date())
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  const fromDate = fromISO(from)
  const toDate = fromISO(to)

  function place() {
    const el = triggerRef.current
    if (!el) return
    // Rects are in on-screen px; the popover's own px get multiplied by the
    // page zoom, so convert back into CSS px (same as SearchSelect).
    const z = uiZoom()
    const rr = el.getBoundingClientRect()
    const vw = window.innerWidth / z
    const vh = window.innerHeight / z
    const r = { left: rr.left / z, top: rr.top / z, bottom: rr.bottom / z }
    const width = Math.min(POP_W, vw - 16)
    const left = Math.max(8, Math.min(r.left, vw - width - 8))
    const below = vh - r.bottom - 12
    const above = r.top - 12
    const openUp = below < 340 && above > below
    setPos(openUp ? { left, width, bottom: vh - r.top + 6 } : { left, width, top: r.bottom + 6 })
  }

  function openPop() {
    if (disabled) return
    setStart(fromDate)
    setEnd(toDate)
    setEditing(fromDate && !toDate ? 'end' : 'start')
    setHover(null)
    setView(fromDate ?? new Date())
    place()
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    const onMove = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return
      place()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the calendar on the month being edited.
  useEffect(() => {
    if (!open) return
    const focus = editing === 'end' ? end ?? start : start
    if (focus) setView(day(focus.getFullYear(), focus.getMonth(), 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  function pickDay(d: Date) {
    if (editing === 'start' || !start) {
      setStart(d)
      if (end && d > end) setEnd(null)
      setEditing('end')
      return
    }
    if (d < start) {
      // Earlier than the start: that becomes the new start, still waiting for an end.
      setStart(d)
      setEnd(null)
      return
    }
    setEnd(d)
    setEditing('start')
  }

  function pickPreset(p: Preset) {
    const [s, e] = p.range()
    setStart(s)
    setEnd(e)
    setEditing('start')
    setView(day(s.getFullYear(), s.getMonth(), 1))
  }

  function apply() {
    if (!start || !end) return
    onChange(toISO(start), toISO(end))
    setOpen(false)
  }

  const activePreset = start && end
    ? PRESETS.find((p) => {
        const [s, e] = p.range()
        return sameDay(s, start) && sameDay(e, end)
      })?.label
    : undefined

  // Range shown on the grid: the committed end, or the hovered day while choosing one.
  const rangeEnd = end ?? (start && hover && hover >= start ? hover : null)
  const cells = buildGrid(view)
  const today = new Date()

  return (
    <div className="drp-root">
      <button
        ref={triggerRef}
        type="button"
        className={`drp-field${open ? ' is-open' : ''}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPop())}
      >
        <Calendar size={14} />
        {fromDate && toDate ? (
          <span className="drp-field-value">
            {fieldFmt(fromDate)} <i>→</i> {fieldFmt(toDate)}
          </span>
        ) : (
          <span className="drp-field-placeholder">{placeholder}</span>
        )}
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="drp-pop"
              role="dialog"
              aria-label="Choose date range"
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
            >
              {hidePresets ? null : (
                <div className="drp-presets" role="listbox" aria-label="Quick ranges">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      role="option"
                      aria-selected={activePreset === p.label}
                      className={`drp-preset${activePreset === p.label ? ' is-on' : ''}`}
                      onClick={() => pickPreset(p)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="drp-cal">
                <div className="drp-cal-head">
                  <button
                    type="button"
                    className="drp-nav"
                    aria-label="Previous month"
                    onClick={() => setView((v) => day(v.getFullYear(), v.getMonth() - 1, 1))}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="drp-cal-title">
                    {MONTHS[view.getMonth()]} {view.getFullYear()}
                  </span>
                  <button
                    type="button"
                    className="drp-nav"
                    aria-label="Next month"
                    onClick={() => setView((v) => day(v.getFullYear(), v.getMonth() + 1, 1))}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
                <div className="drp-weekdays">
                  {WEEKDAYS.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="drp-grid" onMouseLeave={() => setHover(null)}>
                  {cells.map(({ date, inMonth }, i) => {
                    const isStart = sameDay(date, start)
                    const isEnd = sameDay(date, rangeEnd)
                    const inRange = !!start && !!rangeEnd && date > start && date < rangeEnd
                    const col = i % 7
                    const cls = [
                      'drp-day',
                      inMonth ? '' : 'is-muted',
                      sameDay(date, today) ? 'is-today' : '',
                      inRange ? 'is-in' : '',
                      isStart ? 'is-start' : '',
                      isEnd ? 'is-end' : '',
                      isStart && rangeEnd && !sameDay(start, rangeEnd) ? 'has-after' : '',
                      isEnd && start && !sameDay(start, rangeEnd) ? 'has-before' : '',
                      col === 0 ? 'is-row-first' : '',
                      col === 6 ? 'is-row-last' : '',
                    ].filter(Boolean).join(' ')
                    return (
                      <button
                        key={i}
                        type="button"
                        className={cls}
                        onMouseEnter={() => setHover(date)}
                        onClick={() => pickDay(date)}
                      >
                        <span>{date.getDate()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="drp-foot">
                <span className="drp-summary">
                  {start && end ? (
                    <>
                      <b>{longFmt(start)} – {longFmt(end)}</b>
                      <small>
                        {daysBetween(start, end)} day{daysBetween(start, end) === 1 ? '' : 's'}
                      </small>
                    </>
                  ) : start ? (
                    <small>Now tap the last day</small>
                  ) : (
                    <small>Tap the first day</small>
                  )}
                </span>
                <button type="button" className="drp-btn" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="drp-btn is-ok" onClick={apply} disabled={!start || !end}>
                  Apply
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export default DateRangePicker
