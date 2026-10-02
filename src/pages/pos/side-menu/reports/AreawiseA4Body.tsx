import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Toggle } from '../../../../components/common/Toggle'
import { type PosCtx } from '../../main/usePosMain'

export function AreawiseA4Body({ ctx }: { ctx: PosCtx }) {
  const {
    areas, ef, efBool, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'areawiseA4' ? (
        <div className="rpf">
          <div className="rpf-field">
            <span className="rpf-label">Location</span>
            <div className="rpf-chips" role="radiogroup" aria-label="Location">
              {[{ id: 'ALL', name: 'ALL' }, ...areas].map((a) => {
                const on = (ef('rArea') || 'ALL') === a.name
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`rpf-chip${on ? ' is-on' : ''}`}
                    onClick={() => setEf('rArea', a.name)}
                  >
                    {a.name === 'ALL' ? 'All' : a.name}
                  </button>
                )
              })}
            </div>
          </div>
            <div className="rpf-field">
              <span className="rpf-label">Report date</span>
              <DateRangePicker
                from={ef('rFrom')}
                to={ef('rTo')}
                onChange={(from, to) => {
                  setEf('rFrom', from)
                  setEf('rTo', to)
                }}
              />
            </div>
          <div className="rpf-opt">
            <Toggle checked={efBool('rSummaryOnly')} onChange={(v) => setEf('rSummaryOnly', v)} label="Summary" />
          </div>
        </div>
      ) : null}
    </>
  )
}
