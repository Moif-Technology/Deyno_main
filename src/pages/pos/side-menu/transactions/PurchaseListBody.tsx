import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Search, Plus } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function PurchaseListBody({ ctx }: { ctx: PosCtx }) {
  const {
    closeEntryModal, ef, entryModal, searchTxnList, setEf, setPurchaseMode, suppliers,
  } = ctx
  return (
    <>
      {entryModal === 'purchaseList' || entryModal === 'purchaseReturnList' ? (
        <>
          {/* One toolbar: status · pay mode · supplier · date range, then search · New. */}
          <div className="lst-bar">
            <div className="lst-seg" role="tablist" aria-label="Status">
              {[
                ['', 'All'],
                ['POSTED', 'Posted'],
                ['DRAFT', 'Draft'],
              ].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={ef('postStatus') === value}
                  className={ef('postStatus') === value ? 'is-on' : undefined}
                  onClick={() => setEf('postStatus', value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {entryModal === 'purchaseList' ? (
              <div className="lst-seg" role="tablist" aria-label="Pay mode">
                {[
                  ['', 'All'],
                  ['CREDIT', 'Credit'],
                  ['CASH', 'Cash'],
                ].map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={ef('paymentModeFilter') === value}
                    className={ef('paymentModeFilter') === value ? 'is-on' : undefined}
                    onClick={() => setEf('paymentModeFilter', value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <select
              className="lst-select"
              value={ef('supplierFilter')}
              onChange={(e) => setEf('supplierFilter', e.target.value)}
              aria-label="Supplier"
            >
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="lst-range">
              <DateRangePicker
                from={ef('listFrom')}
                to={ef('listTo')}
                onChange={(from, to) => {
                  setEf('listFrom', from)
                  setEf('listTo', to)
                }}
              />
            </div>
          </div>
          <div className="lst-bar">
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('searchValue')}
                onChange={(e) => setEf('searchValue', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') searchTxnList()
                }}
                placeholder={entryModal === 'purchaseList' ? 'Search purchase no or supplier' : 'Search return no, purchase no or supplier'}
              />
            </span>
            <button type="button" className="lst-btn" onClick={searchTxnList}>
              Search
            </button>
            <button
              type="button"
              className="lst-btn is-primary"
              onClick={() => {
                const next = entryModal === 'purchaseList' ? 'purchase' : 'return'
                closeEntryModal()
                setPurchaseMode(next)
              }}
            >
              <Plus size={14} />
              {entryModal === 'purchaseList' ? 'New Purchase' : 'New Return'}
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                {entryModal === 'purchaseList' ? (
                  <tr>
                    <th>Purchase No</th>
                    <th>Purchase Date</th>
                    <th>Supplier Name</th>
                    <th>Supplier Inv No</th>
                    <th>Invoice Amount</th>
                    <th>Payment Mode</th>
                    <th>Status</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Return No</th>
                    <th>Return Date</th>
                    <th>Purchase No</th>
                    <th>Supplier Inv No</th>
                    <th>Supplier Name</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                )}
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7}>{entryModal === 'purchaseList' ? 'No purchases' : 'No returns'} in this date range</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
