/**
 * Reusable "table" tile for floor/table pickers. Status-driven (free / occupied /
 * reserved) so any screen that needs to show a dining table renders the same card.
 * Drawn top-down like Table Entry's shape preview: a Round / Rectangle / Square
 * table with its chairs around it — tapping a chair selects that exact chair;
 * tapping the table falls back to the caller's default (usually auto-assign the
 * first free chair).
 */
import { useId } from 'react'
import { Chair, chairScale, seatsFor, TableTop, toTableShape } from '../../pages/pos/TableShapePicker'
import './TableCard.css'

export type TableCardStatus = 'free' | 'occupied' | 'reserved'

const STATUS_LABEL: Record<TableCardStatus, string> = {
  free: 'Vacant',
  occupied: 'Occupied',
  reserved: 'Reserved',
}

export interface TableCardProps {
  label: string
  seats?: number
  /** Table Entry format: ROUND / RECTANGLE / SQUARE / OVAL / HEXAGON / OCTAGON (anything else → SQUARE). */
  shape?: string
  status: TableCardStatus
  orderNo?: string | number
  pax?: number
  selected?: boolean
  onClick?: () => void
  /** Chair numbers (1-based) currently occupied at this table. */
  occupiedChairs?: number[]
  /** Called instead of onClick when a specific chair is tapped. */
  onChairSelect?: (chair: number) => void
}

/** Top-down round table, four legs. Still used standalone (e.g. header pill icon). */
export function TableGlyph({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="22" y="3" width="20" height="11" rx="5.5" fill="currentColor" opacity="0.92" />
      <rect x="22" y="50" width="20" height="11" rx="5.5" fill="currentColor" opacity="0.92" />
      <rect x="3" y="22" width="11" height="20" rx="5.5" fill="currentColor" opacity="0.92" />
      <rect x="50" y="22" width="11" height="20" rx="5.5" fill="currentColor" opacity="0.92" />
      <circle cx="32" cy="32" r="16.5" fill="currentColor" />
      <circle cx="32" cy="32" r="11" fill="none" stroke="#fff" strokeWidth="2.4" opacity="0.55" />
      <circle cx="32" cy="32" r="3.2" fill="#fff" opacity="0.7" />
    </svg>
  )
}

export function TableCard({
  label,
  seats = 0,
  shape: format,
  status,
  orderNo,
  pax,
  selected = false,
  onClick,
  occupiedChairs = [],
  onChairSelect,
}: TableCardProps) {
  const gradId = `tc-top-${useId().replace(/:/g, '')}`
  const shape = toTableShape(format)
  const safeSeats = Number.isFinite(seats) ? Math.max(0, Math.min(16, Math.floor(seats))) : 0
  const spots = seatsFor(shape, safeSeats)
  const scale = chairScale(spots)

  return (
    <div className={`tc-card is-${status}${selected ? ' is-selected' : ''}`}>
      <svg viewBox="0 0 200 200" className="tc-svg" aria-hidden>
        <defs>
          <radialGradient id={gradId} cx="40%" cy="35%" r="75%">
            <stop offset="0%" className="tc-top-hi" />
            <stop offset="100%" className="tc-top-lo" />
          </radialGradient>
        </defs>
        {spots.map((s, i) => {
          const n = i + 1
          return (
            <Chair
              key={n}
              seat={s}
              scale={scale}
              title={`Chair ${n}`}
              className={`tc-chair${occupiedChairs.includes(n) ? ' is-occupied' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onChairSelect?.(n)
              }}
            />
          )
        })}
        <g className="tc-top" onClick={onClick}>
          <TableTop shape={shape} fill={`url(#${gradId})`} />
        </g>
      </svg>
      <button type="button" className="tc-center" onClick={onClick}>
        <span className="tc-label">{label}</span>
        {status === 'occupied' ? (
          <span className="tc-order">{orderNo ?? 'Occupied'}</span>
        ) : (
          <span className="tc-status">{STATUS_LABEL[status]}</span>
        )}
      </button>
      {pax != null && pax > 0 ? <em className="tc-pax">{pax}</em> : null}
    </div>
  )
}
