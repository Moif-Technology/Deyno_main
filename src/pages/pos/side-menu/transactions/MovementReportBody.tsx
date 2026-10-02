import { DatePicker } from '../../../../components/common/DatePicker'
import { type PosCtx } from '../../main/usePosMain'

export function MovementReportBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, groups, mrSelectedGroups, setEf, setMrSelectedGroups,
  } = ctx
  return (
    <>
      {entryModal === 'movementReport' ? (
        <div className="pd-mr-body">
          <div className="pd-mr-groups">
            {groups.length === 0 ? (
              <p className="pd-cat-msg">No groups loaded</p>
            ) : (
              groups.map((g) => (
                <label key={g.id} className="pd-mr-group-row">
                  <input
                    type="checkbox"
                    checked={mrSelectedGroups.has(g.id)}
                    onChange={() =>
                      setMrSelectedGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(g.id)) next.delete(g.id)
                        else next.add(g.id)
                        return next
                      })
                    }
                  />
                  {g.name}
                </label>
              ))
            )}
          </div>
          <div className="pd-mr-filters">
            <div className="pd-form-row">
              <label>Item Name</label>
              <input value={ef('mrItem')} onChange={(e) => setEf('mrItem', e.target.value)} />
            </div>
            <div className="pd-form-row">
              <label>Invoice Date From</label>
              <DatePicker value={ef('mrFrom')} onChange={(v) => setEf('mrFrom', v)} max={ef('mrTo')} />
            </div>
            <div className="pd-form-row">
              <label>To</label>
              <DatePicker value={ef('mrTo')} onChange={(v) => setEf('mrTo', v)} min={ef('mrFrom')} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
