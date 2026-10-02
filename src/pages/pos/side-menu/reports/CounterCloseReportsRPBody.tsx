import { digits } from '../../../../utils/validate'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Search } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function CounterCloseReportsRPBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, searchTxnList, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'counterCloseReportsRP' ? (
        <>
          <div className="lst-bar">
            <input
              className="rpf-input rpf-counter"
              inputMode="numeric"
              placeholder="Counter No (all)"
              aria-label="Counter No"
              value={ef('rCounterNo')}
              onChange={(e) => setEf('rCounterNo', digits(e.target.value, 6))}
            />
            <DateRangePicker
              from={ef('rFrom')}
              to={ef('rTo')}
              onChange={(from, to) => {
                setEf('rFrom', from)
                setEf('rTo', to)
              }}
            />
            <button type="button" className="lst-btn is-primary" onClick={searchTxnList}>
              <Search size={14} /> Search
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid rpf-grid">
              <thead>
                <tr>
                  <th>Counter</th>
                  <th>Close Date</th>
                  <th>Time</th>
                  <th className="num">Bills</th>
                  <th className="num">Cash Sale</th>
                  <th className="num">Credit Sale</th>
                  <th className="num">Online</th>
                  <th className="num">Discount</th>
                  <th className="num">Total Sale</th>
                  <th className="num">To Collect</th>
                  <th className="num">Collected</th>
                  <th className="num">Difference</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={12} className="rpf-none">
                    No counter closes in this range
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
