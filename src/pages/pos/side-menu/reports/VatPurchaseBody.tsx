import { RadioCards } from '../../../../components/common/RadioCards'
import { X } from 'lucide-react'
import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { type PosCtx } from '../../main/usePosMain'

export function VatPurchaseBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'vatPurchase' ? (
        <div className="rpf">
          <div className="rpf-field">
            <span className="rpf-label">Supplier name</span>
            <span className="lst-search rpf-clearable">
              <input
                value={ef('rSupplier')}
                onChange={(e) => setEf('rSupplier', e.target.value)}
                placeholder="All suppliers"
                autoFocus
              />
              {ef('rSupplier') ? (
                <button type="button" onClick={() => setEf('rSupplier', '')} aria-label="Clear supplier">
                  <X size={12} />
                </button>
              ) : null}
            </span>
          </div>
          <div className="rpf-field">
            <span className="rpf-label">Show</span>
            <RadioCards
              label="Show"
              value={ef('rPurchaseType') || 'ALL'}
              options={[
                ['ALL', 'All'],
                ['PURCHASE', 'Purchase'],
                ['RETURN', 'Return'],
              ]}
              onChange={(v) => setEf('rPurchaseType', v)}
            />
          </div>
          <div className="rpf-field">
            <span className="rpf-label">Purchase date</span>
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
