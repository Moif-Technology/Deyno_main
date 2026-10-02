import { ShieldCheck, X } from 'lucide-react'
import { KEYS } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function AdminAuthDialog({ ctx }: { ctx: PosCtx }) {
  const {
    adminBusy, adminError, adminFocus, adminLogin, adminLoginRef, adminOpen, adminPassword,
    adminPasswordRef, closeAdminDialog, onAdminLoginKeyDown, onAdminPadKey, onAdminPasswordKeyDown,
    setAdminFocus, setAdminLogin, setAdminPassword, submitAdminLogin,
  } = ctx
  return (
    <>
      {adminOpen ? (
        <div
          className="pd-mod-overlay pd-admin-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !adminBusy) closeAdminDialog()
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true" aria-labelledby="pd-admin-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <ShieldCheck size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Admin Login</p>
                  <h2 id="pd-admin-title" className="pd-mod-item-name">
                    ADMIN / CHIEF CASHIER
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeAdminDialog} disabled={adminBusy} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <form
              className="pd-ol-body pd-admin-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submitAdminLogin()
              }}
            >
              <label className={`pd-admin-field${adminFocus === 'login' ? ' is-on' : ''}`}>
                <span>Login</span>
                <input
                  ref={adminLoginRef}
                  value={adminLogin}
                  onChange={(e) => setAdminLogin(e.target.value)}
                  onFocus={() => setAdminFocus('login')}
                  onKeyDown={onAdminLoginKeyDown}
                  disabled={adminBusy}
                  autoComplete="username"
                  enterKeyHint="next"
                />
              </label>
              <label className={`pd-admin-field${adminFocus === 'password' ? ' is-on' : ''}`}>
                <span>Password</span>
                <input
                  ref={adminPasswordRef}
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onFocus={() => setAdminFocus('password')}
                  onKeyDown={onAdminPasswordKeyDown}
                  disabled={adminBusy}
                  autoComplete="current-password"
                  enterKeyHint="done"
                />
              </label>
              {adminError ? <p className="pd-admin-err">{adminError}</p> : null}
              <div className="pd-admin-keys">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="pd-key"
                    disabled={adminBusy}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAdminPadKey(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="pd-mod-foot pd-admin-foot">
                <span className="pd-mod-foot-spacer" />
                <button type="submit" className="pd-mod-foot-btn is-ok" disabled={adminBusy}>
                  {adminBusy ? 'Checking…' : 'Login'}
                </button>
                <button type="button" className="pd-mod-foot-btn is-close" onClick={closeAdminDialog} disabled={adminBusy}>
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
