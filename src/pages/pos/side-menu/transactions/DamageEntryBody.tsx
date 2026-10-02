import { DatePicker } from '../../../../components/common/DatePicker'
import { decimal } from '../../../../utils/validate'
import { type PosCtx } from '../../main/usePosMain'

export function DamageEntryBody({ ctx }: { ctx: PosCtx }) {
  const {
    addTxnLine, ef, entryModal, setEf, setTd, setTxnSelected, td, txnLines, txnSelected,
  } = ctx
  return (
    <>
      {entryModal === 'damageEntry' ? (
        <div className="pd-dmg">
          <div className="pd-dmg-head">
            <div className="pd-form-row">
              <label>Damage No.</label>
              <input value={ef('txnNo')} readOnly placeholder="Auto" />
            </div>
            <div className="pd-form-row">
              <label>Date</label>
              <DatePicker value={ef('txnDate')} onChange={(v) => setEf('txnDate', v)} />
            </div>
            <div className="pd-form-row pd-dmg-remarks">
              <label>Remarks</label>
              <input value={ef('txnRemarks')} onChange={(e) => setEf('txnRemarks', e.target.value)} />
            </div>
          </div>
          <div className="pd-dmg-line">
            <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
            <input
              className="pd-dmg-desc"
              placeholder="Item"
              value={td('shortDesc')}
              onChange={(e) => setTd('shortDesc', e.target.value)}
            />
            <input
              className="pd-dmg-qty"
              placeholder="Qty"
              inputMode="decimal"
              value={td('adjQty')}
              onChange={(e) => setTd('adjQty', decimal(e.target.value))}
            />
            <select value={td('reason')} onChange={(e) => setTd('reason', e.target.value)}>
              <option value="Damage">Damage</option>
              <option value="Expiry">Expiry</option>
              <option value="Breakage">Breakage</option>
            </select>
            <button type="button" className="pd-dmg-add" onClick={addTxnLine}>
              Add
            </button>
          </div>
          <div className="pd-dmg-list">
            <table>
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Item</th>
                  <th className="is-num">Qty</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {txnLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="pd-dmg-empty">No items added</td>
                  </tr>
                ) : (
                  txnLines.map((l, i) => (
                    <tr
                      key={i}
                      className={txnSelected === i ? 'is-selected' : undefined}
                      onClick={() => setTxnSelected(i)}
                    >
                      <td>{l.barcode}</td>
                      <td>{l.shortDesc}</td>
                      <td className="is-num">{l.adjQty}</td>
                      <td>{l.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  )
}
