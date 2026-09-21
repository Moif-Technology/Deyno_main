import FloorTableMark from './FloorTableMark'
import { argbToCss, type PctPoint } from './floorGeometry'

export type FloorShapeView = {
  shapeType: string
  posXPercent: number
  posYPercent: number
  widthPercent: number
  heightPercent: number
  backColorArgb?: number | null
  displayText?: string
}

export type FloorTableView = {
  tableId: number
  tableName: string
  noOfChairs: number
  tableFormat: string
  posXPercent: number
  posYPercent: number
  widthPercent: number
  heightPercent: number
  occupied?: boolean
  pax?: number
  kotNo?: string
}

type Props = {
  border: PctPoint[]
  shapes: FloorShapeView[]
  tables: FloorTableView[]
  selectedTableId?: number
  onTableClick?: (tableId: number) => void
}

function shapeFallback(type: string) {
  const t = type.toUpperCase()
  if (t === 'LABEL') return '#FFFFE0'
  if (t === 'WALL') return '#9CA3AF'
  return '#E5E7EB'
}

/** TableFloorRuntimeFrm — saved percent layout, click tables. */
export default function FloorRuntimeCanvas({ border, shapes, tables, selectedTableId, onTableClick }: Props) {
  const poly = border.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <div className="pd-fd-canvas is-runtime">
      <svg className="pd-fd-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {border.length >= 3 ? (
          <polygon points={poly} className="pd-fd-poly is-closed" />
        ) : border.length >= 2 ? (
          <polyline points={poly} className="pd-fd-line" />
        ) : null}
      </svg>
      {shapes.map((s, i) => {
        const type = String(s.shapeType || 'ZONE').toUpperCase()
        const bg = argbToCss(s.backColorArgb, shapeFallback(type))
        return (
          <div
            key={`sh-${i}`}
            className={`pd-fd-shape is-${type.toLowerCase()}`}
            style={{
              left: `${s.posXPercent}%`,
              top: `${s.posYPercent}%`,
              width: `${Math.max(s.widthPercent, 0.8)}%`,
              height: `${Math.max(s.heightPercent, 0.8)}%`,
              background: bg,
            }}
          >
            {s.displayText ? <span>{s.displayText}</span> : null}
          </div>
        )
      })}
      {tables.map((t) => (
        <button
          key={t.tableId}
          type="button"
          className={`pd-fd-table is-pick${t.occupied ? ' is-busy' : ' is-free'}${selectedTableId === t.tableId ? ' is-on' : ''}`}
          style={{
            left: `${t.posXPercent}%`,
            top: `${t.posYPercent}%`,
            width: `${Math.max(t.widthPercent, 4)}%`,
            height: `${Math.max(t.heightPercent, 4)}%`,
          }}
          onClick={() => onTableClick?.(t.tableId)}
        >
          <FloorTableMark
            name={t.tableName}
            chairs={t.noOfChairs}
            format={t.tableFormat}
            busy={t.occupied}
            kotNo={t.kotNo}
            pax={t.pax}
            compact
            showStatus
          />
        </button>
      ))}
    </div>
  )
}
