import { DatePicker } from '../../../../components/common/DatePicker'
import { digits } from '../../../../utils/validate'
import { type PosCtx } from '../../main/usePosMain'

export function BarcodeBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'barcode' ? (
        <>
          <div className="pd-form-row">
            <label>Product</label>
            <input value={ef('barcodeProduct')} onChange={(e) => setEf('barcodeProduct', e.target.value)} />
          </div>
          <div className="pd-form-row">
            <label>Text1</label>
            <input value={ef('barcodeText1')} onChange={(e) => setEf('barcodeText1', e.target.value)} />
          </div>
          <div className="pd-form-row">
            <label>Text2</label>
            <input value={ef('barcodeText2')} onChange={(e) => setEf('barcodeText2', e.target.value)} />
          </div>
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>Production Date</label>
              <DatePicker value={ef('productionDate')} onChange={(v) => setEf('productionDate', v)} />
            </div>
            <div className="pd-form-row">
              <label>Expiry Date</label>
              <DatePicker value={ef('expiryDate')} onChange={(v) => setEf('expiryDate', v)} min={ef('productionDate')} />
            </div>
          </div>
          <div className="pd-form-row">
            <label>Print Count</label>
            <input value={ef('printCount')} onChange={(e) => setEf('printCount', digits(e.target.value))} />
          </div>
        </>
      ) : null}
    </>
  )
}
