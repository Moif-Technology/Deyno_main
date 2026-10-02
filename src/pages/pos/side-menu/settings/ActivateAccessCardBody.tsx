import { CreditCard } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function ActivateAccessCardBody({ ctx }: { ctx: PosCtx }) {
  const {
    entryModal, setUserListSelected, toggleCardFor, userListRows, userListSelected,
  } = ctx
  return (
    <>
      {entryModal === 'activateAccessCard' ? (
        <div className="acc">
          <p className="acc-hint">Pick an admin and tap <b>Activate</b>, then tap their access card on the reader. Double-tap a row to switch its card on or off.</p>
          <div className="acc-list" role="radiogroup" aria-label="Admins">
            {userListRows
              .filter((u) => u.role === 'ADMIN')
              .map((u) => {
                const active = u.card === 'Active'
                return (
                  <button
                    key={u.code}
                    type="button"
                    role="radio"
                    aria-checked={userListSelected === u.code}
                    className={`acc-row${userListSelected === u.code ? ' is-on' : ''}`}
                    onClick={() => setUserListSelected(u.code)}
                    onDoubleClick={() => toggleCardFor(u.code)}
                  >
                    <span className="acc-avatar" aria-hidden="true">
                      {u.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="acc-who">
                      <b>{u.name}</b>
                      <small>
                        Code {u.code} · Login {u.login}
                      </small>
                    </span>
                    <span className={`acc-status${active ? ' is-active' : ''}`}>
                      <CreditCard size={12} />
                      {active ? 'Card active' : 'No card'}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      ) : null}
    </>
  )
}
