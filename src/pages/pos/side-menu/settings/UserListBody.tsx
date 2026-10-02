import { Search, X, Plus } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function UserListBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf, setUserListSelected, shownUsers, toast, userListSelected,
  } = ctx
  return (
    <>
      {entryModal === 'userList' ? (
        <>
          {/* One toolbar: search (filters as you type) · New User. */}
          <div className="lst-bar">
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('searchValue')}
                onChange={(e) => setEf('searchValue', e.target.value)}
                placeholder="Search name, code, role or login"
                autoFocus
              />
              {ef('searchValue') ? (
                <button type="button" onClick={() => setEf('searchValue', '')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <button type="button" className="lst-btn is-primary" onClick={() => toast('Add user — coming soon', 'info')}>
              <Plus size={14} />
              New User
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Login</th>
                </tr>
              </thead>
              <tbody>
                {shownUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No user matches this search</td>
                  </tr>
                ) : null}
                {shownUsers.map((u) => (
                  <tr
                    key={u.code}
                    className={userListSelected === u.code ? 'is-selected' : undefined}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setUserListSelected(u.code)}
                  >
                    <td>{u.code}</td>
                    <td>{u.name}</td>
                    <td>
                      <span className="lst-tag">{u.role}</span>
                    </td>
                    <td>{u.login}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
