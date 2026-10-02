import { Receipt, X, Search, Users, Printer } from 'lucide-react'
import { money } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function ReceiptDialog({ ctx }: { ctx: PosCtx }) {
  const {
    loadReceiptCustomers, receiptBills, receiptCustomerId, receiptCustomerName, receiptCustomers,
    receiptCustomersState, receiptDetailState, receiptHistory, receiptOpen, receiptSearch,
    selectReceiptCustomer, setReceiptOpen, setReceiptSearch, toast,
  } = ctx
  return (
    <>
      {receiptOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReceiptOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-wide pd-rcm" role="dialog" aria-modal="true" aria-labelledby="pd-rcm-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Receipt size={15} strokeWidth={2} />
                </div>
                <div>
                  <p className="pd-mod-kicker">Credit</p>
                  <h2 id="pd-rcm-title" className="pd-mod-item-name">Customer Receipt</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setReceiptOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>

            <div className="pd-rcm-body">
              <aside className="pd-rcm-side">
                <form
                  className="pd-olm-search pd-rcm-search"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void loadReceiptCustomers(receiptSearch)
                  }}
                >
                  <Search size={14} />
                  <input
                    value={receiptSearch}
                    onChange={(e) => setReceiptSearch(e.target.value)}
                    placeholder="Search name or code"
                    aria-label="Search customer"
                  />
                  {receiptSearch ? (
                    <button
                      type="button"
                      className="pd-rcm-clear"
                      aria-label="Clear search"
                      onClick={() => {
                        setReceiptSearch('')
                        void loadReceiptCustomers('')
                      }}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </form>
                <div className="pd-rcm-list">
                  {receiptCustomersState === 'loading' ? <p className="pd-rcm-muted">Loading…</p> : null}
                  {receiptCustomersState === 'idle' && receiptCustomers.length === 0 ? (
                    <p className="pd-rcm-muted">No customers found</p>
                  ) : null}
                  {receiptCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`pd-rcm-cust${receiptCustomerId === c.id ? ' is-on' : ''}`}
                      onClick={() => void selectReceiptCustomer(c)}
                    >
                      <span className="pd-rcm-avatar" aria-hidden>
                        {c.name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join('')}
                      </span>
                      <span className="pd-rcm-cust-text">
                        <strong>{c.name}</strong>
                        <small>{c.code || '—'}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="pd-rcm-main">
                {!receiptCustomerId ? (
                  <div className="pd-rcm-empty">
                    <Users size={28} strokeWidth={1.6} />
                    <p>Select a customer to see their bills and payments</p>
                  </div>
                ) : (
                  <>
                    <div className="pd-rcm-summary">
                      <div>
                        <p className="pd-rcm-label">Customer</p>
                        <h3>{receiptCustomerName}</h3>
                      </div>
                      <div className="pd-rcm-total">
                        <p className="pd-rcm-label">Total Outstanding</p>
                        <strong>AED {money(receiptBills.reduce((n, b) => n + b.balance, 0))}</strong>
                        <small>
                          {receiptBills.length} bill{receiptBills.length === 1 ? '' : 's'}
                          {receiptHistory[0] ? ` · Last paid ${receiptHistory[0].date || '—'}` : ''}
                        </small>
                      </div>
                    </div>

                    {receiptDetailState === 'loading' ? <p className="pd-rcm-muted">Loading…</p> : null}
                    {receiptDetailState === 'error' ? <p className="pd-mfg-msg">Could not load bills</p> : null}

                    <div className="pd-rcm-section">
                      <p className="pd-rcm-label">Outstanding Bills</p>
                      {receiptDetailState === 'idle' && receiptBills.length === 0 ? (
                        <p className="pd-rcm-muted">No outstanding bills</p>
                      ) : (
                        <div className="pd-rcm-table">
                          <div className="pd-rcm-tr pd-rcm-th">
                            <span>Bill No</span>
                            <span>Date</span>
                            <span className="num">Amount</span>
                            <span className="num">Balance</span>
                          </div>
                          {receiptBills.map((b, i) => (
                            <div key={i} className="pd-rcm-tr">
                              <span className="pd-rcm-strong">{b.billNo || '—'}</span>
                              <span>{b.date || '—'}</span>
                              <span className="num">{money(b.amount)}</span>
                              <span className="num pd-rcm-due">{money(b.balance)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pd-rcm-section">
                      <p className="pd-rcm-label">Recent Payments</p>
                      {receiptDetailState === 'idle' && receiptHistory.length === 0 ? (
                        <p className="pd-rcm-muted">No payments yet</p>
                      ) : (
                        <div className="pd-rcm-table">
                          {receiptHistory.map((h, i) => (
                            <div key={i} className="pd-rcm-tr pd-rcm-pay">
                              <span className="pd-rcm-badge">{h.type || 'PAYMENT'}</span>
                              <span>{h.date || '—'}</span>
                              <span className="num pd-rcm-paid">+ {money(h.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>

            <div className="pd-mod-foot">
              <span className="pd-mfg-count">{receiptCustomers.length} customers</span>
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn"
                disabled={!receiptCustomerId}
                onClick={() => toast('Print Outstanding — coming soon', 'info')}
              >
                <Printer size={14} /> Print Outstanding
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn"
                disabled={!receiptCustomerId}
                onClick={() => toast('Receipt Details — coming soon', 'info')}
              >
                Receipt Details
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                disabled={!receiptCustomerId}
                onClick={() => toast('Receipt Summary — coming soon', 'info')}
              >
                Receipt Summary
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
