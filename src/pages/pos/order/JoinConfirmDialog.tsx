import { Merge, X, ArrowRight } from 'lucide-react'
import { digits } from '../../../utils/validate'
import { money } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function JoinConfirmDialog({ ctx }: { ctx: PosCtx }) {
  const {
    cancelDragJoin, dragJoinBusy, dragJoinConfirm, dragJoinPlan, runDragJoin, setDragJoinPlan,
  } = ctx
  return (
    <>
      {dragJoinConfirm && dragJoinPlan ? (
        <div className="pd-mod-overlay pd-olm-join-ol" role="presentation">
          <div className="pd-ol-dialog pd-ol-narrow pd-olm-join" role="dialog" aria-modal="true" aria-labelledby="pd-olm-join-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Merge size={15} strokeWidth={2} />
                </div>
                <div>
                  <p className="pd-mod-kicker">KOT Join</p>
                  <h2 id="pd-olm-join-title" className="pd-mod-item-name">
                    Join {dragJoinPlan.source.kotNo} into {dragJoinPlan.target.kotNo}?
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={cancelDragJoin} aria-label="Close" disabled={dragJoinBusy}>
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <div className="pd-olm-join-pair">
                <div>
                  <span>Move</span>
                  <strong>{dragJoinPlan.source.kotNo}</strong>
                  <small>
                    {dragJoinPlan.source.areaName} · AED {money(dragJoinPlan.source.amount)}
                  </small>
                </div>
                <ArrowRight size={18} strokeWidth={2.4} />
                <div>
                  <span>Into</span>
                  <strong>{dragJoinPlan.target.kotNo}</strong>
                  <small>
                    {dragJoinPlan.target.areaName}
                    {dragJoinPlan.target.tableName ? ` · ${dragJoinPlan.target.tableName}` : ''} · AED{' '}
                    {money(dragJoinPlan.target.amount)}
                  </small>
                </div>
              </div>
              <div className="pd-form-row">
                <label>Guests (pax) after join</label>
                <input
                  inputMode="numeric"
                  value={dragJoinPlan.pax}
                  onChange={(e) =>
                    setDragJoinPlan((p) => (p ? { ...p, pax: digits(e.target.value, 4) } : p))
                  }
                  autoFocus
                />
              </div>
              <p className="pd-mfg-count">
                All items of {dragJoinPlan.source.kotNo} move to {dragJoinPlan.target.kotNo}, and{' '}
                {dragJoinPlan.source.kotNo} is closed.
              </p>
            </div>
            <div className="pd-mod-foot">
              <span className="pd-mod-foot-spacer" />
              <button type="button" className="pd-mod-foot-btn" onClick={cancelDragJoin} disabled={dragJoinBusy}>
                Cancel
              </button>
              <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void runDragJoin()} disabled={dragJoinBusy}>
                {dragJoinBusy ? 'Joining…' : 'Join KOT'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
