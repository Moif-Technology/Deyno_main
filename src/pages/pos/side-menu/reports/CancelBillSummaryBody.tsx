import { digits } from '../../../../utils/validate'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { type PosCtx } from '../../main/usePosMain'

export function CancelBillSummaryBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'cancelBillSummary' ||
      entryModal === 'salesBillWiseRP' ||
      entryModal === 'dayWiseRP' ||
      entryModal === 'taxReport' ||
      entryModal === 'counterCloseDetailsA4' ||
      entryModal === 'incomeExpense' ||
      entryModal === 'productionReport' ? (
        <div className="rpf">
          {entryModal === 'counterCloseDetailsA4' || entryModal === 'incomeExpense' || entryModal === 'productionReport' ? (
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
                <span className="rpf-label">Cashier Name</span>
                <input
                  className="rpf-input"
                  placeholder="All"
                  value={ef('rCashierName')}
                  onChange={(e) => setEf('rCashierName', e.target.value)}
                />
              </div>
            </div>
          ) : null}
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
