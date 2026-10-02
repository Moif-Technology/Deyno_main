import { type PosCtx } from '../../main/usePosMain'

export function ComboEditBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'comboEdit' || entryModal === 'messList' ? (
        <>
          <div className="pd-form-row">
            <label>Search</label>
            <input
              value={ef('editListSearch')}
              onChange={(e) => setEf('editListSearch', e.target.value)}
              placeholder={entryModal === 'comboEdit' ? 'Combo name' : 'Mess name'}
            />
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                {entryModal === 'comboEdit' ? (
                  <tr>
                    <th>Combo Name</th>
                    <th>Price</th>
                    <th>Groups</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Mess Name</th>
                    <th>No Of Time</th>
                    <th>Amount</th>
                  </tr>
                )}
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    {entryModal === 'comboEdit' ? 'No saved combos yet' : 'No saved mess plans yet'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="pd-mfg-count">
            {entryModal === 'comboEdit' ? 'Combos' : 'Mess plans'} aren't stored on the server yet, so there is
            nothing to edit. They'll show here once saving is connected.
          </p>
        </>
      ) : null}
    </>
  )
}
