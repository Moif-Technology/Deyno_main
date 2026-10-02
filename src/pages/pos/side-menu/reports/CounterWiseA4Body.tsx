import { digits } from '../../../../utils/validate'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Toggle } from '../../../../components/common/Toggle'
import { type PosCtx } from '../../main/usePosMain'

export function CounterWiseA4Body({ ctx }: { ctx: PosCtx }) {
  const {
    ef, efBool, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'counterWiseA4' || entryModal === 'counterWiseTimewise' ? (
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
          {entryModal === 'counterWiseTimewise' ? (
            <div className="rpf-two">
              <div className="rpf-field">
                <span className="rpf-label">From time</span>
                <input className="rpf-input" value={ef('rFromTime') || '5:00:00 AM'} onChange={(e) => setEf('rFromTime', e.target.value)} />
              </div>
              <div className="rpf-field">
                <span className="rpf-label">To time</span>
                <input className="rpf-input" value={ef('rToTime') || '5:00:00 AM'} onChange={(e) => setEf('rToTime', e.target.value)} />
              </div>
            </div>
          ) : null}
          <div className="rpf-opt">
            <Toggle checked={efBool('rSummaryOnly')} onChange={(v) => setEf('rSummaryOnly', v)} label="Sales Summary Only" />
            <Toggle checked={efBool('rCashierWise')} onChange={(v) => setEf('rCashierWise', v)} label="Cashier Wise" />
            <Toggle checked={efBool('rCounterOnly')} onChange={(v) => setEf('rCounterOnly', v)} label="Counter Only" />
          </div>
        </div>
      ) : null}
    </>
  )
}
