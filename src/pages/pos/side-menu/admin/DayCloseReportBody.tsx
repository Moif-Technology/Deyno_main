import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { FileText } from 'lucide-react'
import { dayCloseLabel } from '../../main/posHelpers'
import { type PosCtx } from '../../main/usePosMain'

export function DayCloseReportBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'dayCloseReport' ? (
        <div className="dcr">
          <div className="pd-form-row">
            <label>Report period</label>
            <DateRangePicker
              from={ef('rFrom')}
              to={ef('rTo')}
              onChange={(from, to) => {
                setEf('rFrom', from)
                setEf('rTo', to)
              }}
            />
          </div>
          <div className="dcr-summary">
            <FileText size={18} />
            <span>
              <small>Day close report for</small>
              <b>{dayCloseLabel(ef('rFrom'), ef('rTo'))}</b>
            </span>
          </div>
        </div>
      ) : null}
    </>
  )
}
