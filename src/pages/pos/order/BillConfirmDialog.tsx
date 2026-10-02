import { Ban, X } from 'lucide-react'
import { type PosCtx } from '../main/usePosMain'

export function BillConfirmDialog({ ctx }: { ctx: PosCtx }) {
  const {
    adminCreds, billConfirmOpen, cancelBusy, kotLabel, runBillCancel, setBillConfirmOpen,
  } = ctx
  return (
    <>
      {billConfirmOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelBusy) setBillConfirmOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Ban size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">KOT Cancel</p>
                  <h2 className="pd-mod-item-name">KOT {kotLabel}</h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => setBillConfirmOpen(false)}
                disabled={cancelBusy}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <p className="pd-confirm-msg">Are You Sure to Cancel KOT........</p>
            </div>
            <div className="pd-mod-foot">
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                onClick={() => void runBillCancel(adminCreds)}
                disabled={cancelBusy}
              >
                {cancelBusy ? 'Cancelling…' : 'Yes'}
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-close"
                onClick={() => setBillConfirmOpen(false)}
                disabled={cancelBusy}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
