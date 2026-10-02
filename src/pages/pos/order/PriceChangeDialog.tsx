import { Tag, X } from 'lucide-react'
import { decimal } from '../../../utils/validate'
import { money, round2, KEYS } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function PriceChangeDialog({ ctx }: { ctx: PosCtx }) {
  const {
    applyPriceChange, cancelPriceChange, onPricePadKey, priceChangeLine, priceChangeOpen, priceError,
    priceFocus, priceUnit, priceUnitRef, priceVatPerc, priceVatRef, priceWithVat, setPriceFocus,
    syncFromUnit, syncFromWithVat,
  } = ctx
  return (
    <>
      {priceChangeOpen && priceChangeLine ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelPriceChange()
          }}
        >
          <div className="pd-price-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-price-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Tag size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Price Change..</p>
                  <h2 id="pd-price-title" className="pd-mod-item-name">
                    {priceChangeLine.item}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={cancelPriceChange} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-price-body">
              <div className="pd-price-fields">
                <div className="pd-qty-row">
                  <span>BarCode</span>
                  <strong>{priceChangeLine.barcode || '—'}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>Current Price</span>
                  <strong>{money(priceChangeLine.price)}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>New Price</span>
                  <input
                    ref={priceUnitRef}
                    className={`pd-qty-input${priceFocus === 'unit' ? ' is-focus' : ''}`}
                    value={priceUnit}
                    onFocus={() => setPriceFocus('unit')}
                    onChange={(e) => {
                      setPriceFocus('unit')
                      syncFromUnit(decimal(e.target.value).slice(0, 12))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyPriceChange()
                      if (e.key === 'Escape') cancelPriceChange()
                    }}
                    inputMode="none"
                  />
                </div>
                <div className="pd-price-vat-row">
                  <div className="pd-qty-row">
                    <span>VAT %</span>
                    <strong>{money(priceVatPerc)}</strong>
                  </div>
                  <div className="pd-qty-row">
                    <span>VAT Amount</span>
                    <strong>
                      {money(
                        priceUnit !== '' && Number.isFinite(Number(priceUnit))
                          ? round2(Number(priceUnit) * (priceVatPerc / 100))
                          : round2(priceChangeLine.price * (priceVatPerc / 100)),
                      )}
                    </strong>
                  </div>
                </div>
                <div className="pd-qty-row">
                  <span>Price With VAT</span>
                  <input
                    ref={priceVatRef}
                    className={`pd-qty-input${priceFocus === 'withVat' ? ' is-focus' : ''}`}
                    value={priceWithVat}
                    onFocus={() => setPriceFocus('withVat')}
                    onChange={(e) => {
                      setPriceFocus('withVat')
                      syncFromWithVat(decimal(e.target.value).slice(0, 12))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyPriceChange()
                      if (e.key === 'Escape') cancelPriceChange()
                    }}
                    inputMode="none"
                  />
                </div>
                {priceError ? <p className="pd-price-err">{priceError}</p> : null}
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {KEYS.map((k) => (
                    <button key={k} type="button" className="pd-key" onClick={() => onPricePadKey(k)}>
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={applyPriceChange}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={cancelPriceChange}>
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
