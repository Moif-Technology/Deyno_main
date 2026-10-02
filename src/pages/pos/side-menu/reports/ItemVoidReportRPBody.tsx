import { digits } from '../../../../utils/validate'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { type PosCtx } from '../../main/usePosMain'

export function ItemVoidReportRPBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'itemVoidReportRP' || entryModal === 'itemVoidA4' || entryModal === 'salesmanWise' ? (
        <div className="rpf">
          <div className={entryModal === 'salesmanWise' ? 'rpf-two' : undefined}>
            {entryModal === 'salesmanWise' ? (
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
            ) : null}
            <div className="rpf-field">
              <span className="rpf-label">{entryModal === 'salesmanWise' ? 'Salesman Name' : 'Cashier Name'}</span>
              <input
                className="rpf-input"
                value={ef('rCashierName')}
                onChange={(e) => setEf('rCashierName', e.target.value)}
                placeholder="All"
              />
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
        </div>
      ) : null}
    </>
  )
}
