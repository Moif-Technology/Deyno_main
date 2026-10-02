import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Search } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function TransferListBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, searchTxnList, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'transferList' || entryModal === 'receiptList' ? (
        <>
          {/* One toolbar row: status · date range · search (Transfer No or Remarks). */}
          <div className="lst-bar">
            <div className="lst-seg" role="tablist" aria-label="Status">
              {[
                ['', 'All'],
                ['POSTED', 'Posted'],
                ['PENDING', 'Pending'],
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
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('searchValue')}
                onChange={(e) => setEf('searchValue', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') searchTxnList()
                }}
                placeholder="Search transfer no or remarks"
              />
            </span>
            <button type="button" className="lst-btn is-primary" onClick={searchTxnList}>
              Search
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                {entryModal === 'receiptList' ? (
                  <tr>
                    <th>Transfer No</th>
                    <th>Transfer From</th>
                    <th>Transfer To</th>
                    <th>Transfer Date</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Transfer No</th>
                    <th>Remarks</th>
                    <th>Transfer Date</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                  </tr>
                )}
              </thead>
              <tbody>
                <tr>
                  <td colSpan={entryModal === 'receiptList' ? 6 : 5}>No transfers in this date range</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
