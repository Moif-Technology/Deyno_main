import {
  ClipboardList,
  X,
  Search,
  Merge,
  Clock,
  MapPinned,
  Users,
  User,
  Mail,
  ArrowRight,
} from 'lucide-react'
import { uiZoom } from '../../../utils/useUiZoom'
import { type CSSProperties } from 'react'
import { orderListSupplyLabel, formatKotClock, money } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function OrderListDialog({ ctx }: { ctx: PosCtx }) {
  const {
    areas, dragJoin, dragJoinStart, loadingKot, onOrderCardPointerDown, onOrderCardPointerMove,
    onOrderCardPointerUp, onOrderListArea, onOrderListKotSearch, onOrderListSupply,
    openOrderFromList, orderListAreaColor, orderListAreaId, orderListError, orderListOpen,
    orderListRows, orderListSearch, orderListSearchRef, orderListSelected, orderListSelectedId,
    orderListState, orderListSupply, selectOrderCard, setDragJoin, setOrderListOpen,
    setOrderListSearch, waiter,
  } = ctx
  return (
    <>
      {orderListOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOrderListOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-wide pd-olm" role="dialog" aria-modal="true" aria-labelledby="pd-olm-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <ClipboardList size={15} strokeWidth={2} />
                </div>
                <div>
                  <p className="pd-mod-kicker">Orders</p>
                  <h2 id="pd-olm-title" className="pd-mod-item-name">Order List</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setOrderListOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>

            <div className="pd-ol-body">
              <div className="pd-olm-bar">
                <span className="pd-olm-search">
                  <Search size={14} />
                  <input
                    ref={orderListSearchRef}
                    value={orderListSearch}
                    onChange={(e) => setOrderListSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void onOrderListKotSearch()
                    }}
                    placeholder="KOT No. — press Enter"
                    aria-label="KOT number"
                  />
                </span>
                <div className="pd-booking-tabs pd-olm-tabs">
                  {(
                    [
                      ['ALL', 'All Orders'],
                      ['DINE IN', 'Dine In'],
                      ['TAKEAWAY', 'Take Away'],
                      ['DELIVERY', 'Delivery'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`pd-booking-tab${
                        id === 'ALL'
                          ? orderListSupply === 'ALL' && orderListAreaId === 0 && !orderListSearch.trim()
                            ? ' is-on'
                            : ''
                          : orderListSupply === id
                            ? ' is-on'
                            : ''
                      }`}
                      onClick={() => onOrderListSupply(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {areas.length ? (
                <div className="pd-olm-areas" aria-label="Filter by area">
                  {areas.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`pd-olm-area${orderListAreaId === a.id ? ' is-on' : ''}`}
                      onClick={() => onOrderListArea(a.id)}
                    >
                      <span className="pd-olm-dot" style={{ background: orderListAreaColor(a.id, a.name) }} />
                      {a.name}
                    </button>
                  ))}
                </div>
              ) : null}

              {orderListRows.length > 1 ? (
                <p className="pd-olm-hint">
                  <Merge size={13} strokeWidth={2.2} /> Drag one order onto another to join them
                </p>
              ) : null}

              {dragJoin ? (
                <div
                  className="pd-olm-ghost"
                  style={{ left: dragJoin.x / uiZoom(), top: dragJoin.y / uiZoom() }}
                  aria-hidden
                >
                  <Merge size={13} strokeWidth={2.4} />
                  KOT {orderListRows.find((r) => r.kotMasterId === dragJoin.sourceId)?.kotNo}
                </div>
              ) : null}

              <div className={`pd-olm-cards${dragJoin ? ' is-dragging' : ''}`}>
                {orderListState === 'loading' ? <p className="pd-olm-msg">Loading orders…</p> : null}
                {orderListState === 'error' ? <p className="pd-olm-msg">{orderListError}</p> : null}
                {orderListState === 'idle' && orderListRows.length === 0 ? (
                  <p className="pd-olm-msg">No open KOTs</p>
                ) : null}
                {orderListRows.map((row) => {
                  const color = orderListAreaColor(row.areaId, row.areaName)
                  const picked = orderListSelectedId === row.kotMasterId
                  const chairTxt = row.chairNo > 0 ? String(row.chairNo) : ''
                  const tableLine =
                    row.tableName.trim() && chairTxt ? `${row.tableName} · Chair ${chairTxt}` : row.tableName.trim() || 'No table'
                  return (
                    <div
                      key={row.kotMasterId}
                      data-kot-id={row.kotMasterId}
                      className={`pd-olm-card${picked ? ' is-on' : ''}${
                        dragJoin?.sourceId === row.kotMasterId ? ' is-dragging' : ''
                      }${dragJoin?.overId === row.kotMasterId ? ' is-drop' : ''}`}
                      style={{ '--ol-color': color } as CSSProperties}
                      onClick={() => selectOrderCard(row)}
                      onDoubleClick={() => void openOrderFromList(row)}
                      onPointerDown={(e) => onOrderCardPointerDown(e, row)}
                      onPointerMove={onOrderCardPointerMove}
                      onPointerUp={onOrderCardPointerUp}
                      onPointerCancel={() => {
                        dragJoinStart.current = null
                        setDragJoin(null)
                      }}
                    >
                      {dragJoin?.overId === row.kotMasterId ? (
                        <div className="pd-olm-dropzone">
                          <Merge size={16} strokeWidth={2.2} />
                          Drop to join here
                        </div>
                      ) : null}
                      <div className="pd-olm-card-head">
                        <span className="pd-olm-kot">{row.kotNo}</span>
                        <span className="pd-olm-supply">{orderListSupplyLabel(row.supplyType)}</span>
                      </div>
                      <span className="pd-olm-area-name">{row.areaName || 'Unknown Area'}</span>
                      <span className="pd-olm-line">
                        <Clock size={12} strokeWidth={2.2} /> {formatKotClock(row.kotTime)}
                      </span>
                      <span className="pd-olm-line">
                        <MapPinned size={12} strokeWidth={2.2} /> {tableLine}
                      </span>
                      <span className="pd-olm-line">
                        <Users size={12} strokeWidth={2.2} /> {row.pax || 0} pax
                        <span className="pd-olm-sep">·</span>
                        <User size={12} strokeWidth={2.2} /> {row.waiterName || waiter}
                      </span>
                      {row.remarks ? (
                        <span className="pd-olm-line pd-olm-note">
                          <Mail size={12} strokeWidth={2.2} /> {row.remarks}
                        </span>
                      ) : null}
                      <div className="pd-olm-card-foot">
                        <strong>AED {money(row.amount)}</strong>
                        <button
                          type="button"
                          className="pd-olm-open"
                          disabled={loadingKot}
                          onClick={(e) => {
                            e.stopPropagation()
                            void openOrderFromList(row)
                          }}
                        >
                          Open <ArrowRight size={12} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pd-mod-foot">
              <span className="pd-mfg-count">
                {orderListSelected
                  ? `Selected: ${orderListSelected.kotNo} · ${orderListSelected.pax || 0} pax`
                  : `${orderListRows.length} open KOT${orderListRows.length === 1 ? '' : 's'}`}
              </span>
              <span className="pd-mod-foot-spacer" />
              <button type="button" className="pd-mod-foot-btn" onClick={() => setOrderListOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                disabled={!orderListSelected || loadingKot}
                onClick={() => orderListSelected && void openOrderFromList(orderListSelected)}
              >
                Open KOT
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
