/**
 * Reusable "table" tile for floor/table pickers. Status-driven (free / occupied /
 * reserved) so any screen that needs to show a dining table renders the same card.
 * Seats render as small chair dots above/below the card — tapping one selects
 * that exact chair; tapping the card body falls back to the caller's default
 * (usually auto-assign the first free chair).
 */
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
  status: TableCardStatus
  orderNo?: string | number
  pax?: number
  selected?: boolean
  onClick?: () => void
  /** Chair numbers (1-based) currently occupied at this table. */
  occupiedChairs?: number[]
  /** Called instead of onClick when a specific chair dot is tapped. */
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

function ChairDots({
  chairs,
  occupiedChairs,
  position,
  onChairSelect,
}: {
  chairs: number[]
  occupiedChairs: number[]
  position: 'top' | 'bottom'
  onChairSelect?: (chair: number) => void
}) {
  if (chairs.length === 0) return null
  return (
    <div className={`tc-chairs tc-chairs-${position}`}>
      {chairs.map((n) => (
        <button
          key={n}
          type="button"
          className={`tc-chair${occupiedChairs.includes(n) ? ' is-occupied' : ''}`}
          aria-label={`Chair ${n}`}
          onClick={(e) => {
            e.stopPropagation()
            onChairSelect?.(n)
          }}
        />
      ))}
    </div>
  )
}

export function TableCard({
  label,
  seats = 0,
  status,
  orderNo,
  pax,
  selected = false,
  onClick,
  occupiedChairs = [],
  onChairSelect,
}: TableCardProps) {
  const safeSeats = Number.isFinite(seats) ? Math.max(0, Math.min(20, Math.floor(seats))) : 0
  const chairs = Array.from({ length: safeSeats }, (_, i) => i + 1)
  const topChairs = chairs.slice(0, Math.ceil(chairs.length / 2))
  const bottomChairs = chairs.slice(Math.ceil(chairs.length / 2))

  return (
    <div className={`tc-card is-${status}${selected ? ' is-selected' : ''}`}>
      <ChairDots chairs={topChairs} occupiedChairs={occupiedChairs} position="top" onChairSelect={onChairSelect} />
      <button type="button" className="tc-body" onClick={onClick}>
        {pax != null && pax > 0 ? <em className="tc-pax">{pax}</em> : null}
        <span className="tc-label">{label}</span>
        <span className="tc-meta">
          {status === 'occupied' ? (
            <span className="tc-order">{orderNo ?? 'Occupied'}</span>
          ) : (
            <span className="tc-status">{STATUS_LABEL[status]}</span>
          )}
        </span>
      </button>
      <ChairDots
        chairs={bottomChairs}
        occupiedChairs={occupiedChairs}
        position="bottom"
        onChairSelect={onChairSelect}
      />
    </div>
  )
}
