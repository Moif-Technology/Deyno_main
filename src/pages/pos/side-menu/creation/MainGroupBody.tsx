import { ArabicInput } from '../../../../components/common/ArabicInput'
import { Toggle } from '../../../../components/common/Toggle'
import { type PosCtx } from '../../main/usePosMain'

export function MainGroupBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, efBool, entryModal, groups, notifyTranslateDown, setEf, setEfWithArabicAutoFill,
  } = ctx
  return (
    <>
      {entryModal === 'mainGroup' ? (
        <>
          <div className="pd-form-row">
            <label>Main Group Code</label>
            <input value={ef('mgCode')} onChange={(e) => setEf('mgCode', e.target.value)} />
          </div>
          <div className="pd-form-row">
            <label>Description</label>
            <input
              value={ef('mgDescription')}
              onChange={(e) => setEfWithArabicAutoFill('mgDescription', 'mgDescriptionArabic', e.target.value)}
            />
          </div>
          <div className="pd-form-row">
            <label>Description Arabic</label>
            <ArabicInput value={ef('mgDescriptionArabic')} onValueChange={(v) => setEf('mgDescriptionArabic', v)} source={ef('mgDescription')} onTranslateError={notifyTranslateDown} />
          </div>
          <Toggle checked={efBool('mgApplyDiscount')} onChange={(v) => setEf('mgApplyDiscount', v)} label="Apply Discount" />
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No main groups yet</td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr key={g.id}>
                      <td>{g.code}</td>
                      <td>{g.name}</td>
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
