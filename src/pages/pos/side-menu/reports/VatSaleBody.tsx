import { RadioCards } from '../../../../components/common/RadioCards'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { type PosCtx } from '../../main/usePosMain'

export function VatSaleBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'vatSale' ? (
        <div className="rpf">
          <div className="rpf-field">
            <span className="rpf-label">Report type</span>
            <RadioCards
              label="Report type"
              value={ef('rDetailMode')}
              options={[
                ['summary', 'Summary'],
                ['detailed', 'Detailed'],
              ]}
              onChange={(v) => setEf('rDetailMode', v)}
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
        </div>
      ) : null}
    </>
  )
}
