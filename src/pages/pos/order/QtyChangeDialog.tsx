import { Hash, X } from 'lucide-react'
import { decimal } from '../../../utils/validate'
import { QtyScrollPicker, NumberKeypad } from '../main/posWidgets'
import { type PosCtx } from '../main/usePosMain'

export function QtyChangeDialog({ ctx }: { ctx: PosCtx }) {
  const {
    applyQtyChange, cancelQtyChange, onQtyChangeKey, qtyChangeLine, qtyChangeNew, qtyChangeOpen,
    qtyChangeRef, setQtyChangeNew,
  } = ctx
  return (
    <>
      {qtyChangeOpen && qtyChangeLine ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelQtyChange()
          }}
        >
          <div className="pd-qty-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-qty-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Hash size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Quantity Change</p>
                  <h2 id="pd-qty-title" className="pd-mod-item-name">
                    {qtyChangeLine.item}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={cancelQtyChange} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields">
                <div className="pd-qty-picker-wrap">
                  <span className="pd-qty-picker-label">New Qty</span>
                  <QtyScrollPicker
                    value={Math.max(1, Math.round(Number(qtyChangeNew) || qtyChangeLine.qty || 1))}
                    onChange={(n) => setQtyChangeNew(String(n))}
                  />
                  <input
                    ref={qtyChangeRef}
                    className="pd-visually-hidden-input"
                    value={qtyChangeNew}
                    onChange={(e) => setQtyChangeNew(decimal(e.target.value).slice(0, 8))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyQtyChange()
                      if (e.key === 'Escape') cancelQtyChange()
                    }}
                    inputMode="none"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
                <div className="pd-qty-row">
                  <span>Current Qty</span>
                  <strong>{qtyChangeLine.qty}</strong>
                </div>
              </div>
              <div className="pd-qty-pad">
                <NumberKeypad className="pd-qty-keys" onKey={onQtyChangeKey} />
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={applyQtyChange}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={cancelQtyChange}>
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
