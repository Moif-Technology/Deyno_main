import { type PosCtx } from '../../main/usePosMain'

export function StockReportBody({ ctx }: { ctx: PosCtx }) {
  const {
    allSubGroups, ef, entryModal, groups, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'stockReport' ? (
        <>
          <div className="pd-form-row">
            <label>Group</label>
            <select value={ef('srGroup')} onChange={(e) => setEf('srGroup', e.target.value)}>
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="pd-form-row">
            <label>SubGroup</label>
            <select value={ef('srSubGroup')} onChange={(e) => setEf('srSubGroup', e.target.value)}>
              <option value="">All Sub Groups</option>
              {allSubGroups.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="pd-form-row">
            <label>Product Type</label>
            <select value={ef('srProductType')} onChange={(e) => setEf('srProductType', e.target.value)}>
              <option value="">All</option>
              <option value="NORMAL">NORMAL</option>
              <option value="COMBO">COMBO</option>
            </select>
          </div>
        </>
      ) : null}
    </>
  )
}
