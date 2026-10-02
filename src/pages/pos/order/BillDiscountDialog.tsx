import { Percent, X } from 'lucide-react'
import { money, KEYS } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function BillDiscountDialog({ ctx }: { ctx: PosCtx }) {
  const {
    applyDiscountDone, closeDiscountDialog, discBillAllowed, discButtons, discModeOn, discNet,
    discTax, discTaxLabel, discTaxable, discountAmount, discountAmountRef, discountBase,
    discountError, discountFocus, discountMode, discountOpen, discountPercent, discountPercentRef,
    onDiscountAmountChange, onDiscountPadKey, onDiscountPercentChange, savingKot, selectDiscountMode,
    setDiscountFocus,
  } = ctx
  return (
    <>
      {discountOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDiscountDialog()
          }}
        >
          <div className="pd-price-dialog pd-disc-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-disc-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Percent size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Discount</p>
                  <h2 id="pd-disc-title" className="pd-mod-item-name">
                    {discModeOn ? (discountMode === 2 ? 'On Item' : 'On Bill') : 'Select Discount Mode First'}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeDiscountDialog} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-price-body">
              <div className="pd-price-fields">
                <div className="pd-disc-modes">
                  <button
                    type="button"
                    className={`pd-disc-mode${discountMode === 2 ? ' is-on' : ''}`}
                    onClick={() => selectDiscountMode(2)}
                  >
                    Discount On Item
                  </button>
                  <button
                    type="button"
                    className={`pd-disc-mode${discountMode === 0 ? ' is-on' : ''}${!discBillAllowed ? ' is-blocked' : ''}`}
                    disabled={!discBillAllowed}
                    onClick={() => selectDiscountMode(0)}
                  >
                    Discount On Bill
                  </button>
                </div>
                <div className="pd-qty-row">
                  <span>Sub Total</span>
                  <strong>{money(discountBase)}</strong>
                </div>
                {discountMode !== 2 ? (
                  <div className="pd-qty-row">
                    <span>{discModeOn ? 'Discount Amount' : 'Select Discount Mode First'}</span>
                    <input
                      ref={discountAmountRef}
                      className={`pd-qty-input${discountFocus === 'amount' ? ' is-focus' : ''}`}
                      value={discountAmount}
                      readOnly={!discModeOn}
                      disabled={!discModeOn}
                      onFocus={() => {
                        if (discModeOn && discountMode === 0) setDiscountFocus('amount')
                      }}
                      onChange={(e) => onDiscountAmountChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void applyDiscountDone()
                        if (e.key === 'Escape') closeDiscountDialog()
                      }}
                      inputMode="decimal"
                    />
                  </div>
                ) : null}
                <div className="pd-qty-row">
                  <span>{discountMode === 2 ? 'Item Disc %' : 'Disc Percentage'}</span>
                  <input
                    ref={discountPercentRef}
                    className={`pd-qty-input${discountFocus === 'percent' ? ' is-focus' : ''}`}
                    value={discountPercent}
                    disabled={!discModeOn}
                    onFocus={() => {
                      if (discModeOn) setDiscountFocus('percent')
                    }}
                    onChange={(e) => onDiscountPercentChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void applyDiscountDone()
                      if (e.key === 'Escape') closeDiscountDialog()
                    }}
                    inputMode="decimal"
                  />
                </div>
                <div className="pd-disc-quick">
                  {discButtons.map((pct, i) => (
                    <button
                      key={`dsc-${i}-${pct}`}
                      type="button"
                      className="pd-disc-pct"
                      disabled={!discModeOn}
                      onClick={() => onDiscountPercentChange(String(pct))}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                {discountMode !== 2 ? (
                  <>
                    <div className="pd-qty-row">
                      <span>Taxable</span>
                      <strong>{money(discTaxable)}</strong>
                    </div>
                    <div className="pd-qty-row">
                      <span>{discTaxLabel}</span>
                      <strong>{money(discTax)}</strong>
                    </div>
                    <div className="pd-qty-row">
                      <span>Net Amount</span>
                      <strong>{money(discNet)}</strong>
                    </div>
                  </>
                ) : null}
                {discountError ? <p className="pd-price-err">{discountError}</p> : null}
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="pd-key"
                      disabled={!discModeOn}
                      onClick={() => onDiscountPadKey(k)}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button
                    type="button"
                    className="pd-qty-done"
                    disabled={!discModeOn || savingKot}
                    onClick={() => void applyDiscountDone()}
                  >
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={closeDiscountDialog}>
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
