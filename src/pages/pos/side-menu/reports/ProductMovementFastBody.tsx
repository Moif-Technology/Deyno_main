import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { digits } from '../../../../utils/validate'
import { Search } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function ProductMovementFastBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, searchTxnList, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'productMovementFast' || entryModal === 'productMovementSlow' ? (
        <>
          <div className="lst-bar lst-bar-one">
            <DateRangePicker
              from={ef('rFrom')}
              to={ef('rTo')}
              onChange={(from, to) => {
                setEf('rFrom', from)
                setEf('rTo', to)
              }}
            />
            <label className="rpf-inline">
              Min qty
              <input
                className="rpf-input"
                inputMode="numeric"
                value={ef('rMin')}
                onChange={(e) => setEf('rMin', digits(e.target.value))}
              />
            </label>
            <button type="button" className="lst-btn is-primary" onClick={searchTxnList}>
              <Search size={14} /> Search
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid rpf-grid">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Item</th>
                  <th className="num">Unit Price</th>
                  <th className="num">Qty Sold</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="rpf-none">
                    No items in this range
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
