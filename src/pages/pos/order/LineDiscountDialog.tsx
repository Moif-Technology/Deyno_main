import { Percent, X } from 'lucide-react'
import { decimal } from '../../../utils/validate'
import { money } from '../main/posHelpers'
import { NumberKeypad } from '../main/posWidgets'
import { type PosCtx } from '../main/usePosMain'

export function LineDiscountDialog({ ctx }: { ctx: PosCtx }) {
  const {
    applyLineDiscount, cancelLineDiscount, discChangeLine, discChangeNew, discChangeOpen,
    discChangeRef, onDiscChangeKey, setDiscChangeNew,
  } = ctx
  return (
    <>
      {discChangeOpen && discChangeLine ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelLineDiscount()
          }}
        >
          <div className="pd-qty-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-disc-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Percent size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Line Discount</p>
                  <h2 id="pd-disc-title" className="pd-mod-item-name">
                    {discChangeLine.item}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={cancelLineDiscount} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields">
                <div className="pd-qty-row">
                  <span>Current Discount</span>
                  <strong>{money(discChangeLine.disc)}</strong>
                </div>
                  <div className="pd-qty-row">
                  <span>New Discount</span>
                    <input
                    ref={discChangeRef}
                    className="pd-qty-input"
                    value={discChangeNew}
                    onChange={(e) => setDiscChangeNew(decimal(e.target.value).slice(0, 10))}
                      onKeyDown={(e) => {
                      if (e.key === 'Enter') applyLineDiscount()
                      if (e.key === 'Escape') cancelLineDiscount()
                      }}
                      inputMode="none"
                    placeholder="Enter discount…"
                    />
                  </div>
              </div>
              <div className="pd-qty-pad">
                <NumberKeypad className="pd-qty-keys" onKey={onDiscChangeKey} />
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={applyLineDiscount}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={cancelLineDiscount}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
