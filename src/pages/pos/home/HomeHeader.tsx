import { Menu as MenuIcon, X, LogOut } from 'lucide-react'
import { clearStaffSession } from '../../../utils/pinLoginSession'
import { type PosCtx } from '../main/usePosMain'

export function HomeHeader({ ctx }: { ctx: PosCtx }) {
  const {
    counter, navigate, setSideNavHidden, sideNavHidden, waiter,
  } = ctx
  return (
    <>
      <header className="pd-header pd-header-slim">
        <button
          type="button"
          className="pd-nav-toggle"
          title={sideNavHidden ? 'Show menu' : 'Hide menu'}
          onClick={() => setSideNavHidden((v) => !v)}
        >
          {sideNavHidden ? <MenuIcon size={18} /> : <X size={18} />}
        </button>
        <div className="pd-logo">
          <img src="/logo-white.png" alt="Deyno" className="pd-logo-img" />
          <span>PRO</span>
        </div>
        <div className="pd-header-right">
          <div className="pd-user">
            <strong>{waiter.toUpperCase()}</strong>
            <small>{counter}</small>
          </div>
          <button
            type="button"
            className="pd-power"
            title="Logout"
            onClick={() => {
              clearStaffSession()
              navigate('/')
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>
    </>
  )
}
