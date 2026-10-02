import {
  Users,
  User,
  ChevronDown,
  Trash2,
  SeparatorHorizontal,
  Utensils,
  ShoppingBag,
  Truck,
  Plus,
} from 'lucide-react'
import { money, round2, areaSupplyIcon, flpAreaTone } from '../main/posHelpers'
import { BtnIcon } from '../main/posWidgets'
import { type PosCtx } from '../main/usePosMain'

export function OrderPanel({ ctx }: { ctx: PosCtx }) {
  const {
    areaButtonClick, areaId, clearData, covers, currentKotId, customerName, deleteLine,
    deleteSelectedLines, deliveryClick, deliveryPickerTimer, flpAreas, gridWrapRef, kotLabel, lines,
    loadCustomers, onServiceClick, openCustomerSelect, openOrderListFor, openQtyChange,
    openRowMenuAt, selectedKeys, selectedLine, separatorAfterKeys, service, setCustomerOpen,
    setSelectedKeys, setSelectedLine, summary, toggleLineSelect, toggleSeparatorAfterSelected,
  } = ctx
  return (
    <>
      <section className="pd-panel">
        <div className="pd-order-head">
          <h1>{currentKotId > 0 ? 'Open KOT' : 'Order'} #{kotLabel}</h1>
          <div className="pd-meta">
            {/* Covers is display only — it is set when a table is picked. */}
            <span className="pd-meta-btn is-covers is-static" title="Number of persons">
              <span className="pd-pill-icon"><Users size={10} /></span>
              <span className="pd-meta-text">
              {covers} {covers === 1 ? 'Cover' : 'Covers'}
              </span>
            </span>
            <button
              type="button"
              className="pd-meta-btn is-customer"
              title={customerName || 'Cash Customer'}
              onClick={() => {
                setCustomerOpen(true)
                void loadCustomers()
              }}
            >
              <span className="pd-pill-icon"><User size={10} /></span>
              <span className="pd-meta-text">{customerName || 'Cash Customer'}</span>
              <ChevronDown size={11} className="pd-pill-chevron" />
            </button>
          </div>
        </div>

        {selectedKeys.size > 0 ? (
          <div className="pd-select-bar">
            <span>{selectedKeys.size} selected</span>
            <button type="button" className="pd-select-bar-cancel" onClick={() => setSelectedKeys(new Set())}>
              Cancel
            </button>
            <button type="button" className="pd-select-bar-delete" onClick={deleteSelectedLines}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        ) : null}

        <div className="pd-grid-wrap" ref={gridWrapRef}>
          <table className="pd-grid">
            <thead>
              <tr>
                <th className="col-no">
                  {selectedKeys.size > 0 ? (
                    <input
                      type="checkbox"
                      className="pd-row-check"
                      aria-label="Select all"
                      checked={lines.length > 0 && lines.every((l) => selectedKeys.has(l.key))}
                      onChange={() =>
                        setSelectedKeys((prev) =>
                          prev.size === lines.length ? new Set() : new Set(lines.map((l) => l.key)),
                        )
                      }
                    />
                  ) : (
                    '#'
                  )}
                </th>
                <th className="col-item">Item</th>
                <th className="col-qty num">Qty</th>
                <th className="col-money num">Price</th>
                <th className="col-money num">Disc</th>
                <th className="col-money num">Tax</th>
                <th className="col-money num">Total</th>
                <th className="col-menu" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr className="pd-empty-row">
                  <td colSpan={8}>
                    <div className="pd-empty-state">
                      <img src="/logo-dark.png" alt="" className="pd-empty-logo" />
                    </div>
                  </td>
                </tr>
              ) : (
                lines.flatMap((line, i) => {
                  const row = (
                  <tr
                    key={line.key}
                    className={selectedLine === line.key ? 'is-selected' : undefined}
                    onClick={() => setSelectedLine(line.key)}
                    onDoubleClick={(e) => {
                      setSelectedLine(line.key)
                      openRowMenuAt(e.clientX, e.clientY, line.key)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setSelectedLine(line.key)
                      openRowMenuAt(e.clientX, e.clientY, line.key)
                    }}
                  >
                    <td
                      className="col-no"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleLineSelect(line.key)
                      }}
                    >
                      {selectedKeys.size > 0 ? (
                        <input
                          type="checkbox"
                          className="pd-row-check"
                          aria-label={`Select row ${i + 1}`}
                          checked={selectedKeys.has(line.key)}
                          onChange={() => toggleLineSelect(line.key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td className="col-item">
                      <span className="pd-item-name">{line.item}</span>
                      {line.modifiers ? (
                        <span className="pd-item-mod">↳ {line.modifiers}</span>
                      ) : null}
                    </td>
                    <td
                      className="col-qty num pd-qty-cell"
                      onClick={(e) => {
                        e.stopPropagation()
                        openQtyChange(line.key)
                      }}
                    >
                      {line.qty}
                    </td>
                    <td className="col-money num pd-money-muted">{money(line.price)}</td>
                    <td className="col-money num pd-money-muted">{money(line.disc)}</td>
                    <td className="col-money num pd-money-muted">{money(line.tax)}</td>
                    <td className="col-money num">{money(line.total)}</td>
                    <td className="col-menu">
                      <button
                        type="button"
                        className="pd-row-delete"
                        aria-label="Delete item"
                        title="Delete item"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteLine(line.key)
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                  )
                  if (!separatorAfterKeys.has(line.key)) return [row]
                  return [
                    row,
                    <tr key={`sep-${line.key}`} className="pd-line-sep" aria-hidden="true">
                      <td colSpan={8}>
                        <hr />
                      </td>
                    </tr>,
                  ]
                })
              )}
            </tbody>
          </table>
        </div>

        {lines.length > 0 ? (
          <div className="pd-line-bar">
            <button
              type="button"
              className="pd-line-add"
              onClick={toggleSeparatorAfterSelected}
              title="Draw a line after the selected row"
            >
              <SeparatorHorizontal size={13} /> Add Line
            </button>
          </div>
        ) : null}

        <div className="pd-foot">
          <div className="pd-summary">
            <div className="pd-summary-scroll">
              <span className="pd-summary-item">
                <span className="label">
                  <span className="label-full">Items</span>
                  <span className="label-short">Itm</span>
                </span>
                <span className="val">{summary.itemCount}</span>
              </span>
              <span className="pd-summary-item">
                <span className="label">Qty</span>
                <span className="val">{summary.qty}</span>
              </span>
              <span className="pd-summary-item">
                <span className="label">
                  <span className="label-full">Total</span>
                  <span className="label-short">Tot</span>
                </span>
                <span className="val">{money(summary.gross)}</span>
              </span>
              <span className="pd-summary-item">
                <span className="label">Disc</span>
                <span className="val">{money(round2(summary.itemDiscount + summary.billDiscount))}</span>
              </span>
              <span className="pd-summary-item">
                <span className="label">Txbl</span>
                <span className="val">{money(summary.taxableSubTotal)}</span>
              </span>
              <span className="pd-summary-item">
                <span className="label">Tax</span>
                <span className="val">{money(summary.tax)}</span>
              </span>
            </div>
            <span className="pd-summary-item pd-summary-net">
              <span className="total-label">
                <span className="label-full">NET AMT</span>
                <span className="label-short">Net</span>
              </span>
              <span className="total-val">{money(summary.total)}</span>
            </span>
          </div>

          <div className="pd-service-wrap">
          <div className="pd-service">
            {([
              { id: 'DINE IN' as const, icon: Utensils },
              { id: 'TAKEAWAY' as const, icon: ShoppingBag },
              { id: 'DELIVERY' as const, icon: Truck },
            ]).map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pd-service-btn${service === s.id ? ' is-active' : ''}`}
                onClick={(e) => {
                  if (s.id !== 'DELIVERY') {
                    onServiceClick(s.id)
                    return
                  }
                  // Second click of a double-click — the dblclick handler takes over.
                  if (e.detail > 1) return
                  // Delivery's customer picker would cover this button and swallow
                  // the second click of a double-click, so open it after a short
                  // pause that a double-click cancels.
                  deliveryClick(undefined, false)
                  if (deliveryPickerTimer.current) clearTimeout(deliveryPickerTimer.current)
                  deliveryPickerTimer.current = setTimeout(() => {
                    deliveryPickerTimer.current = null
                    openCustomerSelect()
                  }, 280)
                }}
                onDoubleClick={() => {
                  if (s.id === 'TAKEAWAY') openOrderListFor('TAKEAWAY')
                  if (s.id === 'DELIVERY') {
                    if (deliveryPickerTimer.current) clearTimeout(deliveryPickerTimer.current)
                    deliveryPickerTimer.current = null
                    openOrderListFor('DELIVERY')
                  }
                }}
                title={
                  s.id === 'TAKEAWAY'
                    ? 'Double-click for the Takeaway list'
                    : s.id === 'DELIVERY'
                      ? 'Double-click for the Delivery list'
                      : undefined
                }
              >
                <BtnIcon icon={s.icon} />
                <span className="pd-service-label">{s.id}</span>
              </button>
            ))}
            <button
              type="button"
              className={`pd-service-btn pd-service-btn-end${lines.length > 0 ? '' : ' is-hidden'}`}
              onClick={clearData}
              disabled={lines.length === 0}
              aria-hidden={lines.length === 0}
              tabIndex={lines.length === 0 ? -1 : 0}
            >
              <BtnIcon icon={Plus} /> <span className="pd-service-label">New KOT</span>
            </button>
          </div>
          {flpAreas.length ? (
            <div className="pd-flp-area" aria-label="Areas">
              {flpAreas.map((a) => {
                const Icon = areaSupplyIcon(a)
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`pd-area-btn is-${flpAreaTone(a)}${areaId === a.id ? ' is-on' : ''}`}
                    onClick={() => areaButtonClick(a)}
                  >
                    <span className="pd-area-ic" aria-hidden>
                      <Icon size={13} strokeWidth={2.3} />
                    </span>
                    <span className="pd-area-name">{a.name}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
          </div>
        </div>
      </section>
    </>
  )
}
