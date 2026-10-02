import { percent, decimal } from '../../../../utils/validate'
import { NumberPad } from '../../../../components/common/NumberPad'
import { money } from '../../main/posHelpers'
import { type PosCtx } from '../../main/usePosMain'

export function ChangeDiscountPercentBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, saveDiscountPercent, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'changeDiscountPercent' ? (
        (() => {
          const total = Number(ef('cdpTotal')) || 0
          const pct = Math.min(100, Number(ef('cdpPercent')) || 0)
          const disc = (total * pct) / 100
          const field = ef('cdpField') === 'total' ? 'cdpTotal' : 'cdpPercent'
          const press = (k: string) => {
            const cur = ef(field)
            if (k === 'C') setEf(field, cur.slice(0, -1))
            else if (!(k === '.' && cur.includes('.')))
              setEf(field, field === 'cdpPercent' ? percent(cur + k) : decimal(cur + k).slice(0, 10))
          }
          return (
            <div className="cdp">
              {/* Left: amount · % · quick % · result */}
              <div className="cdp-left">
                <label className={`cdp-field${field === 'cdpTotal' ? ' is-on' : ''}`}>
                  <span>Total Amount</span>
                  <div>
                    <em>AED</em>
                    <input
                      value={ef('cdpTotal')}
                      inputMode="none"
                      placeholder="0.00"
                      onFocus={() => setEf('cdpField', 'total')}
                      onChange={(e) => setEf('cdpTotal', decimal(e.target.value))}
                    />
                  </div>
                </label>
                <label className={`cdp-field${field === 'cdpPercent' ? ' is-on' : ''}`}>
                  <span>Discount %</span>
                  <div>
                    <input
                      value={ef('cdpPercent')}
                      inputMode="none"
                      placeholder="0"
                      autoFocus
                      onFocus={() => setEf('cdpField', 'percent')}
                      onChange={(e) => setEf('cdpPercent', percent(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveDiscountPercent()
                      }}
                    />
                    <em>%</em>
                  </div>
                </label>
                <div className="cdp-quick">
                  {[5, 10, 15, 20, 25, 50].map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={pct === q ? 'is-on' : undefined}
                      onClick={() => {
                        setEf('cdpPercent', String(q))
                        setEf('cdpField', 'percent')
                      }}
                    >
                      {q}%
                    </button>
                  ))}
                </div>
                <dl className="cdp-result">
                  <div>
                    <dt>Discount</dt>
                    <dd>AED {money(disc)}</dd>
                  </div>
                  <div className="is-net">
                    <dt>Net Amount</dt>
                    <dd>AED {money(total - disc)}</dd>
                  </div>
                </dl>
              </div>
              {/* Right: shared keypad, types into the highlighted field */}
              <NumberPad className="cdp-pad" onKey={press} />
            </div>
          )
        })()
      ) : null}
    </>
  )
}
