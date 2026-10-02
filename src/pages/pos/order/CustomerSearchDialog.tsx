import { Users, X, Search, UserPlus } from 'lucide-react'
import { type PosCtx } from '../main/usePosMain'

export function CustomerSearchDialog({ ctx }: { ctx: PosCtx }) {
  const {
    customerEntryOpen, customerId, customerName, customerOpen, customerRows, customerSearch,
    customerSearchRef, customerState, loadCustomers, onCustomerQueryChange, openNewCustomer,
    pickCustomer, setCustomerOpen,
  } = ctx
  return (
    <>
      {customerOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !customerEntryOpen) setCustomerOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Users size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Customer</p>
                  <h2 className="pd-mod-item-name">{customerName || 'Select a customer'}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setCustomerOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <div className="pd-cust-toolbar">
                <label className="pd-search pd-cust-search">
                  <Search size={14} color="var(--text-3)" />
                  <input
                    ref={customerSearchRef}
                    value={customerSearch}
                    onChange={(e) => onCustomerQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void loadCustomers(e.currentTarget.value)
                    }}
                    placeholder="Name, tel, or mobile…"
                  />
                  {customerSearch ? (
                    <button
                      type="button"
                      className="pd-search-clear"
                      aria-label="Clear search"
                      onClick={() => onCustomerQueryChange('')}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </label>
                <button type="button" className="pd-cust-new" onClick={openNewCustomer}>
                  <UserPlus size={14} /> New
                </button>
              </div>
              <div className="pd-ol-list">
                {customerState === 'loading' ? <p className="pd-cat-msg">Searching…</p> : null}
                {customerState !== 'loading' && customerRows.length === 0 ? (
                  <div className="pd-cust-empty">
                    <p>No customers found</p>
                    <button type="button" className="pd-cust-new is-block" onClick={openNewCustomer}>
                      <UserPlus size={14} /> New Customer
                    </button>
                  </div>
                ) : null}
                {customerRows.map((c) => {
                  const sub = [c.mobile, c.telephone, c.code].filter(Boolean).join(' · ')
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`pd-ol-row${customerId === c.id ? ' is-on' : ''}`}
                      onClick={() => pickCustomer(c)}
                    >
                      <strong>{c.name}</strong>
                      <span>{sub || '—'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
