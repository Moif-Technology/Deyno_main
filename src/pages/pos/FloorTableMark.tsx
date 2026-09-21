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

function chairCounts(n: number) {
  const chairs = Math.max(0, Math.trunc(n))
  const base = Math.floor(chairs / 4)
  const rm = chairs % 4
  return {
    top: base + (rm > 0 ? 1 : 0),
    right: base + (rm > 1 ? 1 : 0),
    bottom: base + (rm > 2 ? 1 : 0),
    left: base,
  }
}

function ChairRow({ count, side }: { count: number; side: 'top' | 'right' | 'bottom' | 'left' }) {
  if (count <= 0) return null
  const vertical = side === 'left' || side === 'right'
  return (
    <span className={`pd-fd-chairs is-${side}${count === 1 ? ' is-one' : ''}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i key={`${side}-${i}`} className={`pd-fd-chair${vertical ? ' is-v' : ''}`} />
      ))}
    </span>
  )
}

function PaxMark() {
  return (
    <svg viewBox="0 0 16 16" className="pd-fd-pax-ico" aria-hidden>
      <circle cx="8" cy="5" r="2.4" fill="currentColor" />
      <path d="M3.2 13.2c.4-2.6 2.2-3.8 4.8-3.8s4.4 1.2 4.8 3.8" fill="currentColor" />
    </svg>
  )
}

/** TableSeatControl — table body + chairs by format. */
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
  const fmt = String(format || 'SQUARE').trim().toUpperCase()
  const shape =
    fmt === 'ROUND' ? 'round' : fmt === 'OVAL' ? 'oval' : fmt === 'RECTANGLE' ? 'rect' : 'square'
  const sides = chairCounts(chairs)
  const kot = String(kotNo ?? '').trim()
  const covers = Math.max(0, Math.trunc(pax ?? 0))
  return (
    <span className={`pd-fd-mark${busy ? ' is-busy' : ' is-free'}${compact ? ' is-compact' : ''}${showStatus ? ' is-live' : ''}`}>
      <span className={`pd-fd-cluster is-${shape}`}>
        <ChairRow count={sides.top} side="top" />
        <ChairRow count={sides.bottom} side="bottom" />
        <ChairRow count={sides.left} side="left" />
        <ChairRow count={sides.right} side="right" />
        <span className={`pd-fd-top is-${shape}`}>
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
      </span>
    </span>
  )
}
