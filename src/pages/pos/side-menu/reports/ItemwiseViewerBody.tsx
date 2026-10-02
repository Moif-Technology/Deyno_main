import { digits } from '../../../../utils/validate'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Search } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function ItemwiseViewerBody({ ctx }: { ctx: PosCtx }) {
  const {
    displayCreditList, ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'itemwiseViewer' ? (
        <>
          <div className="lst-bar lst-bar-one">
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
            <button type="button" className="lst-btn is-primary" onClick={displayCreditList}>
              <Search size={14} /> Display
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid rpf-grid">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Barcode</th>
                  <th>Item</th>
                  <th>Group</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit Price</th>
                  <th className="num">Discount</th>
                  <th className="num">Sub Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={8} className="rpf-none">
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
