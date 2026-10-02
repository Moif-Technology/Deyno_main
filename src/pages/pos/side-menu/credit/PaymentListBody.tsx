import { type PosCtx } from '../../main/usePosMain'

export function PaymentListBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal,
  } = ctx
  return (
    <>
      {entryModal === 'paymentList' ? (
        <>
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>Customer Code</label>
              <input value={ef('pvCustomerCode')} readOnly placeholder="—" />
            </div>
            <div className="pd-form-row">
              <label>Customer Name</label>
              <input value={ef('pvCustomerName')} readOnly placeholder="—" />
            </div>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Customer Code</th>
                  <th>Customer Name</th>
                  <th>Advance</th>
                  <th>Payment Date</th>
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
