import { ArabicInput } from '../../../../components/common/ArabicInput'
import { Toggle } from '../../../../components/common/Toggle'
import { type PosCtx } from '../../main/usePosMain'

export function AreaBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, efBool, entryModal, notifyTranslateDown, setEf, setEfWithArabicAutoFill,
  } = ctx
  return (
    <>
      {entryModal === 'area' ? (
        <>
          <div className="pd-form-row">
            <label>Area Name</label>
            <input
              value={ef('areaName')}
              onChange={(e) => setEfWithArabicAutoFill('areaName', 'areaNameArabic', e.target.value)}
              placeholder="e.g. DINE IN"
            />
          </div>
          <div className="pd-form-row">
            <label>Area Name Arabic</label>
            <ArabicInput value={ef('areaNameArabic')} onValueChange={(v) => setEf('areaNameArabic', v)} source={ef('areaName')} onTranslateError={notifyTranslateDown} />
          </div>
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>Supply Type</label>
              <select value={ef('supplyType')} onChange={(e) => setEf('supplyType', e.target.value)}>
                <option value="">Select…</option>
                <option value="DINE IN">DINE IN</option>
                <option value="TAKEAWAY">TAKEAWAY</option>
                <option value="DELIVERY">DELIVERY</option>
                <option value="PARCEL">PARCEL</option>
              </select>
            </div>
            <div className="pd-form-row">
              <label>Prefix</label>
              <input value={ef('prefix')} onChange={(e) => setEf('prefix', e.target.value)} />
            </div>
          </div>
          <div className="pd-form-row">
            <label>Price Type</label>
            <select value={ef('priceType')} onChange={(e) => setEf('priceType', e.target.value)}>
              <option value="">Select…</option>
              <option value="RETAIL">RETAIL</option>
              <option value="WHOLESALE">WHOLESALE</option>
            </select>
          </div>
          <div className="pd-form-row">
            <label>Table Creation Type</label>
            <div className="pd-entry-radio-row">
              <label className="pd-entry-radio">
                <input
                  type="radio"
                  name="tableCreationType"
                  checked={ef('tableCreationType') === 'manual'}
                  onChange={() => setEf('tableCreationType', 'manual')}
                />
                Manual
              </label>
              <label className="pd-entry-radio">
                <input
                  type="radio"
                  name="tableCreationType"
                  checked={ef('tableCreationType') === 'automatic'}
                  onChange={() => setEf('tableCreationType', 'automatic')}
                />
                Automatic
              </label>
            </div>
          </div>
          <Toggle checked={efBool('showOnTablet')} onChange={(v) => setEf('showOnTablet', v)} label="Show on Tablet" />
        </>
      ) : null}
    </>
  )
}
