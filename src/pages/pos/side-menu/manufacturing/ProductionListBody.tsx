import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { type PosCtx } from '../../main/usePosMain'

export function ProductionListBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, searchTxnList, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'productionList' ? (
        <>
          <div className="pd-txn-search-row">
            <div className="pd-form-row">
              <label>From – To</label>
              <DateRangePicker
                from={ef('listFrom')}
                to={ef('listTo')}
                onChange={(from, to) => {
                  setEf('listFrom', from)
                  setEf('listTo', to)
                }}
              />
            </div>
            <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
              Search
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Production No</th>
                  <th>Date</th>
                  <th>Items</th>
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
