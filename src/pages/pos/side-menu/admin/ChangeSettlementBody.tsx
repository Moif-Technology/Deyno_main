import { Search, X } from 'lucide-react'
import { DatePicker } from '../../../../components/common/DatePicker'
import { type PosCtx } from '../../main/usePosMain'

export function ChangeSettlementBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'changeSettlement' ? (
        <>
          {/* One toolbar: bill no search (filters as you type) · bill date · pay mode. */}
          <div className="lst-bar">
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('csBillNo')}
                onChange={(e) => setEf('csBillNo', e.target.value)}
                placeholder="Search bill no"
              />
              {ef('csBillNo') ? (
                <button type="button" onClick={() => setEf('csBillNo', '')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <div className="cs-date">
              <DatePicker value={ef('csDate')} onChange={(v) => setEf('csDate', v)} />
            </div>
            <div className="lst-seg" role="tablist" aria-label="Payment mode">
              {[
                ['', 'All'],
                ['CASH', 'Cash'],
                ['CREDIT CARD', 'Card'],
                ['CREDIT', 'Credit'],
              ].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={ef('csPaymentMode') === value}
                  className={ef('csPaymentMode') === value ? 'is-on' : undefined}
                  onClick={() => setEf('csPaymentMode', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Payment Mode</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5}>No bills on this date</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
