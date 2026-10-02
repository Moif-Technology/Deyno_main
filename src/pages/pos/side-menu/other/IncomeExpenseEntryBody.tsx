import { decimal } from '../../../../utils/validate'
import { DatePicker } from '../../../../components/common/DatePicker'
import { money } from '../../main/posHelpers'
import { type PosCtx } from '../../main/usePosMain'

export function IncomeExpenseEntryBody({ ctx }: { ctx: PosCtx }) {
  const {
    addTxnLine, ef, entryModal, setEf, setTd, setTxnSelected, td, txnLines, txnSelected,
  } = ctx
  return (
    <>
      {entryModal === 'incomeExpenseEntry' ? (
        <>
          <div className="pd-recipe-line-row">
            <input placeholder="Account Name" value={td('accountName')} onChange={(e) => setTd('accountName', e.target.value)} />
            <input placeholder="Remarks" value={td('remarks')} onChange={(e) => setTd('remarks', e.target.value)} />
            <input placeholder="Taxable Amount" value={td('taxableAmount')} onChange={(e) => setTd('taxableAmount', decimal(e.target.value))} />
            <select value={ef('ieTaxRate')} onChange={(e) => setEf('ieTaxRate', e.target.value)}>
              <option value="0.00">0.00</option>
              <option value="5.00">5.00</option>
            </select>
            <select value={ef('iePayType')} onChange={(e) => setEf('iePayType', e.target.value)}>
              <option value="CASH">CASH</option>
              <option value="CREDIT">CREDIT</option>
            </select>
            <select value={ef('ieType')} onChange={(e) => setEf('ieType', e.target.value)}>
              <option value="INCOME">INCOME</option>
              <option value="EXPENSE">EXPENSE</option>
            </select>
            <DatePicker value={ef('ieDate')} onChange={(v) => setEf('ieDate', v)} />
            <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
              Add
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Remarks</th>
                  <th>Date</th>
                  <th>Pay Type</th>
                  <th>Taxable Amount</th>
                  <th>Tax Amt</th>
                  <th>{ef('ieType') === 'EXPENSE' ? 'Expence' : 'Income'}</th>
                </tr>
              </thead>
              <tbody>
                {txnLines.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No entries added</td>
                  </tr>
                ) : (
                  txnLines.map((l, i) => {
                    const taxAmt = (Number(l.taxableAmount) || 0) * (Number(ef('ieTaxRate')) / 100)
                    return (
                      <tr
                        key={i}
                        className={txnSelected === i ? 'is-selected' : undefined}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setTxnSelected(i)}
                      >
                        <td>{l.accountName}</td>
                        <td>{l.remarks}</td>
                        <td>{ef('ieDate')}</td>
                        <td>{ef('iePayType')}</td>
                        <td>{l.taxableAmount}</td>
                        <td>{money(taxAmt)}</td>
                        <td>{money((Number(l.taxableAmount) || 0) + taxAmt)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="pd-form-row">
            <label>Total</label>
            <div className="pd-form-computed">
              AED {money(txnLines.reduce((sum, l) => sum + (Number(l.taxableAmount) || 0), 0))}
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
