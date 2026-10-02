import { Utensils, X, ZoomOut, ZoomIn } from 'lucide-react'
import { type CSSProperties } from 'react'
import FloorRuntimeCanvas from '../FloorRuntimeCanvas'
import { TableCard } from '../../../components/common/TableCard'
import { type PosCtx } from '../main/usePosMain'

export function TableFloorDialog({ ctx }: { ctx: PosCtx }) {
  const {
    currentArea, dismissTableSelectionUi, dotChairClick, floorCanvasRef, floorMap, floorTableClick,
    floorZoom, occupiedByTable, setFloorZoom, tableFloorOpen, tablesForArea, tablesInArea, zoomFloor,
  } = ctx
  return (
    <>
      {tableFloorOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissTableSelectionUi()
          }}
        >
          <div className="pd-floor-dialog" role="dialog" aria-modal="true">
            <div className="pd-floor-head">
              <div className="pd-floor-head-icon" aria-hidden>
                <Utensils size={20} strokeWidth={2.2} />
              </div>
              <div className="pd-floor-head-text">
                <p className="pd-floor-kicker">Pick a table</p>
                <h2 className="pd-floor-title">{currentArea?.name || 'Tables'}</h2>
              </div>
              {(() => {
                const busy = tablesInArea.filter((t) => (occupiedByTable.get(t.id) ?? []).length > 0).length
                return (
                  <div className="pd-floor-legend">
                    <span className="pd-floor-chip is-free">
                      <i /> {tablesInArea.length - busy} Free
                    </span>
                    <span className="pd-floor-chip is-busy">
                      <i /> {busy} Occupied
                    </span>
                  </div>
                )
              })()}
              <button type="button" className="pd-floor-x" onClick={dismissTableSelectionUi} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="pd-floor-body">
            <div
              ref={floorCanvasRef}
              className={`pd-floor-canvas${floorMap?.hasFloor ? ' is-map' : ''}`}
            >
              <div className="pd-floor-zoom" style={{ ['--floor-zoom']: floorZoom } as CSSProperties}>
              {floorMap == null ? (
                <p className="pd-floor-note">Loading floor…</p>
              ) : floorMap.hasFloor ? (
                <FloorRuntimeCanvas
                  border={floorMap.border}
                  shapes={floorMap.shapes}
                  tables={floorMap.tables.map((t) => {
                      const occ = occupiedByTable.get(t.tableId) ?? []
                      return {
                        ...t,
                        occupied: occ.length > 0,
                        pax: occ[0]?.pax,
                        kotNo: occ[0]?.kotNo,
                      }
                    })}
                  onTableClick={(id) => {
                    const t = tablesInArea.find((x) => x.id === id) ?? tablesForArea.find((x) => x.id === id)
                    if (t) void floorTableClick(t)
                  }}
                />
              ) : (
                <>
              <div className="pd-table-grid is-floor">
                {tablesInArea.map((t) => {
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
                      onClick={() => void floorTableClick(t)}
                      occupiedChairs={occ.filter((k) => k.chairNo > 0).map((k) => k.chairNo)}
                      onChairSelect={(chair) => {
                        if (occ.length === 0) void floorTableClick(t)
                        else void dotChairClick(t, chair, true)
                      }}
                    />
                  )
                })}
                {tablesInArea.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
              </div>
                </>
              )}
              </div>
            </div>
            <div className="pd-floor-zoomer" role="group" aria-label="Zoom">
              <button type="button" onClick={() => zoomFloor(-0.25)} disabled={floorZoom <= 0.5} aria-label="Zoom out">
                <ZoomOut size={18} />
              </button>
              <button type="button" className="pd-floor-zoom-pct" onClick={() => setFloorZoom(1)} title="Reset zoom">
                {Math.round(floorZoom * 100)}%
              </button>
              <button type="button" onClick={() => zoomFloor(0.25)} disabled={floorZoom >= 2.5} aria-label="Zoom in">
                <ZoomIn size={18} />
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
