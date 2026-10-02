import { NumberPad } from '../../../../components/common/NumberPad'
import { money } from '../../main/posHelpers'
import { type PosCtx } from '../../main/usePosMain'

export function CashInOutBody2({ ctx }: { ctx: PosCtx }) {
  const {
    addCashMovement, cashDescs, cashMode, cashRows, cashTotals, ef, entryModal, onCashKey, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'cashInOut' && cashMode !== 'pick' ? (
        <div className={`cs2 is-${cashMode}`}>
          {/* Left: description · past descriptions · this type's entries */}
          <div className="cs2-left">
            <input
              className="csm-desc"
              value={ef('cashDesc')}
              onChange={(e) => setEf('cashDesc', e.target.value)}
              placeholder="Description"
              aria-label="Description"
              autoFocus
            />
            {cashDescs.length ? (
              <div className="cs2-chips">
                {cashDescs.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={ef('cashDesc') === d ? 'is-on' : undefined}
                    onClick={() => setEf('cashDesc', d)}
                    title={d}
                  >
                    {d}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="cs2-list">
              {cashRows.length === 0 ? (
                <p className="csh-empty">No {cashMode === 'in' ? 'cash in' : 'cash out'} entries yet</p>
              ) : (
                cashRows.map((r, i) => (
                  <div key={i} className="csh-row">
                    <span>{r.desc || '—'}</span>
                    <b>{money(r.amount)}</b>
                  </div>
                ))
              )}
            </div>
            <p className="cs2-total">
              Total {cashMode === 'in' ? 'cash in' : 'cash out'}{' '}
              <b>AED {money(cashRows.reduce((sum, r) => sum + r.amount, 0))}</b>
            </p>
          </div>

          {/* Right: amount · keypad · save */}
          <div className="cs2-right">
            <div className="csm-amount">
              <em>AED</em>
              <b>{ef('cashAmount') || '0'}</b>
            </div>
            <NumberPad className="csm-pad cs2-pad" keys={['0', '.', 'C']} onKey={onCashKey} />
            <button type="button" className="csh-save" onClick={() => void addCashMovement()}>
              Save {cashMode === 'in' ? 'Cash In' : 'Cash Out'}
            </button>
            <p className="csm-sum">
              Balance{' '}
              <b className={cashTotals.in - cashTotals.out < 0 ? 'is-neg' : undefined}>
                AED {money(cashTotals.in - cashTotals.out)}
              </b>
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
