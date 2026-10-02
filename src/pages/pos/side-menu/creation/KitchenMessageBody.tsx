import { MessageSquare, Trash2, Plus, Check } from 'lucide-react'
import { ArabicInput } from '../../../../components/common/ArabicInput'
import { type PosCtx } from '../../main/usePosMain'

export function KitchenMessageBody({ ctx }: { ctx: PosCtx }) {
  const {
    deleteKitchenMessage, ef, entryModal, kitchenMessages, kitchenMsgSelected, notifyTranslateDown,
    saveKitchenMessage, setEf, setEfWithArabicAutoFill, setKitchenMessages, setKitchenMsgSelected,
  } = ctx
  return (
    <>
      {entryModal === 'kitchenMessage' ? (
        <div className="pd-nt">
          {/* Pad: write / edit a message (same look as Note Entry) */}
          <div className={`pd-nt-pad${kitchenMsgSelected != null ? ' is-editing' : ''}`}>
            <div className="pd-nt-pad-top">
              <span>
                <MessageSquare size={14} />
                {kitchenMsgSelected != null ? 'Editing message' : 'New message'}
              </span>
              {kitchenMsgSelected != null ? (
                <span className="pd-nt-pad-actions">
                  <button type="button" className="pd-nt-new is-danger" onClick={deleteKitchenMessage}>
                    <Trash2 size={13} /> Delete
                  </button>
                  <button
                    type="button"
                    className="pd-nt-new"
                    onClick={() => {
                      setKitchenMsgSelected(null)
                      setEf('kmMessage', '')
                      setEf('kmArabic', '')
                    }}
                  >
                    <Plus size={13} /> New
                  </button>
                </span>
              ) : null}
            </div>
            <div className="pd-km-fields">
              <input
                placeholder="Kitchen message…"
                value={ef('kmMessage')}
                autoFocus
                onChange={(e) => setEfWithArabicAutoFill('kmMessage', 'kmArabic', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveKitchenMessage()
                }}
              />
              <ArabicInput
                placeholder="الرسالة بالعربية"
                value={ef('kmArabic')}
                onValueChange={(v) => setEf('kmArabic', v)}
                source={ef('kmMessage')}
                onTranslateError={notifyTranslateDown}
              />
            </div>
            <div className="pd-nt-pad-foot">
              <small>Arabic fills in automatically — you can edit it.</small>
              <button type="button" className="pd-nt-save" disabled={!ef('kmMessage').trim()} onClick={saveKitchenMessage}>
                <Check size={14} strokeWidth={2.6} /> {kitchenMsgSelected != null ? 'Update' : 'Save'}
              </button>
            </div>
          </div>

          <div className="pd-nt-bar">
            <b>
              Messages <em>{kitchenMessages.length}</em>
            </b>
          </div>

          {/* Board: saved messages — tap one to edit */}
          <div className="pd-nt-board">
            {kitchenMessages.length === 0 ? (
              <div className="pd-nt-empty">
                <MessageSquare size={26} strokeWidth={1.6} />
                <span>No kitchen messages yet — write your first one above.</span>
              </div>
            ) : (
              kitchenMessages.map((m) => {
                const pick = () => {
                  setKitchenMsgSelected(m.id)
                  setEf('kmMessage', m.message)
                  setEf('kmArabic', m.arabic)
                }
                return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    className={`pd-nt-card${kitchenMsgSelected === m.id ? ' is-on' : ''}`}
                    onClick={pick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') pick()
                    }}
                  >
                    <button
                      type="button"
                      className="pd-nt-del"
                      aria-label="Delete message"
                      title="Delete message"
                      onClick={(e) => {
                        e.stopPropagation()
                        setKitchenMessages((prev) => prev.filter((x) => x.id !== m.id))
                        if (kitchenMsgSelected === m.id) {
                          setKitchenMsgSelected(null)
                          setEf('kmMessage', '')
                          setEf('kmArabic', '')
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                    <span className="pd-nt-text">{m.message}</span>
                    {m.arabic ? (
                      <span className="pd-km-ar" dir="rtl">
                        {m.arabic}
                      </span>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
