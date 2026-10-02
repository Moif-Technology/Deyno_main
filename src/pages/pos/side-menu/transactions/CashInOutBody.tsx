import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function CashInOutBody({ ctx }: { ctx: PosCtx }) {
  const {
    cashMode, entryModal, openCashMode,
  } = ctx
  return (
    <>
      {entryModal === 'cashInOut' && cashMode === 'pick' ? (
        <div className="csh-pick">
          <button type="button" className="csh-pick-card is-in" onClick={() => openCashMode('in')}>
            <span className="csh-pick-ic">
              <ArrowDownToLine size={22} />
            </span>
            <b>Cash In</b>
            <small>Money put into the drawer</small>
          </button>
          <button type="button" className="csh-pick-card is-out" onClick={() => openCashMode('out')}>
            <span className="csh-pick-ic">
              <ArrowUpFromLine size={22} />
            </span>
            <b>Cash Out</b>
            <small>Money taken out of the drawer</small>
          </button>
        </div>
      ) : null}
    </>
  )
}
