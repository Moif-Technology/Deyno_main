/**
 * ConfirmDialog — the small white alert used for confirmations and notices:
 * icon, title, one-line message, Cancel + confirm button (or a single OK).
 * Escape, a click outside or ✕ cancels. Renders above any open modal.
 *
 * Styles: `.pd-alert-*` in pages/pos/posMain.css.
 *
 *   <ConfirmDialog
 *     open={askPost}
 *     title="Post this entry?"
 *     message="Stock will be updated and the entry can't be edited after posting."
 *     confirmLabel="Post"
 *     onConfirm={post}
 *     onCancel={() => setAskPost(false)}
 *   />
 */
import type { ReactNode } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'

export type ConfirmDialogProps = {
  open: boolean
  title: ReactNode
  message?: ReactNode
  /** Confirm button text. Default "Confirm", or "OK" when `mode` is 'ok'. */
  confirmLabel?: string
  cancelLabel?: string
  /** 'yesno' shows Cancel + confirm; 'ok' shows only the confirm button. */
  mode?: 'yesno' | 'ok'
  /** 'danger' uses the red style and a warning icon; focus starts on Cancel. */
  tone?: 'info' | 'danger'
  onConfirm: () => void
  /** Cancel, Escape, outside click or ✕. */
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  mode = 'yesno',
  tone = 'info',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  const danger = tone === 'danger'
  return (
    <div
      className="pd-alert-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div
        className={`pd-alert-box${danger ? ' is-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pd-alert-title"
        aria-describedby={message ? 'pd-alert-msg' : undefined}
      >
        <button type="button" className="pd-alert-x" onClick={onCancel} aria-label="Close">
          <X size={16} />
        </button>
        <div className="pd-alert-body">
          <span className="pd-alert-icon" aria-hidden="true">
            {danger ? <AlertTriangle size={22} /> : <Info size={22} />}
          </span>
          <div className="pd-alert-text">
            <h2 id="pd-alert-title" className="pd-alert-title">{title}</h2>
            {message ? <p id="pd-alert-msg" className="pd-alert-msg">{message}</p> : null}
          </div>
        </div>
        <div className="pd-alert-actions">
          {mode === 'yesno' ? (
            <button type="button" className="pd-alert-btn" autoFocus={danger} onClick={onCancel}>
              {cancelLabel}
            </button>
          ) : null}
          <button type="button" className="pd-alert-btn is-primary" autoFocus={!danger} onClick={onConfirm}>
            {confirmLabel ?? (mode === 'ok' ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
