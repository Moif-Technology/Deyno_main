import { Search, X, Receipt } from 'lucide-react'
import { money } from '../../main/posHelpers'
import { type PosCtx } from '../../main/usePosMain'

export function BillReprintBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, openReprintBill, reprintBills, reprintItems, reprintPick, reprintState, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'billReprint' ? (
        (() => {
          const q = ef('searchValue').trim().toLowerCase()
          const bills = q
            ? reprintBills.filter(
                (r) => String(r.billNo).toLowerCase().includes(q) || String(r.paymentMode).toLowerCase().includes(q),
              )
            : reprintBills
          const picked = reprintBills.find((r) => r.salesId === reprintPick)
          return (
            <div className="brp">
              {/* Left: bills */}
              <div className="brp-left">
                <span className="lst-search">
                  <Search size={14} />
                  <input
                    value={ef('searchValue')}
                    onChange={(e) => setEf('searchValue', e.target.value)}
                    placeholder="Search bill no or payment mode"
                    autoFocus
                  />
                  {ef('searchValue') ? (
                    <button type="button" onClick={() => setEf('searchValue', '')} aria-label="Clear search">
                      <X size={12} />
                    </button>
                  ) : null}
                </span>
                <div className="brp-bills">
                  {reprintState === 'loading' ? (
                    <p className="brp-msg">Loading bills…</p>
                  ) : bills.length === 0 ? (
                    <p className="brp-msg">
                      {reprintState === 'error' ? 'Could not load bills' : q ? 'No bill matches this search' : 'No bills found'}
                    </p>
                  ) : (
                    bills.map((row) => (
                      <button
                        key={row.salesId}
                        type="button"
                        className={`brp-bill${reprintPick === row.salesId ? ' is-on' : ''}`}
                        onClick={() => void openReprintBill(row.salesId)}
                        onDoubleClick={() => void openReprintBill(row.salesId, true)}
                        title="Double-tap to print"
                      >
                        <span className="brp-bill-main">
                          <b>{row.billNo}</b>
                          <small>
                            {row.billTime
                              ? new Date(row.billTime).toLocaleString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </small>
                        </span>
                        <span className="lst-tag">{row.paymentMode || '—'}</span>
                        <b className="brp-bill-amt">{money(row.total)}</b>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right: the selected bill */}
              <div className="brp-right">
                {picked ? (
                  <>
                    <div className="brp-head">
                      <span>
                        <small>Bill</small>
                        <b>{picked.billNo}</b>
                      </span>
                      <span className="is-total">
                        <small>Total</small>
                        <b>AED {money(picked.total)}</b>
                      </span>
                    </div>
                    <div className="pd-grid-wrap brp-items">
                      <table className="pd-grid">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Item</th>
                            <th className="num">Qty</th>
                            <th className="num">Price</th>
                            <th className="num">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reprintItems.length === 0 ? (
                            <tr>
                              <td colSpan={5}>Loading items…</td>
                            </tr>
                          ) : (
                            reprintItems.map((it) => (
                              <tr key={it.sl}>
                                <td>{it.sl}</td>
                                <td title={it.barcode ? `Barcode ${it.barcode}` : undefined}>{it.name}</td>
                                <td className="num">{it.qty}</td>
                                <td className="num">{money(it.unitPrice)}</td>
                                <td className="num">{money(it.lineTotal)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="brp-empty">
                    <Receipt size={28} />
                    <strong>Select a bill</strong>
                    <span>Tap a bill to see its items. Double-tap to print it straight away.</span>
                  </div>
                )}
              </div>
            </div>
          )
        })()
      ) : null}
    </>
  )
}
