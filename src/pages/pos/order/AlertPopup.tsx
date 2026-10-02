import { CheckCircle2, AlertTriangle, HelpCircle, Info } from 'lucide-react'
import { type PosCtx } from '../main/usePosMain'

export function AlertPopup({ ctx }: { ctx: PosCtx }) {
  const {
    alertBox, alertOkRef, closeAlert,
  } = ctx
  return (
    <>
      {alertBox ? (
        <div
          className={`pd-alert-overlay pd-alert-${alertBox.kind}`}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && alertBox.kind !== 'question') closeAlert(true)
          }}
        >
          <div className="pd-alert" role="alertdialog" aria-modal="true" aria-labelledby="pd-alert-title">
            <div className="pd-alert-icon" aria-hidden>
              {alertBox.kind === 'success' ? (
                <CheckCircle2 size={34} strokeWidth={2.2} />
              ) : alertBox.kind === 'warning' ? (
                <AlertTriangle size={34} strokeWidth={2.2} />
              ) : alertBox.kind === 'question' ? (
                <HelpCircle size={34} strokeWidth={2.2} />
              ) : (
                <Info size={34} strokeWidth={2.2} />
              )}
            </div>
            <p className="pd-alert-kicker">{alertBox.title}</p>
            <h2 id="pd-alert-title" className="pd-alert-msg">
              {alertBox.message}
            </h2>
            <div className="pd-alert-actions">
              {alertBox.kind === 'question' ? (
                <>
                  <button
                    ref={alertOkRef}
                    type="button"
                    className="pd-alert-btn is-yes"
                    onClick={() => closeAlert(true)}
                  >
                    Yes
                  </button>
                  <button type="button" className="pd-alert-btn is-no" onClick={() => closeAlert(false)}>
                    No
                  </button>
                </>
              ) : (
                <button
                  ref={alertOkRef}
                  type="button"
                  className="pd-alert-btn is-ok"
                  onClick={() => closeAlert(true)}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
