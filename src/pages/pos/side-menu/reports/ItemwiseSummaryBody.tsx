import { DateRangePicker } from '../../../../components/common/DateRangePicker'
import { Toggle } from '../../../../components/common/Toggle'
import { type PosCtx } from '../../main/usePosMain'

export function ItemwiseSummaryBody({ ctx }: { ctx: PosCtx }) {
  const {
    allSubGroups, ef, efBool, entryModal, groups, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'itemwiseSummary' || entryModal === 'itemwiseDetails' ? (
        <div className="rpf">
          <div className="rpf-two">
            <div className="rpf-field">
              <span className="rpf-label">Group</span>
              <select className="rpf-input" value={ef('rGroup')} onChange={(e) => setEf('rGroup', e.target.value)}>
                <option value="">All Groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rpf-field">
              <span className="rpf-label">Sub Group</span>
              <select className="rpf-input" value={ef('rSubGroup')} onChange={(e) => setEf('rSubGroup', e.target.value)}>
                <option value="">All Sub Groups</option>
                {allSubGroups.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="rpf-field">
            <span className="rpf-label">Report date</span>
            <DateRangePicker
              from={ef('rFrom')}
              to={ef('rTo')}
              onChange={(from, to) => {
                setEf('rFrom', from)
                setEf('rTo', to)
              }}
            />
          </div>
          <div className="rpf-opt">
            <Toggle checked={efBool('rCashierWise')} onChange={(v) => setEf('rCashierWise', v)} label="Cashier Wise" />
            <Toggle checked={efBool('rReceiptPrinter')} onChange={(v) => setEf('rReceiptPrinter', v)} label="Receipt Printer" />
          </div>
        </div>
      ) : null}
    </>
  )
}
