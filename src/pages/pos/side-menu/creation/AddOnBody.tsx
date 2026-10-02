import { ArabicInput } from '../../../../components/common/ArabicInput'
import { decimal, percent } from '../../../../utils/validate'
import { type PosCtx } from '../../main/usePosMain'

export function AddOnBody({ ctx }: { ctx: PosCtx }) {
  const {
    addOns, ef, entryModal, groups, notifyTranslateDown, setEf, setEfWithArabicAutoFill, withVat,
  } = ctx
  return (
    <>
      {entryModal === 'addOn' ? (
        <div className="pd-addon-body">
          <div className="pd-addon-form">
            <div className="pd-form-row">
              <label>Add-on Name</label>
              <input
                value={ef('addOnName')}
                onChange={(e) => setEfWithArabicAutoFill('addOnName', 'addOnArabic', e.target.value)}
              />
            </div>
            <div className="pd-form-row">
              <label>Add On Arabic</label>
              <ArabicInput value={ef('addOnArabic')} onValueChange={(v) => setEf('addOnArabic', v)} source={ef('addOnName')} onTranslateError={notifyTranslateDown} />
            </div>
            <div className="pd-form-grid-2">
              <div className="pd-form-row">
                <label>Price Without Vat</label>
                <input value={ef('addOnPrice')} onChange={(e) => setEf('addOnPrice', decimal(e.target.value))} />
              </div>
              <div className="pd-form-row">
                <label>Vat %</label>
                <input value={ef('addOnVat')} onChange={(e) => setEf('addOnVat', percent(e.target.value))} />
              </div>
            </div>
            <div className="pd-form-row">
              <label>Price With Vat</label>
              <div className="pd-form-computed">AED {withVat(ef('addOnPrice'), ef('addOnVat'))}</div>
            </div>
            <div className="pd-grid-wrap">
              <table className="pd-grid">
                <thead>
                  <tr>
                    <th>Add-on</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {addOns.length === 0 ? (
                    <tr>
                      <td colSpan={2}>No add-ons saved yet</td>
                    </tr>
                  ) : (
                    addOns.map((a, i) => (
                      <tr key={i}>
                        <td>{a.name}</td>
                        <td>AED {withVat(a.priceNoVat, a.vatPct)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pd-addon-tree">
            {groups.length === 0 ? (
              <p className="pd-cat-msg">No categories loaded</p>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="pd-addon-tree-group">
                  {g.name.toLowerCase()}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
