import { RadioCards } from '../../../../components/common/RadioCards'
import { digits } from '../../../../utils/validate'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { type PosCtx } from '../../main/usePosMain'

export function GraphReportBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'graphReport' ? (
        <div className="rpf">
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
          <div className="rpf-field">
            <span className="rpf-label">Report by</span>
            <RadioCards
              label="Report by"
              value={ef('rReportBy') || 'Hour'}
              options={[
                ['Hour', 'Hour'],
                ['Day', 'Day'],
                ['Month', 'Month'],
              ]}
              onChange={(v) => setEf('rReportBy', v)}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
