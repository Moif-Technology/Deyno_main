import { useId } from 'react'
import { Chair, chairScale, seatsFor, TableTop, toTableShape } from './TableShapePicker'

type Props = {
  name: string
  chairs: number
  format: string
  busy?: boolean
  compact?: boolean
  kotNo?: string
  pax?: number
  showStatus?: boolean
}

function PaxMark() {
  return (
    <svg viewBox="0 0 16 16" className="pd-fd-pax-ico" aria-hidden>
      <circle cx="8" cy="5" r="2.4" fill="currentColor" />
      <path d="M3.2 13.2c.4-2.6 2.2-3.8 4.8-3.8s4.4 1.2 4.8 3.8" fill="currentColor" />
    </svg>
  )
}

/** TableSeatControl — table body + chairs by format, drawn like Table Entry's preview. */
export default function FloorTableMark({
  name,
  chairs,
  format,
  busy,
  compact,
  kotNo,
  pax,
  showStatus,
}: Props) {
  // Same top-down drawing as Table Entry (TableShapePicker).
  const shape = toTableShape(format)
  const spots = seatsFor(shape, Math.min(16, Math.max(0, Math.trunc(chairs))))
  const scale = chairScale(spots)
  const gradId = `fd-top-${useId().replace(/:/g, '')}`
  const kot = String(kotNo ?? '').trim()
  const covers = Math.max(0, Math.trunc(pax ?? 0))
  return (
    <span className={`pd-fd-mark${busy ? ' is-busy' : ' is-free'}${compact ? ' is-compact' : ''}${showStatus ? ' is-live' : ''}`}>
      <svg viewBox="0 0 200 200" className="pd-fd-table-svg" aria-hidden>
        <defs>
          <radialGradient id={gradId} cx="40%" cy="35%" r="75%">
            <stop offset="0%" className="pd-fd-top-hi" />
            <stop offset="100%" className="pd-fd-top-lo" />
          </radialGradient>
        </defs>
        {spots.map((s, i) => (
          <Chair key={i} seat={s} scale={scale} className="pd-fd-chair" />
        ))}
        <g className="pd-fd-top">
          <TableTop shape={shape} fill={`url(#${gradId})`} />
        </g>
      </svg>
      <span className="pd-fd-face">
        <strong className="pd-fd-name">{name}</strong>
        {showStatus && busy ? (
          <span className="pd-fd-tags">
            {kot ? (
              <b className="pd-fd-kot" title="KOT">
                {kot}
              </b>
            ) : null}
            <b className="pd-fd-pax" title="No. of customers">
              <PaxMark />
              {covers}
            </b>
          </span>
        ) : null}
        {showStatus && !busy ? <em className="pd-fd-free">Free</em> : null}
      </span>
    </span>
  )
}
