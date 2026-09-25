/**
 * Reusable branded date picker — a text-like field with a calendar icon
 * that opens a month-grid popover. Value/onChange speak plain ISO
 * (yyyy-mm-dd) strings so it drops into any form field that currently
 * holds a date as a string, no adapter needed.
 */
import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import './DatePicker.css'

export interface DatePickerProps {
  /** ISO yyyy-mm-dd, or '' for no selection. */
  value: string
  onChange: (isoDate: string) => void
  placeholder?: string
  /** ISO yyyy-mm-dd bounds — days outside this range render disabled. */
  min?: string
  max?: string
  disabled?: boolean
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatDate(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

function buildGrid(viewDate: Date): { date: Date; inMonth: boolean }[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: new Date(year, month, i - firstWeekday + 1), inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true })
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
  }
  return cells
}

export function DatePicker({ value, onChange, placeholder = 'Select date', min, max, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = fromISO(value)
  const [viewDate, setViewDate] = useState(() => selected ?? new Date())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setViewDate(selected ?? new Date())
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDocDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDocDown)
      window.removeEventListener('keydown', onKey)
    }
    // Only re-run when the popover opens/closes — re-syncing viewDate on
    // every keystroke elsewhere would fight the user's month navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const minDate = fromISO(min)
  const maxDate = fromISO(max)
  const today = new Date()
  const cells = buildGrid(viewDate)

  function isDisabled(d: Date) {
    if (minDate && d < stripTime(minDate)) return true
    if (maxDate && d > stripTime(maxDate)) return true
    return false
  }

  function pick(d: Date) {
    if (isDisabled(d)) return
    onChange(toISO(d))
    setOpen(false)
  }

  return (
    <div className="dp-root" ref={rootRef}>
      <button type="button" className="dp-field" disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <span className={selected ? 'dp-field-value' : 'dp-field-placeholder'}>
          {selected ? formatDate(selected) : placeholder}
        </span>
        <Calendar size={14} />
      </button>

      {open ? (
        <div className="dp-pop" role="dialog" aria-modal="true">
          <div className="dp-pop-head">
            <button
              type="button"
              className="dp-nav"
              aria-label="Previous month"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="dp-pop-title">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              className="dp-nav"
              aria-label="Next month"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="dp-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="dp-grid">
            {cells.map(({ date, inMonth }, i) => {
              const dis = isDisabled(date)
              const isToday = isSameDay(date, today)
              const isSelected = selected != null && isSameDay(date, selected)
              return (
                <button
                  key={i}
                  type="button"
                  className={`dp-day${inMonth ? '' : ' is-muted'}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                  disabled={dis}
                  onClick={() => pick(date)}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="dp-pop-foot">
            <button type="button" className="dp-today-btn" onClick={() => pick(new Date())}>
              Today
            </button>
            {value ? (
              <button
                type="button"
                className="dp-clear-btn"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
