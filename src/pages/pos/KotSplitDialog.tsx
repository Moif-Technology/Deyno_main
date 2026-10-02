/**
 * KotSplitFrm — opened from KotJoinFrm.btnSplit_Click.
 * Layout matches KotSplitFrm.Designer.vb; save matches Split_Save_ToChair1.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, GripVertical, MapPinned, Scissors, Users, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Toast, toastKindFor } from '../../components/common/Toast'
import { decimal, digits } from '../../utils/validate'
import './KotSplitDialog.css'


const QTY_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const
const PAX_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0'] as const

export type SplitSource = {
  kotMasterId: number
  kotNo: string
  areaId: number
  tableId: number
  pax: number
}

type AreaRow = { id: number; name: string; supplyType: string; tableCreationType: number }
type TableRow = { id: number; name: string; areaId: number; seats: number; tableNo?: number }
type SplitItem = {
  kotChildId: number
  sourceKotChildId: number
  itemName: string
  qty: number
  originalQty: number
  lineTotal: number
  subTotal: number
  tax1Amount: number
}

type Props = {
  source: SplitSource
  areas: AreaRow[]
  tables: TableRow[]
  onClose: () => void
  onSplit: (info: {
    sourceKotId: number
    newKotId: number
    sourceEmptyAfterSplit: boolean
    msg: string
  }) => void
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function money(n: number) {
  return round2(n).toFixed(2)
}

function formatQty(n: number) {
  const s = (Number(n) || 0).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return s || '0'
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function getAreaName(areas: AreaRow[], areaId: number) {
  return areas.find((a) => a.id === areaId)?.name || `Area ${areaId}`
}

function getTableName(tables: TableRow[], tableId: number) {
  return tables.find((t) => t.id === tableId)?.name || `Table ${tableId}`
}

function itemKey(n: SplitItem) {
  return n.sourceKotChildId > 0 ? n.sourceKotChildId : n.kotChildId
}

function clonePortion(node: SplitItem, splitQty: number): SplitItem {
  const ratio = node.qty > 0 ? splitQty / node.qty : 0
  return {
    ...node,
    sourceKotChildId: node.sourceKotChildId > 0 ? node.sourceKotChildId : node.kotChildId,
    qty: splitQty,
    lineTotal: round2(node.lineTotal * ratio),
    subTotal: round2(node.subTotal * ratio),
    tax1Amount: round2(node.tax1Amount * ratio),
  }
}

function mergeNode(list: SplitItem[], node: SplitItem): SplitItem[] {
  const keyId = itemKey(node)
  const idx = list.findIndex((x) => itemKey(x) === keyId)
  if (idx < 0) return [...list, node]
  const next = list.slice()
  const existing = next[idx]
  next[idx] = {
    ...existing,
    qty: existing.qty + node.qty,
    lineTotal: round2(existing.lineTotal + node.lineTotal),
    subTotal: round2(existing.subTotal + node.subTotal),
    tax1Amount: round2(existing.tax1Amount + node.tax1Amount),
  }
  return next
}

function mapSplitRows(payload: unknown): SplitItem[] {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const nested = root.kotDetails && typeof root.kotDetails === 'object' ? (root.kotDetails as Record<string, unknown>) : root
  const raw = nested.data ?? root.data
  const rows = Array.isArray(raw) ? raw : Array.isArray(payload) ? payload : []
  const seen = new Set<number>()
  const out: SplitItem[] = []
  for (const row of rows as Record<string, unknown>[]) {
    const kotChildId = num(row.KotChildID ?? row.kotChildID ?? row.KOTChildID ?? row.dgvKOTChildID)
    if (kotChildId <= 0 || seen.has(kotChildId)) continue
    seen.add(kotChildId)
    const qty = num(row.Qty ?? row.qty)
    out.push({
      kotChildId,
      sourceKotChildId: kotChildId,
      itemName: String(row.ShortDescription ?? row.ItemName ?? row.itemName ?? ''),
      qty,
      originalQty: qty,
      lineTotal: num(row.LineTotal ?? row.lineTotal),
      subTotal: num(row.SubTotalC ?? row.SubTotal ?? row.subTotal),
      tax1Amount: num(row.Tax1AmountC ?? row.Tax1Amount ?? row.tax1AmountC),
    })
  }
  return out
}

export default function KotSplitDialog({ source, areas, tables, onClose, onSplit }: Props) {
  const [stay, setStay] = useState<SplitItem[]>([])
  const [move, setMove] = useState<SplitItem[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'idle' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [targetAreaId, setTargetAreaId] = useState(0)
  const [targetTableId, setTargetTableId] = useState(0)
  const [targetPax, setTargetPax] = useState(Math.max(1, source.pax || 1))
  const [vacantOpen, setVacantOpen] = useState(false)
  const [vacantAreaId, setVacantAreaId] = useState(0)
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<number>>(new Set())
  const [confirmSave, setConfirmSave] = useState(false)
  /** Split Save was pressed before a table was chosen — continue to the save once it is. */
  const saveAfterPick = useRef(false)
  const [qtyOpen, setQtyOpen] = useState(false)
  const [qtyDraft, setQtyDraft] = useState('')
  const [qtyNode, setQtyNode] = useState<{ node: SplitItem; idx: number } | null>(null)
  const [paxOpen, setPaxOpen] = useState(false)
  const [paxDraft, setPaxDraft] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const qtyRef = useRef<HTMLInputElement | null>(null)
  /** Item being dragged (which side + its index) and the side it is hovering over. */
  const dragRef = useRef<{ from: 'stay' | 'move'; idx: number } | null>(null)
  const [dragFrom, setDragFrom] = useState<'stay' | 'move' | null>(null)
  const [dropOver, setDropOver] = useState<'stay' | 'move' | null>(null)
  const paxRef = useRef<HTMLInputElement | null>(null)

  const floorAreas = useMemo(
    () =>
      areas
        .filter((a) => a.tableCreationType === 0)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [areas],
  )
  const vacantTables = useMemo(
    () => tables.filter((t) => t.areaId === vacantAreaId && t.id > 0),
    [tables, vacantAreaId],
  )
  const sourceTotal = stay.reduce((s, n) => s + n.lineTotal, 0)
  const newTotal = move.reduce((s, n) => s + n.lineTotal, 0)

  useEffect(() => {
    if (source.kotMasterId <= 0) {
      toast('Invalid Source KOT.')
      onClose()
      return
    }
    void loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kotMasterId])

  useEffect(() => {
    if (!qtyOpen) return
    const t = window.setTimeout(() => qtyRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [qtyOpen])

  useEffect(() => {
    if (!paxOpen) return
    const t = window.setTimeout(() => paxRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [paxOpen])

  function toast(msg: string) {
    setHint(msg)
    window.setTimeout(() => setHint((cur) => (cur === msg ? null : cur)), 3600)
  }

  async function loadItems() {
    setLoadState('loading')
    setLoadError(null)
    try {
      const details = await apiService.fetchKotDetails(String(source.kotMasterId))
      setStay(mapSplitRows(details))
      setMove([])
      setLoadState('idle')
    } catch (err) {
      setLoadError(errMessage(err, 'Could not load KOT items'))
      setStay([])
      setMove([])
      setLoadState('error')
    }
  }

  function moveFromStay(node: SplitItem, idx: number) {
    if (node.qty > 1) {
      setQtyNode({ node, idx })
      setQtyDraft(String(Math.min(node.qty, 1)))
      setQtyOpen(true)
      return
    }
    applyStayToMove(node, idx, node.qty)
  }

  function applyStayToMove(node: SplitItem, idx: number, splitQty: number) {
    if (splitQty <= 0) return
    if (splitQty > node.qty) {
      toast('Split qty cannot be greater than available qty.')
      return
    }
    const keyId = itemKey(node)
    function stayIndex(list: SplitItem[]) {
      if (idx >= 0 && idx < list.length && itemKey(list[idx]) === keyId) return idx
      return list.findIndex((item) => itemKey(item) === keyId)
    }
    if (splitQty >= node.qty) {
      setStay((list) => {
        const at = stayIndex(list)
        return at < 0 ? list : list.filter((_, i) => i !== at)
      })
      setMove((list) => mergeNode(list, node))
      return
    }
    const moveNode = clonePortion(node, splitQty)
    setStay((list) => {
      const at = stayIndex(list)
      if (at < 0) return list
      return list.map((item, i) =>
        i === at
          ? {
              ...item,
              qty: item.qty - splitQty,
              lineTotal: round2(item.lineTotal - moveNode.lineTotal),
              subTotal: round2(item.subTotal - moveNode.subTotal),
              tax1Amount: round2(item.tax1Amount - moveNode.tax1Amount),
            }
          : item,
      )
    })
    setMove((list) => mergeNode(list, moveNode))
  }

  function moveFromNew(node: SplitItem, idx: number) {
    setMove((list) => list.filter((_, i) => i !== idx))
    setStay((list) => mergeNode(list, node))
  }

  /** Drop on a side: moves the dragged item there (same rules as tapping it). */
  function onDropTo(side: 'stay' | 'move') {
    const drag = dragRef.current
    dragRef.current = null
    setDragFrom(null)
    setDropOver(null)
    if (!drag || drag.from === side) return
    if (drag.from === 'stay') {
      const node = stay[drag.idx]
      if (node) moveFromStay(node, drag.idx)
    } else {
      const node = move[drag.idx]
      if (node) moveFromNew(node, drag.idx)
    }
  }

  function endDrag() {
    dragRef.current = null
    setDragFrom(null)
    setDropOver(null)
  }

  function onQtyDone() {
    const splitQty = Number(qtyDraft)
    const current = qtyNode
    setQtyOpen(false)
    setQtyNode(null)
    if (!current || !Number.isFinite(splitQty)) return
    applyStayToMove(current.node, current.idx, splitQty)
  }

  function onQtyCancel() {
    setQtyOpen(false)
    setQtyNode(null)
  }

  async function openVacantPicker() {
    if (!floorAreas.length) {
      toast('No Areas found.')
      return
    }
    const start =
      (source.areaId > 0 && floorAreas.some((a) => a.id === source.areaId)
        ? source.areaId
        : floorAreas[0].id) || 0
    if (start <= 0) {
      toast('No Areas found.')
      return
    }
    try {
      const occRows = await apiService.fetchOrderList({ joinList: true, kotExact: true })
      const occ = new Set<number>()
      for (const row of occRows) {
        const tableId = num(row.TableID ?? row.tableId)
        if (tableId > 0) occ.add(tableId)
      }
      setOccupiedTableIds(occ)
    } catch {
      setOccupiedTableIds(new Set())
    }
    setVacantAreaId(start)
    setVacantOpen(true)
  }

  /** Tap a vacant table: it becomes the new KOT's table, then ask the persons. */
  function onVacantTableClick(table: TableRow) {
    if (occupiedTableIds.has(table.id)) return
    setTargetAreaId(vacantAreaId)
    setTargetTableId(table.id)
    setVacantOpen(false)
    setPaxDraft(String(Math.max(1, targetPax)))
    setPaxOpen(true)
  }

  function closeVacantPicker() {
    setVacantOpen(false)
    saveAfterPick.current = false
  }

  function onPaxDone() {
    const value = Math.trunc(Number(paxDraft))
    if (Number.isFinite(value) && value > 0) setTargetPax(Math.max(1, value))
    setPaxOpen(false)
    // Came here from Split Save → carry on to the save.
    if (saveAfterPick.current) {
      saveAfterPick.current = false
      setConfirmSave(true)
    }
  }

  function onPaxCancel() {
    setPaxOpen(false)
    saveAfterPick.current = false
  }

  function onSplitSaveClick() {
    if (move.length <= 0) {
      toast('Please move at least one item to New KOT side.')
      return
    }
    // No table yet → open the picker straight away, then continue to the save.
    if (targetAreaId <= 0 || targetTableId <= 0) {
      saveAfterPick.current = true
      void openVacantPicker()
      return
    }
    setConfirmSave(true)
  }

  async function runSplitSave() {
    const pax = targetPax <= 0 ? 1 : targetPax
    setSaveBusy(true)
    try {
      const out = await apiService.splitKot({
        sourceKotId: source.kotMasterId,
        targetAreaId,
        targetTableId,
        targetPax: pax,
        items: move.map((n) => ({
          kotChildId: n.sourceKotChildId > 0 ? n.sourceKotChildId : n.kotChildId,
          qty: n.qty,
          subTotal: n.subTotal,
          tax1Amount: n.tax1Amount,
          lineTotal: n.lineTotal,
        })),
      })
      const msg = String(out.msg || `Bill Splitted Successfully. New KOT: ${out.newKotNo} (Chair 1)`)
      setConfirmSave(false)
      onSplit({
        sourceKotId: source.kotMasterId,
        newKotId: num(out.newKotId),
        sourceEmptyAfterSplit: Boolean(out.sourceEmptyAfterSplit),
        msg,
      })
    } catch (err) {
      const msg = errMessage(err, 'Split failed')
      toast(msg.startsWith('Split failed') ? msg : `Split failed: ${msg}`)
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <div className="pd-mod-overlay pd-ks-overlay" role="presentation">
      <div className="ksx" role="dialog" aria-modal="true" aria-labelledby="ksx-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Scissors size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Split KOT</p>
              <h2 id="ksx-title" className="pd-mod-item-name">{source.kotNo || 'KOT'}</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close" disabled={saveBusy}>
            <X size={13} />
          </button>
        </div>

        <div className="ksx-body">
          {/* Left: what stays */}
          <section
            className={`ksx-col${dropOver === 'stay' && dragFrom === 'move' ? ' is-drop' : ''}`}
            onDragOver={(e) => {
              if (dragFrom !== 'move') return
              e.preventDefault()
              setDropOver('stay')
            }}
            onDragLeave={() => setDropOver((cur) => (cur === 'stay' ? null : cur))}
            onDrop={(e) => {
              e.preventDefault()
              onDropTo('stay')
            }}
          >
            <header className="ksx-col-head">
              <span>
                <b>Stays on this KOT</b>
                <small>{stay.length} item{stay.length === 1 ? '' : 's'}</small>
              </span>
              <strong>AED {money(sourceTotal)}</strong>
            </header>
            <div className="ksx-list">
              {loadState === 'loading' ? <p className="ksx-msg">Loading items…</p> : null}
              {loadState === 'error' ? <p className="ksx-msg">{loadError}</p> : null}
              {loadState === 'idle' && stay.length === 0 ? <p className="ksx-msg">Everything is moved to the new KOT</p> : null}
                {stay.map((node, idx) => (
                  <button
                    key={`stay-${itemKey(node)}-${idx}`}
                    type="button"
                    className="ksx-card"
                    draggable
                    onDragStart={(e) => {
                      dragRef.current = { from: 'stay', idx }
                      setDragFrom('stay')
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', node.itemName)
                    }}
                    onDragEnd={endDrag}
                    onClick={() => moveFromStay(node, idx)}
                    title={'Drag to New KOT, or tap'}
                  >
                    <GripVertical size={14} className="ksx-grip" />
                    <span className="ksx-card-main">
                      <strong>{node.itemName}</strong>
                      <small>AED {money(node.lineTotal)}</small>
                    </span>
                    <span className="ksx-qty">× {formatQty(node.qty)}</span>
                    <ArrowRight size={15} className="ksx-go" />
                  </button>
                ))}
            </div>
          </section>

          <div className="ksx-mid" aria-hidden="true">
            <ArrowRight size={18} />
          </div>

          {/* Right: the new KOT */}
          <section
            className={`ksx-col is-new${dropOver === 'move' && dragFrom === 'stay' ? ' is-drop' : ''}`}
            onDragOver={(e) => {
              if (dragFrom !== 'stay') return
              e.preventDefault()
              setDropOver('move')
            }}
            onDragLeave={() => setDropOver((cur) => (cur === 'move' ? null : cur))}
            onDrop={(e) => {
              e.preventDefault()
              onDropTo('move')
            }}
          >
            <header className="ksx-col-head">
              <span>
                <b>New KOT</b>
                <small>{move.length} item{move.length === 1 ? '' : 's'}</small>
              </span>
              <strong>AED {money(newTotal)}</strong>
            </header>
            <div className="ksx-list">
              {move.length === 0 ? (
                <p className="ksx-msg is-hint">
                  Drag items here
                  <br />
                  or tap an item to move it
                </p>
              ) : null}
                {move.map((node, idx) => (
                  <button
                    key={`move-${itemKey(node)}-${idx}`}
                    type="button"
                    className="ksx-card"
                    draggable
                    onDragStart={(e) => {
                      dragRef.current = { from: 'move', idx }
                      setDragFrom('move')
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', node.itemName)
                    }}
                    onDragEnd={endDrag}
                    onClick={() => moveFromNew(node, idx)}
                    title={'Drag back, or tap'}
                  >
                    <GripVertical size={14} className="ksx-grip" />
                    <span className="ksx-card-main">
                      <strong>{node.itemName}</strong>
                      <small>AED {money(node.lineTotal)}</small>
                    </span>
                    <span className="ksx-qty">× {formatQty(node.qty)}</span>
                    <ArrowLeft size={15} className="ksx-go" />
                  </button>
                ))}
            </div>
          </section>
        </div>

        <div className="ksx-foot">
          <button type="button" className="ksx-table" onClick={() => void openVacantPicker()}>
            <MapPinned size={15} />
            {targetAreaId > 0 && targetTableId > 0 ? (
              <span>
                <b>{getTableName(tables, targetTableId)}</b>
                <small>{getAreaName(areas, targetAreaId)} · Chair 1</small>
              </span>
            ) : (
              <span>
                <b>Select table</b>
                <small>for the new KOT</small>
              </span>
            )}
          </button>
          <span className="ksx-pax">
            <Users size={14} /> {targetPax}
          </span>
          <span className="ksx-foot-spacer" />
          <button
            type="button"
            className="pd-mod-foot-btn is-ok ksx-save"
            disabled={move.length <= 0 || saveBusy}
            onClick={onSplitSaveClick}
          >
            <Scissors size={14} /> Split Save
          </button>
        </div>
      </div>

      {hint ? (
        <div className="pd-toast pd-ks-toast">
          <Toast key={hint} message={hint} kind={toastKindFor(hint)} duration={3600} />
        </div>
      ) : null}

      {vacantOpen ? (
        <div
          className="pd-mod-overlay pd-ks-pop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeVacantPicker()
          }}
        >
          <div className="ksp" role="dialog" aria-modal="true" aria-labelledby="ksp-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <MapPinned size={15} strokeWidth={2} />
                </div>
                <div>
                  <p className="pd-mod-kicker">New KOT</p>
                  <h2 id="ksp-title" className="pd-mod-item-name">Pick a table</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeVacantPicker} aria-label="Close">
                <X size={13} />
              </button>
            </div>

            <div className="ksp-body">
              <div className="ksp-bar">
                <div className="ksp-areas" role="tablist" aria-label="Area">
                  {floorAreas.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="tab"
                      aria-selected={vacantAreaId === a.id}
                      className={vacantAreaId === a.id ? 'is-on' : undefined}
                      onClick={() => setVacantAreaId(a.id)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
                <span className="ksp-legend">
                  <i className="is-free" /> Vacant
                  <i className="is-busy" /> Busy
                </span>
              </div>

              <div className="ksp-grid">
                {vacantTables.map((t) => {
                  const occupied = occupiedTableIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`ksp-table${occupied ? ' is-busy' : ''}${targetTableId === t.id ? ' is-on' : ''}`}
                      disabled={occupied}
                      onClick={() => onVacantTableClick(t)}
                    >
                      <b>{t.name}</b>
                      <small>{occupied ? 'Busy' : t.seats > 0 ? `${t.seats} seats` : 'Vacant'}</small>
                    </button>
                  )
                })}
                {vacantTables.length === 0 ? <p className="ksx-msg">No tables in this area</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {qtyOpen && qtyNode ? (
        <div className="pd-mod-overlay pd-ks-pop" role="presentation">
          <div className="pd-qty-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div>
                  <p className="pd-mod-kicker">Number Keypad</p>
                  <h2 className="pd-mod-item-name">Enter Qty to Split</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={onQtyCancel} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields">
                <div className="pd-qty-row">
                  <span>Available</span>
                  <strong>{formatQty(qtyNode.node.qty)}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>Split Qty</span>
                  <input
                    ref={qtyRef}
                    className="pd-qty-input"
                    value={qtyDraft}
                    onChange={(e) => setQtyDraft(decimal(e.target.value).slice(0, 8))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onQtyDone()
                      if (e.key === 'Escape') onQtyCancel()
                    }}
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {QTY_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="pd-key"
                      onClick={() => {
                        if (k === 'C') {
                          setQtyDraft('')
                          return
                        }
                        setQtyDraft((cur) => {
                          if (k === '.' && cur.includes('.')) return cur
                          return (cur + k).slice(0, 8)
                        })
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={onQtyDone}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={onQtyCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {paxOpen ? (
        <div className="pd-mod-overlay pd-ks-pop" role="presentation">
          <div className="pd-qty-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div>
                  <p className="pd-mod-kicker">Number Keypad</p>
                  <h2 className="pd-mod-item-name">Enter No. of Persons (New KOT)</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={onPaxCancel} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields">
                <div className="pd-qty-row">
                  <span>No. of Persons</span>
                  <input
                    ref={paxRef}
                    className="pd-qty-input"
                    value={paxDraft}
                    onChange={(e) => setPaxDraft(digits(e.target.value, 6))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onPaxDone()
                      if (e.key === 'Escape') onPaxCancel()
                    }}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {PAX_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="pd-key"
                      onClick={() => {
                        if (k === 'C') {
                          setPaxDraft('')
                          return
                        }
                        setPaxDraft((cur) => (cur + k).replace(/[^\d]/g, '').slice(0, 6))
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={onPaxDone}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={onPaxCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSave}
        title="Split this KOT?"
        message={
          <>
            {move.length} item{move.length === 1 ? '' : 's'} · AED {money(newTotal)} will move to a new KOT on{' '}
            {getTableName(tables, targetTableId)} ({getAreaName(areas, targetAreaId)}), {targetPax <= 0 ? 1 : targetPax} person
            {(targetPax <= 0 ? 1 : targetPax) === 1 ? '' : 's'}.
          </>
        }
        confirmLabel={saveBusy ? 'Splitting…' : 'Split'}
        onConfirm={() => {
          if (!saveBusy) void runSplitSave()
        }}
        onCancel={() => {
          if (!saveBusy) setConfirmSave(false)
        }}
      />
    </div>
  )
}
