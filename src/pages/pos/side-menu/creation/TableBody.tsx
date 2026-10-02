import { digits } from '../../../../utils/validate'
import { ArabicInput } from '../../../../components/common/ArabicInput'
import TableShapePicker from '../../TableShapePicker'
import { type PosCtx } from '../../main/usePosMain'

export function TableBody({ ctx }: { ctx: PosCtx }) {
  const {
    areas, ef, entryModal, entryWaiters, notifyTranslateDown, setEf, setEfWithArabicAutoFill,
  } = ctx
  return (
    <>
      {entryModal === 'table' ? (
        <div className="pd-te-grid">
        <div className="pd-te-fields">
          <div className="pd-form-row">
            <label>Area</label>
            <select value={ef('areaName')} onChange={(e) => setEf('areaName', e.target.value)}>
              <option value="">Select…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>Table No</label>
              <input value={ef('tableNo')} onChange={(e) => setEf('tableNo', digits(e.target.value))} />
            </div>
            <div className="pd-form-row">
              <label>No. of Chair</label>
              <input value={ef('noOfChairs')} onChange={(e) => setEf('noOfChairs', digits(e.target.value))} />
            </div>
          </div>
          <div className="pd-form-row">
            <label>Table Name</label>
            <input value={ef('tableName')} onChange={(e) => setEfWithArabicAutoFill('tableName', 'tableNameArabic', e.target.value)} />
          </div>
          <div className="pd-form-row">
            <label>Table Name Arabic</label>
            <ArabicInput value={ef('tableNameArabic')} onValueChange={(v) => setEf('tableNameArabic', v)} source={ef('tableName')} onTranslateError={notifyTranslateDown} />
          </div>
          <div className="pd-form-row">
            <label>Waiter Name</label>
            <select value={ef('waiterId')} onChange={(e) => setEf('waiterId', e.target.value)}>
              <option value="">Select…</option>
              {entryWaiters.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <TableShapePicker
          value={ef('tableShape')}
          onChange={(shape) => setEf('tableShape', shape)}
          chairs={Number(ef('noOfChairs')) || 0}
        />
        </div>
      ) : null}
    </>
  )
}
