import { SearchSelect } from '../../../../components/common/SearchSelect'
import { ArabicInput } from '../../../../components/common/ArabicInput'
import { type PosCtx } from '../../main/usePosMain'

export function SubGroupBody({ ctx }: { ctx: PosCtx }) {
  const {
    allSubGroups, ef, entryModal, notifyTranslateDown, setEf, setEfWithArabicAutoFill,
  } = ctx
  return (
    <>
      {entryModal === 'subGroup' ? (
        <>
          <div className="pd-form-row">
            <label>Group</label>
            <SearchSelect
              id="pd-sg-master"
              value={ef('sgMaster') || null}
              valueLabel={ef('sgMaster')}
              options={allSubGroups.map((s) => ({ id: s.name, name: s.name }))}
              onChange={(o) => setEf('sgMaster', o.name)}
              placeholder="Select group"
              emptyText="No groups yet"
            />
          </div>
          <div className="pd-form-row">
            <label>Sub Group Name</label>
            <input value={ef('sgName')} onChange={(e) => setEfWithArabicAutoFill('sgName', 'sgNameArabic', e.target.value)} />
          </div>
          <div className="pd-form-row">
            <label>Sub Group Name Arabic</label>
            <ArabicInput value={ef('sgNameArabic')} onValueChange={(v) => setEf('sgNameArabic', v)} source={ef('sgName')} onTranslateError={notifyTranslateDown} />
          </div>
        </>
      ) : null}
    </>
  )
}
