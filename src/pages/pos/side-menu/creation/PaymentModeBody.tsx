import { type PosCtx } from '../../main/usePosMain'

export function PaymentModeBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, paymentModes, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'paymentMode' ? (
        <>
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>Payment Mode Name</label>
              <input value={ef('pmName')} onChange={(e) => setEf('pmName', e.target.value)} />
            </div>
            <div className="pd-form-row">
              <label>Status</label>
              <select value={ef('status')} onChange={(e) => setEf('status', e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Payment Mode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentModes.map((p) => (
                  <tr
                    key={p.name}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setEf('pmName', p.name)
                      setEf('status', p.status)
                    }}
                  >
                    <td>{p.name}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
