/**
 * TableFloorRuntimeFrmAreaChange — transfer a KOT from an occupied table
 * to a vacant table (same or other area).
 *
 *   1) Click OCCUPIED table → select
 *   2) Click Area button → load that area (selection is kept)
 *   3) Click VACANT table → confirm → UPDATE KOTMaster.TableId + AreaID
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPinned, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import FloorRuntimeCanvas, { type FloorShapeView, type FloorTableView } from './FloorRuntimeCanvas'
import type { PctPoint } from './floorGeometry'

type AreaRow = { id: number; name: string; supplyType: string; tableCreationType: number }
type TableRow = { id: number; name: string; areaId: number; seats: number; tableNo?: number; format?: string }
type Occupied = { kotMasterId: number; tableId: number; kotNo: string; pax: number }
type FloorMap = {
  hasFloor: boolean
  border: PctPoint[]
  shapes: FloorShapeView[]
  tables: FloorTableView[]
}
type Pending = {
  kotMasterId: number
  fromAreaId: number
  fromTableId: number
  toAreaId: number
  toTableId: number
}

type Props = {
  areas: AreaRow[]
  tables: TableRow[]
  onClose: () => void
  onTransferred: (info: {
    kotMasterId: number
    fromAreaId: number
    fromTableId: number
    toAreaId: number
    toTableId: number
    toTableName: string
    toAreaName: string
  }) => void
}

const HINT_IDLE = 'Click OCCUPIED table to select → change Area → click VACANT table to transfer'

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function tableDisplay(table: TableRow | undefined, tableId: number) {
  if (!table) return `TableID ${tableId}`
  const tno = table.tableNo != null && table.tableNo > 0 ? String(table.tableNo) : ''
  const tname = String(table.name || '').trim()
  if (tno && tname) return `T${tno} - ${tname}`
  if (tno) return `T${tno}`
  if (tname) return tname
  return `TableID ${tableId}`
}

function areaNameOf(areas: AreaRow[], areaId: number) {
  return areas.find((a) => a.id === areaId)?.name || `Area ${areaId}`
}

export default function AreaChangeDialog({ areas, tables, onClose, onTransferred }: Props) {
  const floorAreas = useMemo(
    () =>
      areas
        .filter((a) => a.tableCreationType === 0)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [areas],
  )
  const [currentAreaId, setCurrentAreaId] = useState(0)
  const [floorMap, setFloorMap] = useState<FloorMap | null>(null)
  const [occupied, setOccupied] = useState<Occupied[]>([])
  const [hint, setHint] = useState(HINT_IDLE)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedKotMasterId, setSelectedKotMasterId] = useState(0)
  const [selectedFromTableId, setSelectedFromTableId] = useState(0)
  const [selectedFromAreaId, setSelectedFromAreaId] = useState(0)
  const [pending, setPending] = useState<Pending | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const clickLock = useRef(false)
  const lastClick = useRef(0)

  const occupiedByTable = useMemo(() => {
    const map = new Map<number, Occupied[]>()
    for (const row of occupied) {
      if (row.tableId <= 0) continue
      const list = map.get(row.tableId) ?? []
      list.push(row)
      map.set(row.tableId, list)
    }
    return map
  }, [occupied])

  const currentArea = floorAreas.find((a) => a.id === currentAreaId) ?? null
  const tablesInArea = useMemo(
    () => tables.filter((t) => t.areaId === currentAreaId),
    [tables, currentAreaId],
  )

  useEffect(() => {
    if (floorAreas.length === 0) {
      setError('No Areas found.')
      return
    }
    setCurrentAreaId((prev) => (prev > 0 && floorAreas.some((a) => a.id === prev) ? prev : floorAreas[0].id))
  }, [floorAreas])

  useEffect(() => {
    if (currentAreaId <= 0) return
    let alive = true
    setFloorMap(null)
    setError(null)
    Promise.all([
      apiService.fetchFloorDesign(currentAreaId).catch(() => null),
      apiService.fetchOrderList({ areaId: currentAreaId, joinList: true, kotExact: true }).catch(() => []),
    ]).then(([design, rows]) => {
      if (!alive) return
      const mappedOcc = (Array.isArray(rows) ? rows : [])
        .map((r) => ({
          kotMasterId: num(r.kotMasterID ?? r.KotMasterID),
          tableId: num(r.TableID ?? r.tableId ?? r.table_id),
          kotNo:
            `${String(r.KotPrefix ?? r.kotPrefix ?? '').trim()}${String(r.KotNumber ?? r.kotNumber ?? '').trim()}` ||
            String(r.kotMasterID ?? ''),
          pax: num(r.NofCustomer ?? r.nofCustomer),
        }))
        .filter((r) => r.kotMasterId > 0 && r.tableId > 0)
        .sort((a, b) => a.tableId - b.tableId || a.kotMasterId - b.kotMasterId)
      setOccupied(mappedOcc)

      if (!design) {
        setFloorMap({ hasFloor: false, border: [], shapes: [], tables: [] })
        return
      }
      const border = Array.isArray(design.border)
        ? (design.border as Record<string, unknown>[]).map((p) => ({
            x: num(p.posXPercent ?? p.x),
            y: num(p.posYPercent ?? p.y),
          }))
        : []
      const shapes = Array.isArray(design.shapes)
        ? (design.shapes as Record<string, unknown>[]).map((s) => ({
            shapeType: String(s.shapeType ?? 'ZONE'),
            posXPercent: num(s.posXPercent),
            posYPercent: num(s.posYPercent),
            widthPercent: num(s.widthPercent),
            heightPercent: num(s.heightPercent),
            backColorArgb: s.backColorArgb == null ? null : num(s.backColorArgb),
            displayText: String(s.displayText ?? ''),
          }))
        : []
      const layoutTables = Array.isArray(design.tables)
        ? (design.tables as Record<string, unknown>[]).map((t) => ({
            tableId: num(t.tableId),
            tableName: String(t.tableName ?? ''),
            noOfChairs: num(t.noOfChairs),
            tableFormat: String(t.tableFormat ?? 'SQUARE'),
            posXPercent: num(t.posXPercent),
            posYPercent: num(t.posYPercent),
            widthPercent: num(t.widthPercent) || 6.67,
            heightPercent: num(t.heightPercent) || 8.57,
          }))
        : []
      setFloorMap({
        hasFloor: Boolean(design.hasFloor) && border.length >= 3,
        border,
        shapes,
        tables: layoutTables,
      })
    })
    return () => {
      alive = false
    }
  }, [currentAreaId, reloadTick])

  function selectedHint() {
    if (selectedKotMasterId <= 0) return HINT_IDLE
    return (
      `Selected: ${areaNameOf(floorAreas, selectedFromAreaId)} / ${tableDisplay(
        tables.find((t) => t.id === selectedFromTableId),
        selectedFromTableId,
      )}  → now choose another Area and click VACANT table to transfer`
    )
  }

  function clearSelection() {
    setSelectedKotMasterId(0)
    setSelectedFromTableId(0)
    setSelectedFromAreaId(0)
    setHint(HINT_IDLE)
  }

  function setSelection(tableId: number, kotMasterId: number) {
    setSelectedKotMasterId(kotMasterId)
    setSelectedFromTableId(tableId)
    setSelectedFromAreaId(currentAreaId)
    setHint(
      `Selected: ${areaNameOf(floorAreas, currentAreaId)} / ${tableDisplay(
        tables.find((t) => t.id === tableId),
        tableId,
      )}  → now choose another Area and click VACANT table to transfer`,
    )
  }

  function onAreaClick(areaId: number) {
    setCurrentAreaId(areaId)
    if (selectedKotMasterId > 0) setHint(selectedHint())
  }

  function onTableClick(tableId: number) {
    if (clickLock.current || busy || pending) return
    const now = Date.now()
    if (now - lastClick.current < 200) return
    lastClick.current = now
    clickLock.current = true
    try {
      const occ = occupiedByTable.get(tableId) ?? []
      const occupiedKot = occ[0]
      const isOccupied = Boolean(occupiedKot && occupiedKot.kotMasterId > 0)

      if (selectedKotMasterId <= 0) {
        if (!isOccupied) return
        setSelection(tableId, occupiedKot.kotMasterId)
        return
      }

      if (isOccupied) {
        setSelection(tableId, occupiedKot.kotMasterId)
        return
      }

      if (tableId <= 0 || selectedFromTableId <= 0) return
      setPending({
        kotMasterId: selectedKotMasterId,
        fromAreaId: selectedFromAreaId,
        fromTableId: selectedFromTableId,
        toAreaId: currentAreaId,
        toTableId: tableId,
      })
    } finally {
      clickLock.current = false
    }
  }

  async function confirmTransfer() {
    if (!pending || busy) return
    setBusy(true)
    setError(null)
    try {
      await apiService.changeKotTable(pending.kotMasterId, {
        tableId: pending.toTableId,
        areaId: pending.toAreaId,
      })
      const dest = tables.find((t) => t.id === pending.toTableId)
      onTransferred({
        kotMasterId: pending.kotMasterId,
        fromAreaId: pending.fromAreaId,
        fromTableId: pending.fromTableId,
        toAreaId: pending.toAreaId,
        toTableId: pending.toTableId,
        toTableName: dest?.name || tableDisplay(dest, pending.toTableId),
        toAreaName: areaNameOf(floorAreas, pending.toAreaId),
      })
      setPending(null)
      clearSelection()
      setReloadTick((n) => n + 1)
    } catch (err) {
      setError(errMessage(err, 'Transfer failed.'))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const canvasTables = (floorMap?.tables ?? []).map((t) => {
    const occ = occupiedByTable.get(t.tableId) ?? []
    return {
      ...t,
      occupied: occ.length > 0,
      pax: occ[0]?.pax,
      kotNo: occ[0]?.kotNo,
    }
  })

  if (floorAreas.length === 0) {
    return (
      <div className="pd-mod-overlay pd-ol-overlay" role="presentation">
        <div className="pd-floor-dialog pd-ol-screen" role="dialog" aria-modal="true">
          <div className="pd-mod-header">
            <div className="pd-mod-header-left">
              <div className="pd-mod-header-icon">
                <MapPinned size={15} color="#fff" />
              </div>
              <div>
                <p className="pd-mod-kicker">Table Change</p>
                <h2 className="pd-mod-item-name">No Areas found.</h2>
              </div>
            </div>
            <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
              <X size={13} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pd-mod-overlay pd-ol-overlay" role="presentation">
      <div className="pd-floor-dialog pd-ol-screen pd-ac-dialog" role="dialog" aria-modal="true">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <MapPinned size={15} color="#fff" />
            </div>
            <div>
              <p className="pd-mod-kicker">Table Change</p>
              <h2 className="pd-mod-item-name">{currentArea?.name || 'Table Layout'}</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>
        <div className="pd-ac-bar">
          <div className="pd-ac-areas">
            {floorAreas.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`pd-ac-area${a.id === currentAreaId ? ' is-on' : ''}`}
                onClick={() => onAreaClick(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
          <p className="pd-ac-hint">{hint}</p>
          {error ? <p className="pd-ac-error">{error}</p> : null}
        </div>
        <div className={`pd-floor-canvas${floorMap?.hasFloor ? ' is-map' : ''}`}>
          {floorMap == null || currentAreaId <= 0 ? (
            <p className="pd-floor-note">Loading floor…</p>
          ) : floorMap.hasFloor ? (
            <FloorRuntimeCanvas
              border={floorMap.border}
              shapes={floorMap.shapes}
              tables={canvasTables}
              selectedTableId={selectedFromAreaId === currentAreaId ? selectedFromTableId : 0}
              onTableClick={onTableClick}
            />
          ) : (
            <>
              <p className="pd-floor-note">No floor map defined for this Area. Showing default table layout.</p>
              <div className="pd-table-grid is-floor">
                {tablesInArea.map((t) => {
                  const occ = occupiedByTable.get(t.id) ?? []
                  const occupiedNow = occ.length > 0
                  const selected = selectedFromAreaId === currentAreaId && selectedFromTableId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`pd-seat pd-seat-table is-live${occupiedNow ? ' is-busy' : ' is-free'}${selected ? ' is-on' : ''}`}
                      onClick={() => onTableClick(t.id)}
                    >
                      <span className="pd-seat-name">{t.name}</span>
                      {occupiedNow ? (
                        <span className="pd-fd-tags">
                          {occ[0].kotNo ? <b className="pd-fd-kot">{occ[0].kotNo}</b> : null}
                          <b className="pd-fd-pax">{occ[0].pax || 0} pax</b>
                        </span>
                      ) : (
                        <small className="pd-seat-status">Free</small>
                      )}
                    </button>
                  )
                })}
                {tablesInArea.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
              </div>
            </>
          )}
        </div>
      </div>

      {pending ? (
        <div className="pd-mod-overlay pd-ac-confirm-ol" role="presentation">
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <MapPinned size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Transfer Order ?</p>
                  <h2 className="pd-mod-item-name">Proceed ?</h2>
                </div>
              </div>
            </div>
            <div className="pd-ol-body">
              <p className="pd-ac-confirm">
                From Area : {areaNameOf(floorAreas, pending.fromAreaId)}
                <br />
                From Table: {tableDisplay(tables.find((t) => t.id === pending.fromTableId), pending.fromTableId)}
                <br />
                <br />
                To Area&nbsp;&nbsp;&nbsp;: {areaNameOf(floorAreas, pending.toAreaId)}
                <br />
                To Table&nbsp;&nbsp;: {tableDisplay(tables.find((t) => t.id === pending.toTableId), pending.toTableId)}
              </p>
            </div>
            <div className="pd-mod-foot">
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                onClick={() => void confirmTransfer()}
                disabled={busy}
              >
                {busy ? 'Transferring…' : 'Yes'}
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-close"
                onClick={() => setPending(null)}
                disabled={busy}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
