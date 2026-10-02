import { StickyNote, X, Check } from 'lucide-react'
import { type PosCtx } from '../main/usePosMain'

export function KitchenMessageDialog({ ctx }: { ctx: PosCtx }) {
  const {
    applyModifier, closeModifierForm, modifierTextRef, modifiers, notesLine, notesOpen, notesText,
    setNotesText, toggleModifier,
  } = ctx
  return (
    <>
      {notesOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModifierForm()
          }}
        >
          <div
            className="pd-mod-dialog kmx"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-mod-title"
          >
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <StickyNote size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Kitchen Message</p>
                  <h2 id="pd-mod-title" className="pd-mod-item-name">
                    {notesLine?.item || '- - -'}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeModifierForm} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="kmx-body">
              {/* The message that goes to the kitchen */}
              <div className="kmx-box">
                <textarea
                  ref={modifierTextRef}
                  className="kmx-text"
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Type a message, or tap one below"
                  rows={2}
                />
                {notesText ? (
                  <button type="button" className="kmx-clear" onClick={() => setNotesText('')} aria-label="Clear message">
                    <X size={13} />
                  </button>
                ) : null}
              </div>

              {/* Quick messages — tap to add, tap again to remove */}
              <p className="kmx-title">
                Quick messages <em>{modifiers.length}</em>
              </p>
              <div className="kmx-grid">
                {modifiers.length === 0 ? (
                  <p className="kmx-empty">No quick messages on this branch</p>
                ) : (
                  (() => {
                    const picked = new Set(notesText.split(',').map((p) => p.trim()).filter(Boolean))
                    return modifiers.map((m, i) => (
                      <button
                        key={`${m.id}-${m.name}-${i}`}
                        type="button"
                        className={`kmx-chip${picked.has(m.name.trim()) ? ' is-on' : ''}`}
                        onClick={() => toggleModifier(m.name)}
                        title={m.name}
                      >
                        {picked.has(m.name.trim()) ? <Check size={13} strokeWidth={3} /> : null}
                        <span>{m.name}</span>
                      </button>
                    ))
                  })()
                )}
              </div>
            </div>
            <div className="pd-mod-foot">
              <button type="button" className="pd-mod-foot-btn is-close" onClick={closeModifierForm}>
                Cancel
              </button>
              <span className="pd-mod-foot-spacer" />
              <button type="button" className="pd-mod-foot-btn is-ok kmx-done" onClick={applyModifier}>
                <Check size={14} strokeWidth={2.6} /> Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
