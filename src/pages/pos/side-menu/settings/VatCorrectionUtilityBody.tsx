import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { AlertTriangle } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function VatCorrectionUtilityBody({ ctx }: { ctx: PosCtx }) {
  const {
    deliveryZeroClear, ef, entryModal, salesVariationCorrection, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'vatCorrectionUtility' ? (
        <div className="vcu">
          <div className="pd-form-row">
            <label>Period</label>
            <DateRangePicker
              from={ef('vcFrom')}
              to={ef('vcTo')}
              onChange={(from, to) => {
                setEf('vcFrom', from)
                setEf('vcTo', to)
              }}
            />
          </div>

          <p className="vcu-warn">
            <AlertTriangle size={15} />
            <span>These tools change saved sales and purchase records for the period. Delete the triggers on Sales Child and Purchase Child first.</span>
          </p>

          <div className="vcu-tools">
            <div className="vcu-tool">
              <span>
                <b>Delivery Zero Clear</b>
                <small>Clears zero-value delivery entries in the period.</small>
              </span>
              <button type="button" className="lst-btn is-primary" onClick={deliveryZeroClear}>
                Run
              </button>
            </div>
            <div className="vcu-tool">
              <span>
                <b>Sales Variation Correction</b>
                <small>Recalculates sales totals that don't match their VAT.</small>
              </span>
              <button type="button" className="lst-btn is-primary" onClick={salesVariationCorrection}>
                Run
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
