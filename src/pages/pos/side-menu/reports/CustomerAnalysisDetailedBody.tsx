import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Toggle } from '../../../../components/common/Toggle'
import { type PosCtx } from '../../main/usePosMain'

export function CustomerAnalysisDetailedBody({ ctx }: { ctx: PosCtx }) {
  const {
    areas, ef, efBool, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'customerAnalysisDetailed' || entryModal === 'customerAnalysisSummary' ? (
        <div className="rpf">
          <div className="rpf-field">
            <span className="rpf-label">Area</span>
            <div className="rpf-chips" role="radiogroup" aria-label="Area">
              {[{ id: 'ALL', name: '' }, ...areas].map((a) => {
                const on = (ef('rArea') || '') === a.name
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`rpf-chip${on ? ' is-on' : ''}`}
                    onClick={() => setEf('rArea', a.name)}
                  >
                    {a.id === 'ALL' ? 'All' : a.name}
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
          {entryModal === 'customerAnalysisSummary' ? (
            <div className="rpf-opt">
              <Toggle checked={efBool('rSummaryOnly')} onChange={(v) => setEf('rSummaryOnly', v)} label="Summary" />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
