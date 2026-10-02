import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Search } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function CancelBillDetailsBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, searchTxnList, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'cancelBillDetails' ? (
        <>
          <div className="lst-bar">
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
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>KOT</th>
                  <th>Cashier</th>
                  <th>Waiter</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="rpf-none">
                    No cancelled bills in this range
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
