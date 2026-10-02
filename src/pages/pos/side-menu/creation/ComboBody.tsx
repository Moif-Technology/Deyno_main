import { decimal } from '../../../../utils/validate'
import { X, Plus } from 'lucide-react'
import { ScrollTable } from '../../../../components/common/ScrollTable'
import { type PosCtx } from '../../main/usePosMain'

export function ComboBody({ ctx }: { ctx: PosCtx }) {
  const {
    comboGroupInput, comboGroups, ef, entryModal, groups, setComboGroupInput, setComboGroups, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'combo' ? (
        <div className="pd-te-grid pd-combo-grid">
        <div className="pd-te-fields">
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>Combo Name</label>
              <input value={ef('comboName')} onChange={(e) => setEf('comboName', e.target.value)} />
            </div>
            <div className="pd-form-row">
              <label>Price</label>
              <input value={ef('comboPrice')} onChange={(e) => setEf('comboPrice', decimal(e.target.value))} />
            </div>
          </div>
          <div className="pd-form-row">
            <label>Group Name</label>
            <div className="pd-combo-pick">
              <span className="pd-combo-select">
                <select value={comboGroupInput} onChange={(e) => setComboGroupInput(e.target.value)}>
                  <option value="">Select…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {comboGroupInput ? (
                  <button
                    type="button"
                    className="pd-combo-clear"
                    aria-label="Clear group"
                    title="Clear"
                    onClick={() => setComboGroupInput('')}
                  >
                    <X size={12} strokeWidth={2.6} />
                  </button>
                ) : null}
              </span>
              <button
                type="button"
                className="pd-combo-add"
                aria-label="Add group"
                title="Add group"
                disabled={!comboGroupInput || comboGroups.includes(comboGroupInput)}
                onClick={() => {
                  if (comboGroupInput && !comboGroups.includes(comboGroupInput)) {
                    setComboGroups((prev) => [...prev, comboGroupInput])
                  }
                }}
              >
                <Plus size={16} strokeWidth={2.6} />
              </button>
            </div>
          </div>
        </div>
          <ScrollTable
            columns={[{ key: 'name', header: 'Group Name', render: (g: string) => g }]}
            rows={comboGroups}
            rowKey={(g) => g}
            height={240}
            emptyText="No groups added"
            isSelected={(g) => comboGroupInput === g}
            onRowClick={(g) => setComboGroupInput(g)}
          />
        </div>
      ) : null}
    </>
  )
}
