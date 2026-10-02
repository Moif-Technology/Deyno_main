import { DatePicker } from '../../../../components/common/DatePicker'
import { type PosCtx } from '../../main/usePosMain'

export function StockAdjustListBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, searchTxnList, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'stockAdjustList' || entryModal === 'damageList' ? (
        <>
          <div className="pd-txn-search-row">
            <div className="pd-form-row">
              <label>From</label>
              <DatePicker value={ef('listFrom')} onChange={(v) => setEf('listFrom', v)} max={ef('listTo')} />
            </div>
            <div className="pd-form-row">
              <label>To</label>
              <DatePicker value={ef('listTo')} onChange={(v) => setEf('listTo', v)} min={ef('listFrom')} />
            </div>
            <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
              Search
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Stock Adj No</th>
                  <th>Post Status</th>
                  <th>Reason</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>No records found</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
