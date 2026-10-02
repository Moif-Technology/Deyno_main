import { SearchSelect } from '../../../../components/common/SearchSelect'
import { ArabicInput } from '../../../../components/common/ArabicInput'
import { Toggle } from '../../../../components/common/Toggle'
import { type PosCtx } from '../../main/usePosMain'

export function GroupBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, efBool, entryModal, groups, notifyTranslateDown, setEf, setEfWithArabicAutoFill,
  } = ctx
  return (
    <>
      {entryModal === 'group' ? (
        <>
          <div className="pd-form-row">
            <label>Master Group</label>
            <SearchSelect
              id="pd-grp-master"
              value={ef('grpMaster') || null}
              valueLabel={ef('grpMaster')}
              options={groups.map((g) => ({ id: g.name, name: g.name, code: g.code }))}
              onChange={(o) => setEf('grpMaster', o.name)}
              placeholder="Select master group"
              emptyText="No main groups yet"
            />
          </div>
          <div className="pd-form-row">
            <label>Group Name</label>
            <input value={ef('grpName')} onChange={(e) => setEfWithArabicAutoFill('grpName', 'grpNameArabic', e.target.value)} />
          </div>
          <div className="pd-form-row">
            <label>Group Name Arabic</label>
            <ArabicInput value={ef('grpNameArabic')} onValueChange={(v) => setEf('grpNameArabic', v)} source={ef('grpName')} onTranslateError={notifyTranslateDown} />
          </div>
          <Toggle
            checked={efBool('grpBackOfficeOnly')}
            onChange={(v) => setEf('grpBackOfficeOnly', v)}
            label="Show only on BackOffice"
          />
        </>
      ) : null}
    </>
  )
}
