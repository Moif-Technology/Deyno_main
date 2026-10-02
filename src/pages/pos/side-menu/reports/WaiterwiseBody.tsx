import { RadioCards } from '../../../../components/common/RadioCards'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { type PosCtx } from '../../main/usePosMain'

export function WaiterwiseBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'waiterwise' ? (
        <div className="rpf">
          <div className="rpf-field">
            <span className="rpf-label">Waiter</span>
            <input className="rpf-input" placeholder="All" value={ef('rWaiterName')} onChange={(e) => setEf('rWaiterName', e.target.value)} />
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
          <div className="rpf-field">
            <span className="rpf-label">Report type</span>
            <RadioCards
              label="Report type"
              value={ef('rDetailMode')}
              options={[
                ['detailed', 'Detailed'],
                ['summary', 'Summary'],
              ]}
              onChange={(v) => setEf('rDetailMode', v)}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
