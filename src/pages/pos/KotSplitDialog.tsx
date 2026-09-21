/**
 * KotSplitFrm — opened from KotJoinFrm.btnSplit_Click.
 * Layout matches KotSplitFrm.Designer.vb; save matches Split_Save_ToChair1.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'

const AREA_PALETTE = [
  '#90EE90',
  '#ADD8E6',
  '#FFFFE0',
  '#FFB6C1',
  '#48D1CC',
  '#DDA0DD',
  '#FFA07A',
  '#D3D3D3',
  '#9ACD32',
  '#87CEFA',
  '#98FB98',
  '#F08080',
  '#F0E68C',
  '#FFE4E1',
  '#E0FFFF',
] as const

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

function areaSwatch(areaId: number, areaName = '') {
  const seed =
    areaId > 0 ? areaId : [...String(areaName)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AREA_PALETTE[Math.abs(seed) % AREA_PALETTE.length]
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
  const [vacantConfirmTable, setVacantConfirmTable] = useState<TableRow | null>(null)
  const [confirm, setConfirm] = useState<'picker' | 'use-table' | 'save' | null>(null)
  const [pendingTable, setPendingTable] = useState<{ areaId: number; tableId: number } | null>(null)
  const [qtyOpen, setQtyOpen] = useState(false)
  const [qtyDraft, setQtyDraft] = useState('')
  const [qtyNode, setQtyNode] = useState<{ node: SplitItem; idx: number } | null>(null)
  const [paxOpen, setPaxOpen] = useState(false)
  const [paxDraft, setPaxDraft] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const qtyRef = useRef<HTMLInputElement | null>(null)
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
  const targetStr =
    targetAreaId > 0 && targetTableId > 0
      ? `A:${getAreaName(areas, targetAreaId)}  T:${getTableName(tables, targetTableId)}  C:1`
      : '-'

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
    setVacantConfirmTable(null)
    setVacantOpen(true)
  }

  function onVacantTableClick(table: TableRow) {
    if (occupiedTableIds.has(table.id)) return
    setVacantConfirmTable(table)
    setConfirm('picker')
  }

  function onPickerConfirm(yes: boolean) {
    setConfirm(null)
    if (!yes || !vacantConfirmTable) {
      setVacantConfirmTable(null)
      return
    }
    setPendingTable({ areaId: vacantAreaId, tableId: vacantConfirmTable.id })
    setVacantOpen(false)
    setVacantConfirmTable(null)
    setConfirm('use-table')
  }

  function onUseTableConfirm(yes: boolean) {
    setConfirm(null)
    if (!yes || !pendingTable) {
      setPendingTable(null)
      return
    }
    setTargetAreaId(pendingTable.areaId)
    setTargetTableId(pendingTable.tableId)
    setPaxDraft(String(Math.max(1, targetPax)))
    setPaxOpen(true)
  }

  function onPaxDone() {
    const value = Math.trunc(Number(paxDraft))
    if (Number.isFinite(value) && value > 0) setTargetPax(Math.max(1, value))
    setPaxOpen(false)
  }

  function onPaxCancel() {
    setPaxOpen(false)
  }

  function onSplitSaveClick() {
    if (move.length <= 0) {
      toast('Please move at least one item to New KOT side.')
      return
    }
    if (targetAreaId <= 0 || targetTableId <= 0) {
      toast('Please select a target table first.')
      return
    }
    setConfirm('save')
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
      setConfirm(null)
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

  const confirmCopy = (() => {
    if (confirm === 'picker' && vacantConfirmTable) {
      return {
        title: 'Select this table ?',
        body: `Select this table ?\n\nArea : ${getAreaName(areas, vacantAreaId)}\nTable: ${getTableName(tables, vacantConfirmTable.id)}\n\nProceed ?`,
      }
    }
    if (confirm === 'use-table' && pendingTable) {
      return {
        title: 'Use this table for NEW KOT ?',
        body: `Use this table for NEW KOT ?\n\nArea: ${getAreaName(areas, pendingTable.areaId)}\nTable: ${getTableName(tables, pendingTable.tableId)}\nChairNo: 1`,
      }
    }
    if (confirm === 'save') {
      const pax = targetPax <= 0 ? 1 : targetPax
      return {
        title: 'Confirm SPLIT ?',
        body:
          `Confirm SPLIT ?\n\nNew KOT items: ${move.length}\nNew Total: ${money(newTotal)}\nTarget: Area ${getAreaName(areas, targetAreaId)} / Table ${getTableName(tables, targetTableId)} / Chair 1\nPAX: ${pax}\n\nProceed ?`,
      }
    }
    return null
  })()

  return (
    <div className="pd-mod-overlay pd-ks-overlay" role="presentation">
      <div className="pd-ks-dialog" role="dialog" aria-modal="true">
        <div className="pd-ks-top">
          <h2>SPLIT: {source.kotNo || ''}</h2>
        </div>
        <div className="pd-ks-lists">
          <div className="pd-ks-col">
            {loadState === 'loading' ? <p className="pd-cat-msg">Loading items…</p> : null}
            {loadState === 'error' ? <p className="pd-cat-msg">{loadError}</p> : null}
            {stay.map((node, idx) => (
              <button
                key={`stay-${itemKey(node)}-${idx}`}
                type="button"
                className="pd-ks-card"
                onClick={() => moveFromStay(node, idx)}
              >
                <strong>{node.itemName}</strong>
                <span>
                  Qty: {formatQty(node.qty)}    Amount: {money(node.lineTotal)}
                </span>
              </button>
            ))}
          </div>
          <div className="pd-ks-col">
            {move.map((node, idx) => (
              <button
                key={`move-${itemKey(node)}-${idx}`}
                type="button"
                className="pd-ks-card"
                onClick={() => moveFromNew(node, idx)}
              >
                <strong>{node.itemName}</strong>
                <span>
                  Qty: {formatQty(node.qty)}    Amount: {money(node.lineTotal)}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="pd-ks-foot">
          <p className="pd-ks-status">
            Stay: {stay.length} items  |  New: {move.length} items  |  Target: {targetStr}  |  PAX: {targetPax}
          </p>
          <div className="pd-ks-row">
            <button type="button" className="pd-ks-btn pd-ks-table" onClick={() => void openVacantPicker()}>
              Select Table
            </button>
            <span className="pd-ks-total">Current Total: {money(sourceTotal)}</span>
            <span className="pd-ks-total">New Total: {money(newTotal)}</span>
            <button
              type="button"
              className="pd-ks-btn pd-ks-save"
              disabled={move.length <= 0 || saveBusy}
              onClick={onSplitSaveClick}
            >
              Split Save
            </button>
            <button type="button" className="pd-ks-btn pd-ks-close" onClick={onClose} disabled={saveBusy}>
              Close
            </button>
          </div>
        </div>
      </div>

      {hint ? <div className="pd-toast pd-ks-toast">{hint}</div> : null}

      {vacantOpen ? (
        <div className="pd-mod-overlay pd-ks-pop" role="presentation">
          <div className="pd-floor-dialog pd-kj-vacant" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div>
                  <p className="pd-mod-kicker">Pick Vacant Table</p>
                  <h2 className="pd-mod-item-name">{getAreaName(areas, vacantAreaId)}</h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => {
                  setVacantOpen(false)
                  setVacantConfirmTable(null)
                }}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-kj-vacant-areas">
              {floorAreas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`pd-ol-area${vacantAreaId === a.id ? ' is-on' : ''}`}
                  style={{ background: areaSwatch(a.id, a.name) }}
                  onClick={() => setVacantAreaId(a.id)}
                >
                  {a.name}
                </button>
              ))}
              <p className="pd-kj-vacant-hint">Pick a VACANT table → Confirm → Done</p>
            </div>
            <div className="pd-floor-canvas">
              <div className="pd-table-grid is-floor">
                {vacantTables.map((t) => {
                  const occupied = occupiedTableIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`pd-seat pd-seat-table${occupied ? ' is-busy' : ' is-free'}`}
                      onClick={() => onVacantTableClick(t)}
                    >
                      <span className="pd-seat-name">{t.name}</span>
                      <small className="pd-seat-status">{occupied ? 'Busy' : 'Vacant'}</small>
                    </button>
                  )
                })}
                {vacantTables.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
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
                    onChange={(e) => setQtyDraft(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
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
                    onChange={(e) => setPaxDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
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

      {confirm && confirmCopy ? (
        <div className="pd-mod-overlay pd-ks-pop" role="presentation">
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div>
                  <p className="pd-mod-kicker">Confirm</p>
                  <h2 className="pd-mod-item-name">{confirmCopy.title}</h2>
                </div>
              </div>
            </div>
            <div className="pd-ol-body">
              <p className="pd-confirm-msg pd-kj-confirm">{confirmCopy.body}</p>
            </div>
            <div className="pd-mod-foot">
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                disabled={saveBusy}
                onClick={() => {
                  if (confirm === 'picker') onPickerConfirm(true)
                  else if (confirm === 'use-table') onUseTableConfirm(true)
                  else void runSplitSave()
                }}
              >
                {saveBusy ? 'Splitting…' : 'Yes'}
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-close"
                disabled={saveBusy}
                onClick={() => {
                  if (confirm === 'picker') onPickerConfirm(false)
                  else if (confirm === 'use-table') onUseTableConfirm(false)
                  else setConfirm(null)
                }}
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
