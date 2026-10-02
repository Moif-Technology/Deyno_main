import { Search, X, User } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function PartyOrderListBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'partyOrderList' ? (
        <>
          {/* One toolbar: search (filters as you type) · status. */}
          <div className="lst-bar">
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('searchValue')}
                onChange={(e) => setEf('searchValue', e.target.value)}
                placeholder="Search order no, customer or phone"
                autoFocus
              />
              {ef('searchValue') ? (
                <button type="button" onClick={() => setEf('searchValue', '')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <div className="lst-seg" role="tablist" aria-label="Order status">
              {[
                ['', 'All'],
                ['PENDING', 'Pending'],
                ['READY', 'Ready'],
              ].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={ef('poiStatus') === value}
                  className={ef('poiStatus') === value ? 'is-on' : undefined}
                  onClick={() => setEf('poiStatus', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="poi">
            {/* Left: orders */}
            <div className="pd-grid-wrap">
              <table className="pd-grid">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Customer</th>
                    <th>Delivery</th>
                    <th className="num">Amount</th>
                    <th className="num">Advance</th>
                    <th className="num">Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={7}>No party orders found</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right: the selected order's customer */}
            <aside className={`poi-card${ef('poiName') ? '' : ' is-empty'}`} aria-label="Customer details">
              {ef('poiName') ? (
                <>
                  <strong>{ef('poiName')}</strong>
                  <dl>
                    <div>
                      <dt>Phone</dt>
                      <dd>{ef('poiPhone') || '—'}</dd>
                    </div>
                    <div>
                      <dt>Area</dt>
                      <dd>{ef('poiArea') || '—'}</dd>
                    </div>
                    <div>
                      <dt>Address</dt>
                      <dd>{ef('poiAddress') || '—'}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <User size={24} />
                  <span>Select an order to see the customer</span>
                </>
              )}
            </aside>
          </div>
        </>
      ) : null}
    </>
  )
}
