import { RadioCards } from '../../../../components/common/RadioCards'
import { digits } from '../../../../utils/validate'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Toggle } from '../../../../components/common/Toggle'
import { type PosCtx } from '../../main/usePosMain'

export function AreaWiseReportRPBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, efBool, entryModal, groups, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'areaWiseReportRP' || entryModal === 'groupWiseRP' || entryModal === 'itemWiseRP' ? (
        <div className="rpf">
          {entryModal === 'itemWiseRP' ? (
            <div className="rpf-two">
              <div className="rpf-field">
                <span className="rpf-label">Counter No</span>
                <input
                  className="rpf-input"
                  inputMode="numeric"
                  placeholder="All"
                  value={ef('rCounterNo')}
                  onChange={(e) => setEf('rCounterNo', digits(e.target.value, 6))}
                />
              </div>
              <div className="rpf-field">
                <span className="rpf-label">Group</span>
                <select className="rpf-input" value={ef('rGroup')} onChange={(e) => setEf('rGroup', e.target.value)}>
                  <option value="">All Groups</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <div className="rpf-field">
            <span className="rpf-label">Report by</span>
            <RadioCards
              label="Report by"
              value={ef('rMode')}
              options={[
                ['date', 'Date'],
                ['counterClose', 'Counter Close No'],
              ]}
              onChange={(v) => setEf('rMode', v)}
            />
          </div>
          {ef('rMode') === 'counterClose' ? (
            <div className="rpf-field">
              <span className="rpf-label">Counter Close No</span>
              <input
                className="rpf-input"
                inputMode="numeric"
                placeholder="Enter counter close no"
                autoFocus
                value={ef('rCounterCloseNo')}
                onChange={(e) => setEf('rCounterCloseNo', digits(e.target.value, 6))}
              />
            </div>
          ) : (
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
          )}
          <div className="rpf-opt">
            <Toggle checked={efBool('rCounterCloseWise')} onChange={(v) => setEf('rCounterCloseWise', v)} label="Counter Close Wise" />
          </div>
        </div>
      ) : null}
    </>
  )
}
