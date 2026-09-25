/**
 * Table Entry's right-hand panel: pick Round / Rectangle / Square and see a
 * top-down preview of the table with the entered number of chairs.
 */
import { Armchair, Check } from 'lucide-react'
import './TableShapePicker.css'

export type TableShape = 'ROUND' | 'RECTANGLE' | 'SQUARE'

const SHAPES: { id: TableShape; label: string }[] = [
  { id: 'ROUND', label: 'Round' },
  { id: 'RECTANGLE', label: 'Rectangle' },
  { id: 'SQUARE', label: 'Square' },
]

type Seat = { x: number; y: number; angle: number }

/** Spread `n` seats evenly along a straight edge from (x1,y1) to (x2,y2). */
function along(n: number, x1: number, y1: number, x2: number, y2: number, angle: number): Seat[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / (n + 1)
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, angle }
  })
}

/** Chair positions around the table. `angle` points the chair back outward. */
function seatsFor(shape: TableShape, chairs: number): Seat[] {
  const c = 100
  if (shape === 'ROUND') {
    return Array.from({ length: chairs }, (_, i) => {
      const a = (i / chairs) * Math.PI * 2 - Math.PI / 2
      return { x: c + Math.cos(a) * 70, y: c + Math.sin(a) * 70, angle: (a * 180) / Math.PI + 90 }
    })
  }
  if (shape === 'RECTANGLE') {
    const ends = chairs >= 6 ? 2 : 0
    const top = Math.ceil((chairs - ends) / 2)
    const bottom = chairs - ends - top
    return [
      ...along(top, 30, c - 52, 170, c - 52, 0),
      ...along(bottom, 30, c + 52, 170, c + 52, 180),
      ...(ends ? [{ x: c - 92, y: c, angle: 270 }, { x: c + 92, y: c, angle: 90 }] : []),
    ]
  }
  // Square: deal chairs round the four sides.
  const perSide = [0, 0, 0, 0]
  for (let i = 0; i < chairs; i++) perSide[[0, 2, 3, 1][i % 4]]++
  return [
    ...along(perSide[0], c - 55, c - 68, c + 55, c - 68, 0),
    ...along(perSide[1], c + 68, c - 55, c + 68, c + 55, 90),
    ...along(perSide[2], c - 55, c + 68, c + 55, c + 68, 180),
    ...along(perSide[3], c - 68, c - 55, c - 68, c + 55, 270),
  ]
}

/** Shrink chairs when neighbours would overlap (a chair is ~34 units wide). */
function chairScale(seats: Seat[]) {
  let min = Infinity
  for (let i = 0; i < seats.length; i++)
    for (let j = i + 1; j < seats.length; j++)
      min = Math.min(min, Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y))
  return Math.max(0.5, Math.min(1, min / 36))
}

function Chair({ seat, scale }: { seat: Seat; scale: number }) {
  return (
    <g transform={`translate(${seat.x} ${seat.y}) rotate(${seat.angle}) scale(${scale})`}>
      {/* soft floor shadow */}
      <ellipse cx={0} cy={3} rx={16} ry={14} className="tsp-chair-shadow" />
      {/* seat */}
      <rect x={-13} y={-8} width={26} height={20} rx={8} className="tsp-chair-seat" />
      {/* cushion highlight */}
      <rect x={-9} y={-4} width={18} height={12} rx={5} className="tsp-chair-cushion" />
      {/* curved backrest wrapping the far edge of the seat */}
      <path d="M -16 -4 Q -16 -17 0 -17 Q 16 -17 16 -4 L 12 -4 Q 12 -11 0 -11 Q -12 -11 -12 -4 Z" className="tsp-chair-back" />
    </g>
  )
}

export function TableSvg({ shape, chairs, plant = false }: { shape: TableShape; chairs: number; plant?: boolean }) {
  const seats = seatsFor(shape, chairs)
  const scale = chairScale(seats)
  return (
    <svg viewBox="0 0 200 200" className="tsp-svg" aria-hidden>
      <defs>
        <radialGradient id={`tsp-top-${shape}`} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="var(--brand-light)" />
          <stop offset="100%" stopColor="var(--brand)" />
        </radialGradient>
      </defs>
      {seats.map((s, i) => (
        <Chair key={i} seat={s} scale={scale} />
      ))}
      <g className="tsp-table">
        {shape === 'ROUND' ? (
          <circle cx={100} cy={100} r={50} fill={`url(#tsp-top-${shape})`} />
        ) : shape === 'RECTANGLE' ? (
          <rect x={22} y={60} width={156} height={80} rx={10} fill={`url(#tsp-top-${shape})`} />
        ) : (
          <rect x={45} y={45} width={110} height={110} rx={10} fill={`url(#tsp-top-${shape})`} />
        )}
      </g>
      {plant ? (
        <g className="tsp-plant" transform="translate(100 100)">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx={0} cy={-9} rx={4} ry={9} transform={`rotate(${a})`} />
          ))}
          <circle r={3.5} className="tsp-plant-core" />
        </g>
      ) : null}
    </svg>
  )
}

type Props = {
  value: string
  onChange: (shape: TableShape) => void
  chairs: number
}

export function TableShapePicker({ value, onChange, chairs }: Props) {
  const shape: TableShape = SHAPES.some((s) => s.id === value) ? (value as TableShape) : 'SQUARE'
  const seatCount = Math.min(Math.max(chairs || 4, 1), 16)
  const label = SHAPES.find((s) => s.id === shape)!.label

  return (
    <section className="tsp" aria-label="Table shape">
      <header className="tsp-head">
        <div>
          <h3>Choose Table Shape</h3>
          <p>Select the shape and see the preview below.</p>
        </div>
      </header>

      <div className="tsp-options" role="radiogroup" aria-label="Table shape">
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={shape === s.id}
            className={`tsp-option${shape === s.id ? ' is-on' : ''}`}
            onClick={() => onChange(s.id)}
          >
            {shape === s.id ? (
              <span className="tsp-check">
                <Check size={11} strokeWidth={3} />
              </span>
            ) : null}
            <TableSvg shape={s.id} chairs={s.id === 'ROUND' ? 6 : s.id === 'RECTANGLE' ? 6 : 4} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="tsp-preview">
        <span className="tsp-badge">
          <i /> {label} Table
        </span>
        <span className="tsp-count">
          <Armchair size={16} />
          <b>{seatCount}</b>
          <small>Chairs</small>
        </span>
        <TableSvg shape={shape} chairs={seatCount} plant />
      </div>
    </section>
  )
}

export default TableShapePicker
