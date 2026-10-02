import { decimal } from '../../../../utils/validate'
import { money } from '../../main/posHelpers'
import { type PosCtx } from '../../main/usePosMain'

export function RecipeBody({ ctx }: { ctx: PosCtx }) {
  const {
    addRecipeLine, ef, entryModal, recipeDraft, recipeLines, recipeUnitCost, setEf, setRecipeDraft,
  } = ctx
  return (
    <>
      {entryModal === 'recipe' ? (
        <>
          <div className="pd-form-row">
            <label>Finished Product</label>
            <input value={ef('recipeProduct')} onChange={(e) => setEf('recipeProduct', e.target.value)} />
          </div>
          <div className="pd-recipe-line-row">
            <input
              placeholder="Product Code"
              value={recipeDraft.code}
              onChange={(e) => setRecipeDraft((d) => ({ ...d, code: e.target.value }))}
            />
            <input
              placeholder="Product Name"
              value={recipeDraft.name}
              onChange={(e) => setRecipeDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <input
              placeholder="Pack Details"
              value={recipeDraft.packDetails}
              onChange={(e) => setRecipeDraft((d) => ({ ...d, packDetails: e.target.value }))}
            />
            <input
              placeholder="Cost"
              value={recipeDraft.cost}
              onChange={(e) => setRecipeDraft((d) => ({ ...d, cost: decimal(e.target.value) }))}
            />
            <input
              placeholder="Pack Qty"
              value={recipeDraft.packQty}
              onChange={(e) => setRecipeDraft((d) => ({ ...d, packQty: decimal(e.target.value) }))}
            />
            <input
              placeholder="Qty"
              value={recipeDraft.qty}
              onChange={(e) => setRecipeDraft((d) => ({ ...d, qty: decimal(e.target.value) }))}
            />
            <select value={recipeDraft.unit} onChange={(e) => setRecipeDraft((d) => ({ ...d, unit: e.target.value }))}>
              <option value="GM">GM</option>
              <option value="KG">KG</option>
              <option value="ML">ML</option>
              <option value="LTR">LTR</option>
              <option value="PCS">PCS</option>
            </select>
            <button type="button" className="pd-form-code-btn" onClick={addRecipeLine}>
              ADD
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Product Code</th>
                  <th>Product Name</th>
                  <th>Pack Details</th>
                  <th>Pack Qty</th>
                  <th>Qty</th>
                  <th>Cost</th>
                  <th>Unit</th>
                  <th>Line Cost</th>
                </tr>
              </thead>
              <tbody>
                {recipeLines.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No ingredients added</td>
                  </tr>
                ) : (
                  recipeLines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.code}</td>
                      <td>{l.name}</td>
                      <td>{l.packDetails}</td>
                      <td>{l.packQty}</td>
                      <td>{l.qty}</td>
                      <td>{l.cost}</td>
                      <td>{l.unit}</td>
                      <td>AED {money((Number(l.cost) || 0) * (Number(l.qty) || 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="pd-form-row">
            <label>Remarks</label>
            <textarea rows={2} value={ef('recipeRemarks')} onChange={(e) => setEf('recipeRemarks', e.target.value)} />
          </div>
          <div className="pd-form-row">
            <label>Unit Cost</label>
            <div className="pd-form-computed">AED {money(recipeUnitCost())}</div>
          </div>
        </>
      ) : null}
    </>
  )
}
