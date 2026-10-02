import { DatePicker } from '../../../../components/common/DatePicker'
import { decimal } from '../../../../utils/validate'
import { type PosCtx } from '../../main/usePosMain'

export function StockAdjustmentBody({ ctx }: { ctx: PosCtx }) {
  const {
    addTxnLine, ef, entryModal, setEf, setTd, setTxnSelected, td, txnLines, txnSelected,
  } = ctx
  return (
    <>
      {entryModal === 'stockAdjustment' ? (
        <>
          <div className="pd-txn-head">
            <div className="pd-txn-head-fields">
              <div className="pd-form-grid-2">
                <div className="pd-form-row">
                  <label>Stock Adj. No.</label>
                  <input value={ef('txnNo')} readOnly placeholder="Auto" />
                </div>
                <div className="pd-form-row">
                  <label>Date</label>
                  <DatePicker value={ef('txnDate')} onChange={(v) => setEf('txnDate', v)} />
                </div>
              </div>
              <div className="pd-form-row">
                <label>Remarks</label>
                <input value={ef('txnRemarks')} onChange={(e) => setEf('txnRemarks', e.target.value)} />
              </div>
            </div>
            <p className="pd-txn-status">Status : New Stock Entry</p>
          </div>
          <div className="pd-recipe-line-row">
            <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
            <input placeholder="Short Description" value={td('shortDesc')} onChange={(e) => setTd('shortDesc', e.target.value)} />
            <input placeholder="Pkt Qty" value={td('pktQty')} onChange={(e) => setTd('pktQty', decimal(e.target.value))} />
            <input placeholder="Pkt. details" value={td('pktDetails')} onChange={(e) => setTd('pktDetails', e.target.value)} />
            <input placeholder="System Qty" value={td('systemQty')} onChange={(e) => setTd('systemQty', decimal(e.target.value))} />
            <input placeholder="Adj. Qty" value={td('adjQty')} onChange={(e) => setTd('adjQty', decimal(e.target.value))} />
            <input placeholder="Entered Qty" value={td('enteredQty')} onChange={(e) => setTd('enteredQty', decimal(e.target.value))} />
            <input placeholder="Physical Qty" value={td('physicalQty')} onChange={(e) => setTd('physicalQty', decimal(e.target.value))} />
            <select value={td('reason')} onChange={(e) => setTd('reason', e.target.value)}>
              <option value="Opening Stock">Opening Stock</option>
              <option value="Stock Count">Stock Count</option>
              <option value="Wastage">Wastage</option>
              <option value="Other">Other</option>
            </select>
            <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
              ADD
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Short Description</th>
                  <th>Packet Details</th>
                  <th>Present Qty</th>
                  <th>AdjustQty</th>
                  <th>EnteredQty</th>
                  <th>PhysicalQty</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {txnLines.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No lines added</td>
                  </tr>
                ) : (
                  txnLines.map((l, i) => (
                    <tr
                      key={i}
                      className={txnSelected === i ? 'is-selected' : undefined}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setTxnSelected(i)}
                    >
                      <td>{l.barcode}</td>
                      <td>{l.shortDesc}</td>
                      <td>{l.pktDetails}</td>
                      <td>{l.systemQty}</td>
                      <td>{l.adjQty}</td>
                      <td>{l.enteredQty}</td>
                      <td>{l.physicalQty}</td>
                      <td>{l.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
