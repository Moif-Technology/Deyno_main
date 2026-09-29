/**
 * StockAdjustmentfrm — ADJ / DAMAGE / EXTRA (additional stock).
 * Qty rules match ePos StockAdjustmentfrm SaveData + TextChanged + Posting.
 *
 * Layout matches Recipe Entry: No / Date / Remarks on top, lines table on the
 * left, home-style product tiles on the right. Tapping a tile
 * opens the qty pad (physical qty for ADJ, adj qty for DMG / ASE) with the live
 * Adj / Physical result and reason; Done puts the line in the table.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Ban, Hash, PackagePlus, RotateCcw, Trash2, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { DatePicker } from '../../components/common/DatePicker'
import { signedDecimal } from '../../utils/validate'
import './RecipeEntryDialog.css'

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
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const

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

function asRow(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** Product master row (GET /products) → the stock search hit shape. */
function mapProductRow(r: Record<string, unknown>): ProductHit {
  const inv = asRow(r.inventory)
  return {
    productId: Number(r.productId ?? r.ProductID) || 0,
    barcode: String(r.barcode ?? r.BarCode ?? r.productCode ?? r.ProductCode ?? '').trim(),
    shortDescription: String(r.shortName || r.shortDescription || r.productName || r.ProductName || '').trim(),
    packetDetails: String(r.packDescription ?? r.packetDetails ?? ''),
    packQty: Number(inv.packQty ?? r.packQty) || 1,
    qtyOnHand: Number(inv.qtyOnHand ?? r.qtyOnHand) || 0,
    lastPurchaseCost: Number(inv.lastPurchaseCost ?? r.lastPurchaseCost) || 0,
  }
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

type Pad = {
  product: ProductHit
  /** Line being edited from the table (replaced on Done), or null for a new tap. */
  lineKey: number | null
  enteredQty: number
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
  const lineKey = useRef(1)

  // Catalogue (right side)
  const [tiles, setTiles] = useState<ProductHit[]>([])
  const [tilesState, setTilesState] = useState<'loading' | 'ready' | 'error'>('loading')

  // Qty pad
  const [pad, setPad] = useState<Pad | null>(null)
  const [padQty, setPadQty] = useState('')
  const [padReason, setPadReason] = useState(meta.reason)
  const padInputRef = useRef<HTMLInputElement | null>(null)

  const lineByProduct = useMemo(() => {
    const m = new Map<number, Line>()
    for (const line of lines) m.set(line.productId, line)
    return m
  }, [lines])

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
          rawLines.map((rowUnknown) => {
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

  // All items for the tile grid (loaded once).
  useEffect(() => {
    let alive = true
    setTilesState('loading')
    apiService
      .fetchProducts()
      .then((rows) => {
        if (!alive) return
        setTiles(rows.map(mapProductRow).filter((p) => p.productId > 0 && p.shortDescription))
        setTilesState('ready')
      })
      .catch(() => {
        if (alive) setTilesState('error')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!pad) return
    const t = window.setTimeout(() => padInputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [pad])

  /** Tile tap: pull the draft entered qty (as the old barcode pick did), then open the pad. */
  async function openTile(p: ProductHit) {
    if (posted || busy) return
    setError(null)
    const existing = lineByProduct.get(p.productId)
    if (existing && docType === 'ADJ') {
      openLine(existing)
      return
    }
    let draft = 0
    try {
      draft = await apiService.fetchStockDraftEnteredQty(p.productId)
    } catch {
      draft = 0
    }
    setPad({ product: p, lineKey: null, enteredQty: Number(draft) || 0 })
    setPadQty('')
    setPadReason(meta.reason)
  }

  /** Table row tap: edit that line's qty / reason. */
  function openLine(line: Line) {
    if (posted) return
    setError(null)
    setPad({
      product: {
        productId: line.productId,
        barcode: line.barcode,
        shortDescription: line.shortDescription,
        packetDetails: line.packetDetails,
        packQty: line.packQty,
        qtyOnHand: line.presentQty,
        lastPurchaseCost: line.lastPurchaseCost,
      },
      lineKey: line.key,
      enteredQty: line.enteredQty,
    })
    setPadQty(qtyFmt(qtyAdjMode ? line.adjEntered : line.physicalPacks))
    setPadReason(line.reason || meta.reason)
  }

  const padLive = useMemo(() => {
    if (!pad) return null
    const n = Number(padQty) || 0
    return computeDisplay(
      docType,
      pad.product.qtyOnHand,
      pad.product.packQty || 1,
      qtyAdjMode ? 0 : n,
      qtyAdjMode ? n : 0,
      pad.enteredQty,
    )
  }, [pad, padQty, docType, qtyAdjMode])

  function onPadKey(k: string) {
    if (k === 'C') {
      setPadQty((prev) => prev.slice(0, -1))
      return
    }
    if (k === '.' && padQty.includes('.')) return
    setPadQty((prev) => (prev + k).slice(0, 10))
  }

  function applyPad() {
    if (!pad) return
    const p = pad.product
    const pack = p.packQty || 1
    const presentN = p.qtyOnHand
    const n = Number(padQty) || 0
    const phys = qtyAdjMode ? 0 : n
    const adj = qtyAdjMode ? n : 0
    const ent = pad.enteredQty
    if (qtyAdjMode) {
      if (!(adj > 0)) {
        setError('Please Enter Qty')
        padInputRef.current?.focus()
        return
      }
    } else if (padQty === '') {
      setError('Please Enter Qty')
      padInputRef.current?.focus()
      return
    }
    if (phys > 8000) {
      setError('Please Correct Physical Qty')
      return
    }
    const calc = computeDisplay(docType, presentN, pack, phys, adj, ent)
    const next: Line = {
      key: pad.lineKey ?? lineKey.current++,
      productId: p.productId,
      barcode: p.barcode,
      shortDescription: p.shortDescription,
      packetDetails: p.packetDetails,
      packQty: pack,
      presentQty: presentN,
      adjEntered: qtyAdjMode ? Math.abs(adj) : calc.adjQty,
      enteredQty: ent,
      physicalPacks: qtyAdjMode ? 0 : phys,
      physicalQty: calc.physicalQty,
      adjQty: calc.adjQty,
      reason: padReason || meta.reason,
      lastPurchaseCost: p.lastPurchaseCost,
    }
    setLines((prev) => {
      // Editing a row replaces it outright.
      if (pad.lineKey != null) return prev.map((l) => (l.key === pad.lineKey ? next : l))
      const idx = prev.findIndex((l) => l.productId === next.productId)
      if (idx < 0) return [...prev, next]
      const copy = [...prev]
      const old = copy[idx]
      if (docType === 'ADJ') copy[idx] = next
      else {
        // Damage / Additional: a second tap adds to the same row (VB behaviour).
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
    setError(null)
    setPad(null)
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
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-mfg pd-rcp" role="dialog" aria-modal="true" aria-labelledby="pd-stk-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              {docType === 'DMG' ? <Ban size={15} /> : docType === 'ASE' ? <PackagePlus size={15} /> : <RotateCcw size={15} />}
            </div>
            <div>
              <p className="pd-mod-kicker">{meta.kicker}</p>
              <h2 id="pd-stk-title" className="pd-mod-item-name">{meta.title}</h2>
            </div>
          </div>
          <span className="stk-head-right">
            <span className={`stk-status${posted ? ' is-posted' : ''}`}>{posted ? 'POSTED' : 'NOT POSTED'}</span>
            <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
              <X size={13} />
            </button>
          </span>
        </div>

        <div className="rcp-body">
          <div className="rcp-top stk-top">
            <div className="pd-form-row">
              <label>No</label>
              <input value={entryNo || '0'} readOnly />
            </div>
            <div className="pd-form-row">
              <label>Date</label>
              <DatePicker value={date} onChange={setDate} disabled={posted} />
            </div>
            <div className="pd-form-row">
              <label>Remarks</label>
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value.toUpperCase())}
                disabled={posted}
              />
            </div>
          </div>

          {error ? <p className="pd-mfg-msg">{error}</p> : null}
          {hint ? <p className="pd-mfg-ok">{hint}</p> : null}

          <div className="rcp-main">
            {/* Left: adjustment lines */}
            <section className="rcp-lines stk-lines">
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Description</th>
                      <th className="num">Present</th>
                      <th className="num">Adj Qty</th>
                      <th className="num">Physical</th>
                      <th>Reason</th>
                      <th className="col-menu" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="rcp-empty">
                          {posted ? 'This entry is posted.' : 'Tap a product on the right to add it'}
                        </td>
                      </tr>
                    ) : (
                      lines.map((l) => (
                        <tr key={l.key} className={posted ? undefined : 'rcp-row'} onClick={() => openLine(l)}>
                          <td>{l.barcode}</td>
                          <td>{l.shortDescription}</td>
                          <td className="num">{qtyFmt(l.presentQty)}</td>
                          <td className="num rcp-qty">{qtyFmt(qtyAdjMode ? l.adjEntered : l.adjQty)}</td>
                          <td className="num">{qtyFmt(l.physicalQty)}</td>
                          <td>{l.reason}</td>
                          <td className="col-menu">
                            {!posted ? (
                              <button
                                type="button"
                                className="pd-row-delete"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeLine(l.key)
                                }}
                                aria-label="Delete"
                              >
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
            </section>

            {/* Right: product tiles, like the home screen */}
            <section className="rcp-cat" aria-label="Products">
              <div className="rcp-panel">
                <div className="rcp-tiles">
                  {tilesState === 'loading' ? (
                    <p className="pd-cat-msg">Loading items…</p>
                  ) : tilesState === 'error' ? (
                    <p className="pd-cat-msg">Could not load items</p>
                  ) : tiles.length === 0 ? (
                    <p className="pd-cat-msg">No items</p>
                  ) : (
                    tiles.map((p) => {
                      const line = lineByProduct.get(p.productId)
                      return (
                        <button
                          key={p.productId}
                          type="button"
                          className={`pd-product rcp-tile${line ? ' is-in' : ''}`}
                          onClick={() => void openTile(p)}
                          disabled={posted}
                          title={p.shortDescription}
                        >
                          <span className="pd-product-name">{p.shortDescription.toLowerCase()}</span>
                          <span className="pd-product-foot">
                            <span className="pd-product-price">Stock {qtyFmt(p.qtyOnHand)}</span>
                            {line ? (
                              <span className="rcp-tile-qty">
                                {qtyFmt(qtyAdjMode ? line.adjEntered : line.physicalPacks)}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="pd-mod-foot">
          <span className="pd-mfg-count">
            Count: <strong>{lines.length}</strong>
          </span>
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn" onClick={onOpenList}>List</button>
          <button type="button" className="pd-mod-foot-btn" onClick={onClose}>Close</button>
          {!posted ? (
            <>
              <button type="button" className="pd-mod-foot-btn" onClick={() => void saveDraft()} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                onClick={() => setConfirmPost(true)}
                disabled={busy || lines.length === 0}
              >
                Post
              </button>
            </>
          ) : null}
        </div>
      </div>

      {pad && padLive ? (
        <div
          className="pd-mod-overlay rcp-pad-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPad(null)
          }}
        >
          <div className="pd-qty-dialog rcp-pad" role="dialog" aria-modal="true" aria-labelledby="stk-pad-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Hash size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">{pad.lineKey != null ? 'Change Qty' : meta.qtyLabel}</p>
                  <h2 id="stk-pad-title" className="pd-mod-item-name">{pad.product.shortDescription}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setPad(null)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields rcp-pad-fields">
                <div className="rcp-pad-qty">
                  <span>{meta.qtyLabel}</span>
                  <input
                    ref={padInputRef}
                    className="pd-qty-input"
                    value={padQty}
                    inputMode="decimal"
                    placeholder="0"
                    onChange={(e) => setPadQty(signedDecimal(e.target.value).slice(0, 10))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyPad()
                      }
                      if (e.key === 'Escape') setPad(null)
                    }}
                  />
                </div>
                {meta.reasonLocked ? null : (
                  <div className="rcp-units stk-reasons" role="radiogroup" aria-label="Reason">
                    {ADJ_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={padReason === r}
                        className={`rcp-unit${padReason === r ? ' is-on' : ''}`}
                        onClick={() => {
                          setPadReason(r)
                          padInputRef.current?.focus()
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
                <dl className="rcp-pad-info">
                  <div>
                    <dt>Barcode</dt>
                    <dd>{pad.product.barcode || '—'}</dd>
                  </div>
                  <div>
                    <dt>Packet</dt>
                    <dd>{pad.product.packetDetails || '—'} · {qtyFmt(pad.product.packQty)}</dd>
                  </div>
                  <div>
                    <dt>Present</dt>
                    <dd>{qtyFmt(pad.product.qtyOnHand)}</dd>
                  </div>
                  {!qtyAdjMode ? (
                    <div>
                      <dt>Entered</dt>
                      <dd>{qtyFmt(pad.enteredQty)}</dd>
                    </div>
                  ) : null}
                  {meta.reasonLocked ? (
                    <div>
                      <dt>Reason</dt>
                      <dd>{meta.reason}</dd>
                    </div>
                  ) : null}
                  <div className="is-total">
                    <dt>Adj Qty</dt>
                    <dd>{qtyFmt(padLive.adjQty)}</dd>
                  </div>
                  <div className="is-total stk-total-2">
                    <dt>Physical</dt>
                    <dd>{qtyFmt(padLive.physicalQty)}</dd>
                  </div>
                </dl>
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {KEYS.map((k) => (
                    <button key={k} type="button" className="pd-key" onClick={() => onPadKey(k)}>
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={applyPad}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={() => setPad(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
