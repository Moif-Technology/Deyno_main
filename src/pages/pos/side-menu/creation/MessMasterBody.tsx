import { decimal } from '../../../../utils/validate'
import { SearchSelect } from '../../../../components/common/SearchSelect'
import { ScrollTable } from '../../../../components/common/ScrollTable'
import { type PosCtx } from '../../main/usePosMain'

export function MessMasterBody({ ctx }: { ctx: PosCtx }) {
  const {
    addMessLine, ef, entryModal, messItemOptions, messLines, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'messMaster' ? (
        <div className="pd-te-grid pd-combo-grid">
        <div className="pd-te-fields">
          <div className="pd-form-row">
            <label>Mess Name</label>
            <input value={ef('messName')} onChange={(e) => setEf('messName', e.target.value)} />
          </div>
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>No Of Time</label>
              <select value={ef('messTimes')} onChange={(e) => setEf('messTimes', e.target.value)}>
                <option value="">Select…</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="pd-form-row">
              <label>Mess Amount</label>
              <input value={ef('messAmount')} onChange={(e) => setEf('messAmount', decimal(e.target.value))} />
            </div>
          </div>
          <div className="pd-form-row">
            <label>Item</label>
            {/* Picking an item adds it straight to the table; the
               picker then resets so the next item can be chosen. */}
            <SearchSelect
              id="pd-mess-item"
              value={null}
              options={messItemOptions}
              onChange={(o) => addMessLine(o.name)}
              placeholder="Select item to add…"
              searchPlaceholder="Search item"
              emptyText="No products loaded"
            />
          </div>
        </div>
          <ScrollTable
            columns={[{ key: 'name', header: 'Description', render: (l: string) => l }]}
            rows={messLines}
            rowKey={(l) => l}
            height={240}
            emptyText="No items added"
          />
        </div>
      ) : null}
    </>
  )
}
