import { GlobalSearch } from '../../../components/common/GlobalSearch'
import { clearStaffSession } from '../../../utils/pinLoginSession'
import { LogOut } from 'lucide-react'
import { NAV } from '../main/posMenu'
import { type PosCtx } from '../main/usePosMain'

export function SideMenu({ ctx }: { ctx: PosCtx }) {
  const {
    buildSearchItems, navSearchRef, navSearching, navigate, renderNavItem, setNavSearching,
    setSideNavHidden, sideNavHidden,
  } = ctx
  return (
    <>
      {sideNavHidden ? null : (
        <>
          <div className="pd-side-nav-backdrop" onClick={() => setSideNavHidden(true)} />
          <nav className={`pd-side-nav${navSearching ? ' is-searching' : ''}`}>
            <GlobalSearch
              className="pd-side-search"
              inputRef={navSearchRef}
              items={buildSearchItems()}
              placeholder="Search"
              limits={{ Menu: 8 }}
              onQueryChange={(q) => setNavSearching(Boolean(q.trim()))}
              onPicked={() => {
                setNavSearching(false)
                setSideNavHidden(true)
              }}
            />
            {navSearching ? null : NAV.map((item) => renderNavItem(item))}
            {navSearching ? null : <div className="pd-side-spacer" aria-hidden />}
            {navSearching ? null : (
              <div className="pd-side-nav-wrap pd-side-logout-wrap">
                <button
                  type="button"
                  className="pd-side-nav-btn pd-side-logout"
                  onClick={() => {
                    clearStaffSession()
                    navigate('/')
                  }}
                >
                  <LogOut size={18} strokeWidth={2} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </nav>
        </>
      )}
    </>
  )
}
