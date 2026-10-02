import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Search } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function PendingOrderListBody({ ctx }: { ctx: PosCtx }) {
  const {
    areas, ef, entryModal, searchTxnList, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'pendingOrderList' ? (
        <>
          <div className="lst-bar lst-bar-one">
            <div className="lst-seg" role="radiogroup" aria-label="Order status">
              {[
                ['PENDING', 'Pending'],
                ['COMPLETED', 'Completed'],
                ['ALL', 'All'],
              ].map(([value, label]) => {
                const on = (ef('rOrderStatus') || 'PENDING') === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={on ? 'is-on' : ''}
                    onClick={() => setEf('rOrderStatus', value)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <select className="lst-select" aria-label="Area" value={ef('rArea') || 'ALL'} onChange={(e) => setEf('rArea', e.target.value)}>
              <option value="ALL">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
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
                  <th>Order No</th>
                  <th>Time</th>
                  <th>Table</th>
                  <th>Area</th>
                  <th>Waiter</th>
                  <th className="num">Guests</th>
                  <th className="num">Sub Total</th>
                  <th className="num">Discount</th>
                  <th className="num">Tax</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={11} className="rpf-none">
                    No orders in this range
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
