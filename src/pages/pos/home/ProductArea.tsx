import { Home, Truck, ShoppingBag, Plus } from 'lucide-react'
import { TableCard } from '../../../components/common/TableCard'
import { normalizeSupply, money } from '../main/posHelpers'
import { ChairGlyph } from '../main/posWidgets'
import { type PosCtx } from '../main/usePosMain'

export function ProductArea({ ctx }: { ctx: PosCtx }) {
  const {
    catalogueError, catalogueState, chairBtnClick, chairNo, chairPromptOpen, currentArea,
    dismissTableSelectionUi, dotChairClick, emptyHint, isTablePopup, kotSelectOpen, kotTileClick,
    occupiedByTable, occupiedKots, onItemClick, openNewProductModal, pickKotToCombine, products,
    tableBtnClick, tableId, tableName, tablePopupMode, tablePopupOpen, tablesForArea,
  } = ctx
  return (
    <>
      {tablePopupOpen ? (
        <div className="pd-table-popup">
          <div className="pd-table-popup-bar">
            <strong>
              {isTablePopup === 1 && tableName
                ? `Chairs · ${tableName}`
                : currentArea?.name || 'Tables'}
            </strong>
            <button type="button" className="pd-table-home" onClick={dismissTableSelectionUi}>
              <Home size={14} /> Home
            </button>
          </div>
          {tablePopupMode === 'kots' ? (
            <div className="pd-table-grid">
              {occupiedKots.length === 0 ? (
                <p className="pd-cat-msg">No open KOTs in this area</p>
              ) : (
                occupiedKots.map((k) => (
                  <button
                    key={k.kotMasterId}
                    type="button"
                    className={`pd-seat pd-seat-order${normalizeSupply(currentArea?.supplyType) === 'DELIVERY' ? ' is-delivery' : ''}`}
                    onClick={() => void kotTileClick(k)}
                  >
                    <span className="pd-seat-glyph" aria-hidden>
                      {normalizeSupply(currentArea?.supplyType) === 'DELIVERY' ? (
                        <Truck size={28} strokeWidth={1.8} />
                      ) : (
                        <ShoppingBag size={28} strokeWidth={1.8} />
                      )}
                    </span>
                    <span className="pd-seat-name">{k.kotNo}</span>
                    {k.pax > 0 ? <small className="pd-seat-pill">{k.pax} pax</small> : null}
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              {isTablePopup !== 1 ? (
              <div className="pd-table-grid">
                {tablesForArea.map((t) => {
                  const occ = occupiedByTable.get(t.id) ?? []
                  const occupied = occ.length > 0
                  return (
                    <TableCard
                      key={t.id}
                      label={t.name}
                      seats={t.seats}
                      shape={t.format}
                      status={occupied ? 'occupied' : 'free'}
                      orderNo={occupied ? occ[0].kotNo : undefined}
                      pax={occupied ? occ[0].pax : undefined}
                      selected={tableId === t.id}
                      onClick={() => void tableBtnClick(t)}
                      occupiedChairs={occ.filter((k) => k.chairNo > 0).map((k) => k.chairNo)}
                      onChairSelect={(chair) => void dotChairClick(t, chair)}
                    />
                  )
                })}
                {tablesForArea.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
              </div>
              ) : null}
              {chairPromptOpen && tableId > 0 && (occupiedByTable.get(tableId) ?? []).length > 0 ? (
                <div className="pd-chair-grid">
                  {kotSelectOpen ? <p className="pd-ol-label">Select KOT chair</p> : null}
                  {Array.from({ length: Math.max(1, tablesForArea.find((t) => t.id === tableId)?.seats || 4) }, (_, i) => i + 1).map((n) => {
                    const occ = (occupiedByTable.get(tableId) ?? []).find((k) => k.chairNo === n)
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`pd-seat pd-seat-chair${occ ? ' is-busy' : ' is-free'}${chairNo === n ? ' is-on' : ''}`}
                        onClick={() => {
                          const t = tablesForArea.find((x) => x.id === tableId)
                          if (!t) return
                          if (kotSelectOpen) {
                            const freeChair = Array.from(
                              { length: Math.max(1, t.seats || 4) },
                              (_, i) => i + 1,
                            ).find((c) => !(occupiedByTable.get(tableId) ?? []).some((k) => k.chairNo === c)) ?? 0
                            void pickKotToCombine(occ ?? null, occ ? 0 : n || freeChair)
                            return
                          }
                          void chairBtnClick(n, t)
                        }}
                      >
                        <span className="pd-seat-glyph" aria-hidden>
                          <ChairGlyph />
                        </span>
                        <span className="pd-seat-name">CH {n}</span>
                        {occ ? <small className="pd-seat-pill">{occ.kotNo}</small> : <small className="pd-seat-status">Free</small>}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
      <div className="pd-products">
        {catalogueState === 'loading' ? (
          <p className="pd-cat-msg">Loading menu…</p>
        ) : catalogueState === 'error' ? (
          <p className="pd-cat-msg">{catalogueError}</p>
        ) : products.length === 0 ? (
          <p className="pd-cat-msg">{emptyHint}</p>
        ) : (
          <>
          {products.map((p) => (
              <button key={p.id} type="button" className="pd-product" onClick={(e) => onItemClick(p, undefined, { x: e.clientX, y: e.clientY })}>
                <span className="pd-product-name">{p.name.toLowerCase()}</span>
                  {p.sub && p.sub !== p.name ? (
                    <span className="pd-product-sub">{p.sub.toLowerCase()}</span>
                  ) : null}
                <span className="pd-product-foot">
                  <span className="pd-product-price">AED {money(p.price)}</span>
                </span>
              </button>
          ))}
          <button
            type="button"
            className="pd-product pd-product-add"
            onClick={openNewProductModal}
          >
            <span className="pd-product-add-icon" aria-hidden>
              <Plus size={18} strokeWidth={2.4} />
            </span>
            <span className="pd-product-add-label">Add New Item</span>
          </button>
          </>
        )}
      </div>
      )}
    </>
  )
}
