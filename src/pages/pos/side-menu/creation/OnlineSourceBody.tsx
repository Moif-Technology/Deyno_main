import { ArabicInput } from '../../../../components/common/ArabicInput'
import { type PosCtx } from '../../main/usePosMain'

export function OnlineSourceBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, notifyTranslateDown, setEf, setEfWithArabicAutoFill,
  } = ctx
  return (
    <>
      {entryModal === 'onlineSource' ? (
        <>
          <div className="pd-form-row">
            <label>Source Name</label>
            <input
              value={ef('sourceName')}
              onChange={(e) => setEfWithArabicAutoFill('sourceName', 'sourceNameArabic', e.target.value)}
            />
          </div>
          <div className="pd-form-row">
            <label>Source Name Arabic</label>
            <ArabicInput value={ef('sourceNameArabic')} onValueChange={(v) => setEf('sourceNameArabic', v)} source={ef('sourceName')} onTranslateError={notifyTranslateDown} />
          </div>
        </>
      ) : null}
    </>
  )
}
