import { UserPlus, X } from 'lucide-react'
import { phone } from '../../../utils/validate'
import { type PosCtx } from '../main/usePosMain'

export function CustomerEntryDialog({ ctx }: { ctx: PosCtx }) {
  const {
    customerEntryAddress, customerEntryError, customerEntryMobile, customerEntryName,
    customerEntryOpen, customerEntryTel, customerMobileRef, customerSaving, saveNewCustomer,
    setCustomerEntryAddress, setCustomerEntryMobile, setCustomerEntryName, setCustomerEntryOpen,
    setCustomerEntryTel,
  } = ctx
  return (
    <>
      {customerEntryOpen ? (
        <div
          className="pd-mod-overlay pd-admin-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !customerSaving) setCustomerEntryOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true" aria-labelledby="pd-cust-entry-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <UserPlus size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">New Customer</p>
                  <h2 id="pd-cust-entry-title" className="pd-mod-item-name">
                    Customer Entry
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => setCustomerEntryOpen(false)}
                disabled={customerSaving}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <form
              className="pd-ol-body pd-admin-form"
              onSubmit={(e) => {
                e.preventDefault()
                void saveNewCustomer()
              }}
            >
              <label className="pd-admin-field">
                <span>Customer Name</span>
                <input
                  autoFocus={!customerEntryMobile}
                  value={customerEntryName}
                  onChange={(e) => setCustomerEntryName(e.target.value)}
                  disabled={customerSaving}
                />
              </label>
              <label className="pd-admin-field">
                <span>Mobile Number</span>
                <input
                  ref={customerMobileRef}
                  value={customerEntryMobile}
                  onChange={(e) => setCustomerEntryMobile(phone(e.target.value))}
                  inputMode="tel"
                  disabled={customerSaving}
                />
              </label>
              <label className="pd-admin-field">
                <span>Telephone</span>
                <input
                  value={customerEntryTel}
                  onChange={(e) => setCustomerEntryTel(phone(e.target.value))}
                  inputMode="tel"
                  disabled={customerSaving}
                />
              </label>
              <label className="pd-admin-field">
                <span>Address</span>
                <input
                  value={customerEntryAddress}
                  onChange={(e) => setCustomerEntryAddress(e.target.value.slice(0, 300))}
                  disabled={customerSaving}
                />
              </label>
              {customerEntryError ? <p className="pd-admin-err">{customerEntryError}</p> : null}
              <div className="pd-mod-foot pd-admin-foot">
                <span className="pd-mod-foot-spacer" />
                <button type="submit" className="pd-mod-foot-btn is-ok" disabled={customerSaving}>
                  {customerSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="pd-mod-foot-btn is-close"
                  onClick={() => setCustomerEntryOpen(false)}
                  disabled={customerSaving}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
