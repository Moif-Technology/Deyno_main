import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { type PosCtx } from '../../main/usePosMain'

export function DelBoyCommissionBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, groups, mrSelectedGroups, setEf, setMrSelectedGroups,
  } = ctx
  return (
    <>
      {entryModal === 'delBoyCommission' ? (
        <div className="rpf rpf-split">
          <div className="rpf">
            <div className="rpf-two">
              <div className="rpf-field">
                <span className="rpf-label">Delivery boy</span>
                <select className="rpf-input" value={ef('rDeliveryBoy')} onChange={(e) => setEf('rDeliveryBoy', e.target.value)}>
                  <option value="">Select…</option>
                </select>
              </div>
              <div className="rpf-field">
                <span className="rpf-label">Commission %</span>
                <div className="rpf-input rpf-static">{ef('rCommission') || '3.5'}</div>
              </div>
            </div>
            <div className="rpf-field">
              <span className="rpf-label">Sales date</span>
              <DateRangePicker
                from={ef('rFrom')}
                to={ef('rTo')}
                onChange={(from, to) => {
                  setEf('rFrom', from)
                  setEf('rTo', to)
                }}
              />
            </div>
          </div>
          <div className="rpf-field">
            <span className="rpf-label">
              Groups · {mrSelectedGroups.size} of {groups.length}
            </span>
            <div className="rpf-chips rpf-chips-tall">
              {groups.length === 0 ? (
                <p className="pd-cat-msg">No groups loaded</p>
              ) : (
                groups.map((g) => {
                  const on = mrSelectedGroups.has(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      className={`rpf-chip${on ? ' is-on' : ''}`}
                      onClick={() =>
                        setMrSelectedGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(g.id)) next.delete(g.id)
                          else next.add(g.id)
                          return next
                        })
                      }
                    >
                      {g.name}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
