import { MinusCircle, X, Users } from 'lucide-react'
import { decimal } from '../../../utils/validate'
import { money, KEYS } from '../main/posHelpers'
import { BtnIcon } from '../main/posWidgets'
import { type PosCtx } from '../main/usePosMain'

export function ItemCancelDialog({ ctx }: { ctx: PosCtx }) {
  const {
    cancelBusy, closeItemCancel, covers, itemCancelCoversDraft, itemCancelCoversOpen, itemCancelIds,
    itemCancelOpen, itemCancelQtyLine, itemCancelQtyNew, itemCancelQtyOpen, kotLabel,
    onItemCancelQtyDone, onItemCancelQtyKey, onItemRemoveClick, openItemCancelQty,
    saveItemCancelCovers, savedKotLines, setItemCancelCoversDraft, setItemCancelCoversOpen,
    setItemCancelIds, setItemCancelQtyNew, setItemCancelQtyOpen,
  } = ctx
  return (
    <>
      {itemCancelOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelBusy) closeItemCancel()
          }}
        >
          <div className="pd-ol-dialog pd-ol-wide pd-ic-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-ic-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <MinusCircle size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Item Remove</p>
                  <h2 id="pd-ic-title" className="pd-mod-item-name">
                    KOT {kotLabel}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={closeItemCancel}
                disabled={cancelBusy}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <p className="pd-ic-hint">Tap Qty to change quantity. Tick Remove, then Remove. You cannot remove the last item.</p>
              <div className="pd-ic-table-wrap">
                <table className="pd-grid pd-ic-grid">
                  <thead>
                    <tr>
                      <th>SL</th>
                      <th>KOT</th>
                      <th>Item Name</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                      <th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedKotLines().map((line, i) => {
                      const marked = Boolean(itemCancelIds[line.kotChildId])
                      return (
                        <tr key={line.kotChildId} className={marked ? 'is-marked' : ''}>
                          <td>{i + 1}</td>
                          <td>{kotLabel}</td>
                          <td>
                            <span className="pd-item-name">{line.item}</span>
                            {line.modifiers ? <span className="pd-item-mod">↳ {line.modifiers}</span> : null}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pd-ic-qty-btn"
                              disabled={cancelBusy}
                              onClick={() => openItemCancelQty(line)}
                            >
                              {line.qty}
                            </button>
                          </td>
                          <td className="num">{money(line.price)}</td>
                          <td className="num">{money(line.price * line.qty)}</td>
                          <td>
                            <button
                              type="button"
                              className={`pd-ic-check${marked ? ' is-on' : ''}`}
                              disabled={cancelBusy}
                              aria-pressed={marked}
                              onClick={() =>
                                setItemCancelIds((prev) => ({
                                  ...prev,
                                  [line.kotChildId]: !prev[line.kotChildId],
                                }))
                              }
                            >
                              {marked ? '✔' : ''}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="pd-mod-foot">
              <button
                type="button"
                className="pd-mod-foot-btn pd-ic-covers"
                disabled={cancelBusy}
                onClick={() => {
                  setItemCancelCoversDraft(String(covers > 0 ? covers : 1))
                  setItemCancelCoversOpen(true)
                }}
              >
                <BtnIcon icon={Users} />
                <span>{covers} covers</span>
              </button>
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                onClick={onItemRemoveClick}
                disabled={cancelBusy}
              >
                {cancelBusy ? 'Saving…' : 'Remove'}
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-close"
                onClick={closeItemCancel}
                disabled={cancelBusy}
              >
                Close
              </button>
            </div>

            {itemCancelQtyOpen && itemCancelQtyLine ? (
              <div className="pd-ic-qty-panel" role="dialog" aria-labelledby="pd-ic-qty-title">
                <p id="pd-ic-qty-title" className="pd-ic-qty-name">{itemCancelQtyLine.item}</p>
                <div className="pd-qty-body">
                  <div className="pd-qty-fields">
                    <div className="pd-qty-row">
                      <span>Current Qty</span>
                      <strong>{itemCancelQtyLine.qty}</strong>
                    </div>
                    <div className="pd-qty-row">
                      <span>New Qty</span>
                      <input
                        className="pd-qty-input"
                        value={itemCancelQtyNew}
                        onChange={(e) =>
                          setItemCancelQtyNew(decimal(e.target.value).slice(0, 8))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onItemCancelQtyDone()
                          if (e.key === 'Escape') setItemCancelQtyOpen(false)
                        }}
                        inputMode="decimal"
                        autoFocus
                        placeholder="Enter qty…"
                      />
                    </div>
                  </div>
                  <div className="pd-qty-pad">
                    <div className="pd-qty-keys">
                      {KEYS.map((k) => (
                        <button key={k} type="button" className="pd-key" onClick={() => onItemCancelQtyKey(k)}>
                          {k}
                        </button>
                      ))}
                    </div>
                    <div className="pd-qty-actions">
                      <button type="button" className="pd-qty-done" onClick={onItemCancelQtyDone} disabled={cancelBusy}>
                        Done
                      </button>
                      <button
                        type="button"
                        className="pd-qty-cancel"
                        onClick={() => {
                          setItemCancelQtyOpen(false)
                          setItemCancelQtyNew('')
                        }}
                        disabled={cancelBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {itemCancelCoversOpen ? (
              <div className="pd-ic-qty-panel pd-ic-covers-panel" role="dialog" aria-labelledby="pd-ic-pax-title">
                <p id="pd-ic-pax-title" className="pd-ic-qty-name">Enter No. of Persons</p>
                <p className="pd-covers-value">{itemCancelCoversDraft || '0'}</p>
                <div className="pd-covers-keys">
                  {KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="pd-key"
                      onClick={() => {
                        if (k === 'C') {
                          setItemCancelCoversDraft((prev) => prev.slice(0, -1))
                          return
                        }
                        if (k === '.') return
                        setItemCancelCoversDraft((prev) => (prev === '0' ? k : (prev + k).slice(0, 3)))
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={() => void saveItemCancelCovers()} disabled={cancelBusy}>
                    Ok
                  </button>
                  <button
                    type="button"
                    className="pd-qty-cancel"
                    onClick={() => setItemCancelCoversOpen(false)}
                    disabled={cancelBusy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
