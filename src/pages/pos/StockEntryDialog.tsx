/**
 * StockAdjustmentfrm — ADJ / DAMAGE / EXTRA (additional stock).
 * Qty rules match ePos StockAdjustmentfrm SaveData + TextChanged + Posting.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'

export type StockDocType = 'ADJ' | 'DMG' | 'ASE'

type Line = {
  key: number
  productId: number
  barcode: string
  shortDescription: string
  packetDetails: string
  packQty: number
  presentQty: number
  adjEntered: number
  enteredQty: number
  physicalPacks: number
  physicalQty: number
  adjQty: number
  reason: string
  lastPurchaseCost: number
}

type ProductHit = {
  productId: number
  barcode: string
  shortDescription: string
  packetDetails: string
  packQty: number
  qtyOnHand: number
  lastPurchaseCost: number
}

type Props = {
  docType: StockDocType
  entryId?: number | null
  onClose: () => void
  onOpenList: () => void
}

const META: Record<
  StockDocType,
  { title: string; kicker: string; reason: string; reasonLocked: boolean; qtyLabel: string }
> = {
  ADJ: {
    title: 'Stock Adjustment Entry',
    kicker: 'Transactions',
    reason: 'Opening Stock',
    reasonLocked: false,
    qtyLabel: 'Physical Qty',
  },
  DMG: {
    title: 'Damage Entry',
    kicker: 'Transactions',
    reason: 'Damage',
    reasonLocked: true,
    qtyLabel: 'Adj Qty',
  },
  ASE: {
    title: 'Additional Stock Entry',
    kicker: 'Transactions',
    reason: 'EXTRA',
    reasonLocked: true,
    qtyLabel: 'Adj Qty',
  },
}

const ADJ_REASONS = ['Opening Stock', 'Expiry', 'Damage', 'Excess']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

function qtyFmt(n: unknown) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : String(round3(v))
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function computeDisplay(docType: StockDocType, present: number, packQty: number, physicalPacks: number, adjEntered: number, enteredQty: number) {
  const pack = packQty || 1
  if (docType === 'DMG') {
    const adj = Math.abs(adjEntered)
    const base = round3(adj * pack)
    const start = enteredQty !== 0 ? enteredQty : present
    return {
      adjQty: round3(-base),
      physicalQty: round3(start - base),
      physicalPacks,
    }
  }
  if (docType === 'ASE') {
    const adj = Math.abs(adjEntered)
    const base = round3(adj * pack)
    return {
      adjQty: base,
      physicalQty: round3(present + base),
      physicalPacks,
    }
  }
  const physicalQty = round3(physicalPacks * pack)
  return {
    adjQty: round3(physicalQty + enteredQty - present),
    physicalQty,
    physicalPacks,
  }
}

export default function StockEntryDialog({ docType, entryId, onClose, onOpenList }: Props) {
  const meta = META[docType]
  const qtyAdjMode = docType !== 'ADJ'
  const [date, setDate] = useState(todayISO)
  const [remarks, setRemarks] = useState('')
  const [entryNo, setEntryNo] = useState('')
  const [savedId, setSavedId] = useState<number | null>(entryId && entryId > 0 ? entryId : null)
  const [posted, setPosted] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [confirmPost, setConfirmPost] = useState(false)

  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [packet, setPacket] = useState('')
  const [packQty, setPackQty] = useState('1')
  const [present, setPresent] = useState('')
  const [enteredQty, setEnteredQty] = useState('')
  const [physicalPacks, setPhysicalPacks] = useState('')
  const [adjEntered, setAdjEntered] = useState('')
  const [reason, setReason] = useState(meta.reason)
  const [picked, setPicked] = useState<ProductHit | null>(null)
  const [hits, setHits] = useState<ProductHit[]>([])
  const [hitOpen, setHitOpen] = useState(false)
  const [hitIndex, setHitIndex] = useState(0)
  const lineKey = useRef(1)
  const barcodeRef = useRef<HTMLInputElement | null>(null)
  const qtyRef = useRef<HTMLInputElement | null>(null)
  const hitsWrapRef = useRef<HTMLDivElement | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const live = useMemo(() => {
    const presentN = Number(present) || 0
    const pack = Number(packQty) || 1
    const phys = Number(physicalPacks) || 0
    const adj = Number(adjEntered) || 0
    const ent = Number(enteredQty) || 0
    return computeDisplay(docType, presentN, pack, phys, adj, ent)
  }, [docType, present, packQty, physicalPacks, adjEntered, enteredQty])

  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!savedId) return
    let alive = true
    setBusy(true)
    apiService
      .fetchStockEntry(savedId)
      .then((res) => {
        if (!alive) return
        const m = ((res.entry as Record<string, unknown>) ?? res) as Record<string, unknown>
        setEntryNo(String(m.entry_no ?? m.entryNo ?? ''))
        setDate(String(m.entry_date ?? m.entryDate ?? todayISO()).slice(0, 10))
        setRemarks(String(m.remark ?? m.remarks ?? ''))
        setPosted(String(m.post_status ?? m.postStatus ?? '').toLowerCase() === 'posted')
        const rawLines = Array.isArray(m.lines) ? m.lines : []
        setLines(
          rawLines.map((rowUnknown, i) => {
            const row = rowUnknown as Record<string, unknown>
            const pack = Number(row.pkt_qty ?? row.pktQty) || 1
            const storedAdj = Number(row.adj_qty ?? row.adjQty) || 0
            const physicalQty = Number(row.physical_qty ?? row.physicalQty) || 0
            const presentQty = Number(row.system_qty ?? row.systemQty) || 0
            const adjEnteredN =
              docType === 'ADJ' ? storedAdj : Math.abs(storedAdj) / (pack || 1)
            const physicalPacksN = pack ? physicalQty / pack : physicalQty
            return {
              key: lineKey.current++,
              productId: Number(row.product_id ?? row.productId) || 0,
              barcode: String(row.barcode ?? ''),
              shortDescription: String(row.short_description ?? row.shortDescription ?? ''),
              packetDetails: String(row.pkt_details ?? row.pktDetails ?? ''),
              packQty: pack,
              presentQty,
              adjEntered: round3(adjEnteredN),
              enteredQty: Number(row.entered_qty ?? row.enteredQty) || 0,
              physicalPacks: round3(physicalPacksN),
              physicalQty,
              adjQty: storedAdj,
              reason: String(row.reason ?? meta.reason),
              lastPurchaseCost: 0,
            }
          }),
        )
      })
      .catch((err) => setError(errMessage(err, 'Could not load entry')))
      .finally(() => {
        if (alive) setBusy(false)
      })
    return () => {
      alive = false
    }
  }, [savedId, docType, meta.reason])

  function clearLine() {
    setBarcode('')
    setName('')
    setPacket('')
    setPackQty('1')
    setPresent('')
    setEnteredQty('')
    setPhysicalPacks('')
    setAdjEntered('')
    setReason(meta.reason)
    setPicked(null)
    setHits([])
    setHitOpen(false)
    barcodeRef.current?.focus()
  }

  function applyProduct(p: ProductHit, draftPhysical = 0) {
    setPicked(p)
    setBarcode(p.barcode)
    setName(p.shortDescription)
    setPacket(p.packetDetails)
    setPackQty(String(p.packQty || 1))
    setPresent(qtyFmt(p.qtyOnHand))
    setEnteredQty(draftPhysical ? qtyFmt(draftPhysical) : '')
    setPhysicalPacks('')
    setAdjEntered('')
    setHits([])
    setHitOpen(false)
    setHitIndex(0)
    setReason(meta.reason)
    window.setTimeout(() => qtyRef.current?.focus(), 0)
  }

  async function lookup(field: 'barcode' | 'name', value: string) {
    const q = value.trim()
    if (!q) {
      setHits([])
      setHitOpen(false)
      return
    }
    try {
      const list = await apiService.searchStockEntryProducts(q)
      const mapped: ProductHit[] = list.map((r) => ({
        productId: Number(r.productId) || 0,
        barcode: String(r.barcode ?? ''),
        shortDescription: String(r.shortDescription ?? ''),
        packetDetails: String(r.packetDetails ?? ''),
        packQty: Number(r.packQty) || 1,
        qtyOnHand: Number(r.qtyOnHand) || 0,
        lastPurchaseCost: Number(r.lastPurchaseCost) || 0,
      }))
      if (mapped.length === 1 && field === 'barcode' && mapped[0].barcode.toLowerCase() === q.toLowerCase()) {
        const draft = await apiService.fetchStockDraftEnteredQty(mapped[0].productId)
        applyProduct(mapped[0], draft)
        return
      }
      setHits(mapped)
      setHitIndex(0)
      setHitOpen(mapped.length > 0)
    } catch (err) {
      setError(errMessage(err, 'Product search failed'))
    }
  }

  function onSearchChange(field: 'barcode' | 'name', value: string) {
    if (field === 'barcode') setBarcode(value)
    else setName(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => void lookup(field, value), 220)
  }

  async function pickHit(p: ProductHit) {
    const draft = await apiService.fetchStockDraftEnteredQty(p.productId)
    applyProduct(p, draft)
  }

  useEffect(() => {
    if (!hitOpen) return
    const el = hitsWrapRef.current?.querySelector<HTMLElement>(`[data-hit="${hitIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [hitIndex, hitOpen])

  function onSearchKeyDown(field: 'barcode' | 'name', e: KeyboardEvent<HTMLInputElement>) {
    if (hitOpen && hits.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHitIndex((i) => Math.min(i + 1, hits.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHitIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const pick = hits[hitIndex] ?? hits[0]
        if (pick) void pickHit(pick)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setHitOpen(false)
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      void lookup(field, field === 'barcode' ? barcode : name)
    }
  }

  function addToGrid() {
    setError(null)
    if (!picked || picked.productId < 1) {
      setError('Please Enter BarCode')
      barcodeRef.current?.focus()
      return
    }
    const pack = Number(packQty) || 1
    const presentN = Number(present) || 0
    const phys = Number(physicalPacks) || 0
    const adj = Number(adjEntered) || 0
    const ent = Number(enteredQty) || 0
    if (qtyAdjMode) {
      if (!(adj > 0)) {
        setError('Please Enter Qty')
        return
      }
    } else if (physicalPacks === '') {
      setError('Please Enter Qty')
      return
    }
    if (phys > 8000) {
      setError('Please Correct Physical Qty')
      return
    }
    const calc = computeDisplay(docType, presentN, pack, phys, adj, ent)
    const next: Line = {
      key: lineKey.current++,
      productId: picked.productId,
      barcode: picked.barcode,
      shortDescription: picked.shortDescription,
      packetDetails: picked.packetDetails,
      packQty: pack,
      presentQty: presentN,
      adjEntered: qtyAdjMode ? Math.abs(adj) : calc.adjQty,
      enteredQty: ent,
      physicalPacks: qtyAdjMode ? 0 : phys,
      physicalQty: calc.physicalQty,
      adjQty: calc.adjQty,
      reason: reason || meta.reason,
      lastPurchaseCost: picked.lastPurchaseCost,
    }
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === next.productId)
      if (idx < 0) return [...prev, next]
      const copy = [...prev]
      const old = copy[idx]
      if (docType === 'ADJ') copy[idx] = next
      else {
        copy[idx] = {
          ...old,
          adjEntered: round3(old.adjEntered + next.adjEntered),
          adjQty: round3(old.adjQty + next.adjQty),
          physicalQty: next.physicalQty,
          presentQty: next.presentQty,
        }
      }
      return copy
    })
    clearLine()
  }

  function removeLine(key: number) {
    if (posted) return
    if (!window.confirm('Are you sure to Delete Current Row')) return
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  async function saveDraft() {
    if (posted) return
    if (!lines.length) {
      setError('Please Enter Atleast One Product')
      return null
    }
    setBusy(true)
    setError(null)
    try {
      const res = await apiService.saveStockEntry({
        entryId: savedId,
        entryNo,
        docType,
        entryDate: date,
        remark: remarks,
        lines: lines.map((l) => ({
          productId: l.productId,
          barcode: l.barcode,
          shortDescription: l.shortDescription,
          pktDetails: l.packetDetails,
          packQty: l.packQty,
          systemQty: l.presentQty,
          enteredQty: l.enteredQty,
          physicalPacks: qtyAdjMode ? undefined : l.physicalPacks,
          adjEntered: qtyAdjMode ? l.adjEntered : undefined,
          adjQty: l.adjQty,
          reason: l.reason,
          lastPurchaseCost: l.lastPurchaseCost,
        })),
      })
      const id = Number(res.entryId ?? res.entry_id) || savedId
      setSavedId(id)
      setEntryNo(String(res.entryNo ?? res.entry_no ?? entryNo))
      setHint('Stock Adjustment Details saved successfully')
      return id
    } catch (err) {
      setError(errMessage(err, 'Could not save'))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function runPost() {
    setConfirmPost(false)
    const id = savedId || (await saveDraft())
    if (!id) return
    setBusy(true)
    setError(null)
    try {
      await apiService.postStockEntry(id)
      setPosted(true)
      setHint('Posted successfully  ....')
      setLines([])
    } catch (err) {
      setError(errMessage(err, 'Could not post'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="pd-mod-overlay pd-inv-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="pd-inv pd-stk is-report" role="dialog" aria-modal="true" aria-labelledby="pd-stk-title">
        <header className="pd-inv-head">
          <div className="pd-inv-head-left">
            <div>
              <p className="pd-mod-kicker">{meta.kicker}</p>
              <h2 id="pd-stk-title">{meta.title}</h2>
            </div>
          </div>
          <span className={`pd-stk-status${posted ? ' is-posted' : ''}`}>
            {posted ? 'POSTED' : 'NOT POSTED'}
          </span>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        <div className="pd-stk-meta">
          <label>
            <span>No</span>
            <input value={entryNo || '0'} readOnly />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={posted} />
          </label>
          <label className="pd-stk-remarks">
            <span>Remarks</span>
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value.toUpperCase())}
              disabled={posted}
            />
          </label>
        </div>

        {!posted ? (
          <div className="pd-stk-entry">
            <label>
              <span>Barcode</span>
              <span className="pd-inv-search">
                <Search size={13} />
                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => onSearchChange('barcode', e.target.value)}
                  onKeyDown={(e) => onSearchKeyDown('barcode', e)}
                  placeholder="Barcode"
                  autoComplete="off"
                />
              </span>
            </label>
            <label>
              <span>Item Name</span>
              <span className="pd-inv-search">
                <Search size={13} />
                <input
                  value={name}
                  onChange={(e) => onSearchChange('name', e.target.value)}
                  onKeyDown={(e) => onSearchKeyDown('name', e)}
                  placeholder="Short description"
                  autoComplete="off"
                />
              </span>
            </label>
            <label>
              <span>Packet</span>
              <input value={packet} readOnly />
            </label>
            <label>
              <span>Pack Qty</span>
              <input value={packQty} readOnly />
            </label>
            <label>
              <span>Present</span>
              <input value={present} readOnly />
            </label>
            {!qtyAdjMode ? (
              <label>
                <span>Entered</span>
                <input value={enteredQty} readOnly />
              </label>
            ) : null}
            {qtyAdjMode ? (
              <label>
                <span>{meta.qtyLabel}</span>
                <input
                  ref={qtyRef}
                  value={adjEntered}
                  onChange={(e) => setAdjEntered(e.target.value.replace(/[^\d.-]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addToGrid()
                  }}
                />
              </label>
            ) : (
              <label>
                <span>{meta.qtyLabel}</span>
                <input
                  ref={qtyRef}
                  value={physicalPacks}
                  onChange={(e) => setPhysicalPacks(e.target.value.replace(/[^\d.-]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addToGrid()
                  }}
                />
              </label>
            )}
            <label>
              <span>Adj Qty</span>
              <input value={qtyFmt(live.adjQty)} readOnly />
            </label>
            <label>
              <span>Physical</span>
              <input value={qtyFmt(live.physicalQty)} readOnly />
            </label>
            <label>
              <span>Reason</span>
              {meta.reasonLocked ? (
                <input value={reason} readOnly />
              ) : (
                <select value={reason} onChange={(e) => setReason(e.target.value)}>
                  {ADJ_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <button type="button" className="pd-inv-go pd-stk-add" onClick={addToGrid} disabled={busy}>
              <Plus size={14} />
              Add
            </button>
            {hitOpen && hits.length > 0 ? (
              <div className="pd-stk-hits" ref={hitsWrapRef} role="listbox" aria-label="Items">
                {hits.map((h, i) => (
                  <button
                    key={h.productId}
                    type="button"
                    role="option"
                    aria-selected={i === hitIndex}
                    data-hit={i}
                    className={i === hitIndex ? 'is-active' : undefined}
                    onMouseEnter={() => setHitIndex(i)}
                    onClick={() => void pickHit(h)}
                  >
                    <strong>{h.barcode}</strong>
                    <span>{h.shortDescription}</span>
                    <em>On hand {qtyFmt(h.qtyOnHand)}</em>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="pd-inv-msg">{error}</p> : null}
        {hint ? <p className="pd-stk-ok">{hint}</p> : null}

        <div className="pd-stk-grid-wrap">
          <table className="pd-inv-grid">
            <thead>
              <tr>
                <th>Sl</th>
                <th>Barcode</th>
                <th>Description</th>
                <th>Packet</th>
                <th className="num">Present</th>
                <th className="num">Adj Qty</th>
                <th className="num">Physical</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="pd-inv-empty">
                    Scan or search an item, enter qty, then Add.
                  </td>
                </tr>
              ) : (
                lines.map((l, i) => (
                  <tr key={l.key}>
                    <td>{i + 1}</td>
                    <td>{l.barcode}</td>
                    <td>{l.shortDescription}</td>
                    <td>{l.packetDetails}</td>
                    <td className="num">{qtyFmt(l.presentQty)}</td>
                    <td className="num">{qtyFmt(qtyAdjMode ? l.adjEntered : l.adjQty)}</td>
                    <td className="num">{qtyFmt(l.physicalQty)}</td>
                    <td>{l.reason}</td>
                    <td>
                      {!posted ? (
                        <button type="button" className="pd-stk-del" onClick={() => removeLine(l.key)} aria-label="Delete">
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="pd-inv-foot">
          <span className="pd-inv-total">COUNT : {lines.length}</span>
          <button type="button" className="pd-inv-ghost" onClick={onOpenList}>
            List
          </button>
          <button type="button" className="pd-inv-ghost" onClick={onClose}>
            Close
          </button>
          {!posted ? (
            <>
              <button type="button" className="pd-inv-ghost" onClick={() => void saveDraft()} disabled={busy}>
                Save
              </button>
              <button
                type="button"
                className="pd-inv-go"
                onClick={() => setConfirmPost(true)}
                disabled={busy || lines.length === 0}
              >
                Post
              </button>
            </>
          ) : null}
        </footer>
      </div>

      {confirmPost ? (
        <div className="pd-settle-tip" role="dialog" aria-modal="true">
          <div className="pd-ol-dialog pd-ol-narrow">
            <div className="pd-mod-header">
              <div>
                <p className="pd-mod-kicker">Posting</p>
                <h2 className="pd-mod-item-name">Update Stock?</h2>
              </div>
            </div>
            <div className="pd-ol-body">
              <p className="pd-confirm-msg">
                Posting Will Update Stock......
                <br />
                System will not allow any further modifications in this Transfer... Proceed .. ?
              </p>
              <div className="pd-admin-foot">
                <button type="button" className="pd-mod-foot-btn is-close" onClick={() => setConfirmPost(false)}>
                  NO
                </button>
                <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void runPost()}>
                  YES
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
