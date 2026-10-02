import { Percent, Tag, SlidersHorizontal, MapPinned } from 'lucide-react'
import { type CSSProperties } from 'react'
import { BtnIcon } from '../main/posWidgets'
import { type PosCtx } from '../main/usePosMain'

export function RowMenu({ ctx }: { ctx: PosCtx }) {
  const {
    openLineDiscount, openMovePicker, openPriceChange, openQtyChange, rowMenu,
  } = ctx
  return (
    <>
      {rowMenu ? (
        <div
          className="pd-radial-menu"
          style={{ left: rowMenu.x, top: rowMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pd-radial-backdrop" aria-hidden />
          <div className="pd-radial-center" aria-hidden />
          {(
            [
              { label: 'Add\nDiscount', icon: Percent, angle: -90, onClick: () => openLineDiscount(rowMenu.key) },
              { label: 'Edit\nPrice', icon: Tag, angle: 0, onClick: () => openPriceChange(rowMenu.key, true) },
              { label: 'Edit\nQty', icon: SlidersHorizontal, angle: 90, onClick: () => openQtyChange(rowMenu.key) },
              { label: 'Move\nItem', icon: MapPinned, angle: 180, onClick: () => openMovePicker(rowMenu.key) },
            ] as const
          ).map(({ label, icon, angle, onClick }, i) => {
            const radius = 74
            const rad = (angle * Math.PI) / 180
            const tx = Math.round(Math.cos(rad) * radius)
            const ty = Math.round(Math.sin(rad) * radius)
            return (
              <button
                key={label}
                type="button"
                className="pd-radial-btn"
                style={
                  {
                    '--tx': `${tx}px`,
                    '--ty': `${ty}px`,
                    animationDelay: `${i * 0.09}s`,
                  } as CSSProperties
                }
                onClick={onClick}
              >
                <BtnIcon icon={icon} />
                {label.split('\n').map((ln) => (
                  <span key={ln}>{ln}</span>
                ))}
              </button>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
