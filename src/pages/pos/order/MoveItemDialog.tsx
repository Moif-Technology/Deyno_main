import { MapPinned, X } from 'lucide-react'
import { formatKotClock, money } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function MoveItemDialog({ ctx }: { ctx: PosCtx }) {
  const {
    currentKotId, moveLineToKot, movePicker, moving, orderListError, orderListRows, orderListState,
    setMovePicker, waiter,
  } = ctx
  return (
    <>
      {movePicker ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !moving) setMovePicker(null)
          }}
        >
          <div className="pd-ol-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <MapPinned size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Move Item</p>
                  <h2 className="pd-mod-item-name">Choose destination order</h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => !moving && setMovePicker(null)}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <div className="pd-ol-cards">
                {moving ? <p className="pd-cat-msg">Moving item…</p> : null}
                {!moving && orderListState === 'loading' ? <p className="pd-cat-msg">Loading orders…</p> : null}
                {!moving && orderListState === 'error' ? <p className="pd-cat-msg">{orderListError}</p> : null}
                {!moving &&
                orderListState === 'idle' &&
                orderListRows.filter((r) => r.kotMasterId !== currentKotId).length === 0 ? (
                  <p className="pd-cat-msg">No other open orders to move this item to</p>
      ) : null}
                {!moving &&
                  orderListRows
                    .filter((row) => row.kotMasterId !== currentKotId)
                    .map((row) => (
              <button
                        key={row.kotMasterId}
                type="button"
                        className="pd-ol-card"
                        onClick={() => void moveLineToKot(row)}
                      >
                        <span className="pd-ol-card-area">
                          {row.supplyType} · {row.areaName || 'Area'}
                        </span>
                        <span className="pd-ol-card-time">{formatKotClock(row.kotTime)}</span>
                        <span className="pd-ol-card-table">Table: {row.tableName || 'N/A'}</span>
                        <span className="pd-ol-card-pax">PAX: {row.pax || 0}</span>
                        <span className="pd-ol-card-waiter">{row.waiterName || waiter}</span>
                        <span className="pd-ol-card-amt">AED {money(row.amount)}</span>
                        <span className="pd-ol-card-kot">KOT No: {row.kotNo}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
    </>
  )
}
