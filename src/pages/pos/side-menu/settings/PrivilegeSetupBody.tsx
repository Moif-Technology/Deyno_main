import { Toggle } from '../../../../components/common/Toggle'
import { PRIVILEGE_PAGES } from '../../main/posHelpers'
import { type PosCtx } from '../../main/usePosMain'

export function PrivilegeSetupBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, privilegeChecks, setEf, setPrivilegeChecks, togglePrivilege, userListRows,
  } = ctx
  return (
    <>
      {entryModal === 'privilegeSetup' ? (
        <>
          <div className="prv-top">
            <div className="pd-form-row">
              <label>User</label>
              <select value={ef('privUser')} onChange={(e) => setEf('privUser', e.target.value)}>
                {userListRows.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="lst-btn"
              onClick={() =>
                setPrivilegeChecks(privilegeChecks.size === PRIVILEGE_PAGES.length ? new Set() : new Set(PRIVILEGE_PAGES))
              }
            >
              {privilegeChecks.size === PRIVILEGE_PAGES.length ? 'Remove all' : 'Allow all'}
            </button>
          </div>
          {/* One switch per page — on = the user can open it. */}
          <div className="prv-list">
            {PRIVILEGE_PAGES.map((page) => (
              <div key={page} className={`prv-row${privilegeChecks.has(page) ? ' is-on' : ''}`}>
                <span>{page === 'Main Page' ? page : `Menu · ${page}`}</span>
                <Toggle checked={privilegeChecks.has(page)} onChange={() => togglePrivilege(page)} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  )
}
