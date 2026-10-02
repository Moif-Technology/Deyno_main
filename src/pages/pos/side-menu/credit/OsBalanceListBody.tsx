import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Search } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function OsBalanceListBody({ ctx }: { ctx: PosCtx }) {
  const {
    displayCreditList, ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'osBalanceList' ? (
        <>
          {/* One toolbar: All / By date · date range (By date only) · customer search. */}
          <div className="lst-bar">
            <div className="lst-seg" role="tablist" aria-label="Range">
              {[
                ['all', 'All'],
                ['filter', 'By date'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={ef('obMode') === value}
                  className={ef('obMode') === value ? 'is-on' : undefined}
                  onClick={() => setEf('obMode', value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {ef('obMode') === 'filter' ? (
              <div className="lst-range">
                <DateRangePicker
                  from={ef('obFrom')}
                  to={ef('obTo')}
                  onChange={(from, to) => {
                    setEf('obFrom', from)
                    setEf('obTo', to)
                  }}
                />
              </div>
            ) : null}
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('obCustomerName')}
                onChange={(e) => setEf('obCustomerName', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') displayCreditList()
                }}
                placeholder="Search customer"
              />
            </span>
            <button type="button" className="lst-btn is-primary" onClick={displayCreditList}>
              Show
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Bills</th>
                  <th className="num">Bill Total</th>
                  <th className="num">O/S Amount</th>
                  <th className="num">0–30 days</th>
                  <th className="num">30–60</th>
                  <th className="num">60–120</th>
                  <th className="num">120+</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={8}>No outstanding balances</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
