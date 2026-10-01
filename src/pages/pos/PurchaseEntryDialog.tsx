/**
 * Purchase Entry / Purchase Return — same layout as Recipe Entry: header on
 * top, lines table on the left, product tiles on the right. Tapping a tile
 * opens the line pad; the keypad types into whichever field is active.
 * Totals, round-off and net sit in the footer.
 *
 * Purchase line total = (Qty × Unit Cost − Disc) + VAT.
 * Return line total   = Return Qty × Actual Cost.
 * There is no purchase / return endpoint yet, so Save / Post / Print only
 * confirm locally (as before).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { CreditCard, Hash, RotateCcw, Trash2, X } from 'lucide-react'
import { apiService } from '../../api/apiService'
import { DatePicker } from '../../components/common/DatePicker'
import { decimal, signedDecimal } from '../../utils/validate'
import './RecipeEntryDialog.css'
import './ListToolbar.css'

export type PurchaseMode = 'purchase' | 'return'

type Item = {
  productId: number
  barcode: string
  name: string
  packQty: number
  qtyOnHand: number
  unitCost: number
  sellingPrice: number
}

type Line = Item & { key: number; qty: number; returnQty: number; disc: number; vatPct: number }

type PadField = 'qty' | 'returnQty' | 'unitCost' | 'sellingPrice' | 'disc'

const MODE: Record<
  PurchaseMode,
  {
    title: string
    status: string
    saved: string
    word: string
    /** Fields in the line pad; the first "main" one gets focus and must be > 0. */
    fields: { id: PadField; label: string }[]
    main: PadField
    vat: boolean
  }
> = {
  purchase: {
    title: 'Purchase Entry',
    status: 'NEW PURCHASE',
    saved: 'Purchase Entry saved',
    word: 'Purchase',
    fields: [
      { id: 'qty', label: 'Qty' },
      { id: 'unitCost', label: 'Unit Cost' },
      { id: 'sellingPrice', label: 'Selling Price' },
      { id: 'disc', label: 'Disc' },
    ],
    main: 'qty',
    vat: true,
  },
  return: {
    title: 'Purchase Return',
    status: 'PURCHASE RETURN',
    saved: 'Purchase Return saved',
    word: 'Return',
    fields: [
      { id: 'returnQty', label: 'Return Qty' },
      { id: 'qty', label: 'Purchased Qty' },
      { id: 'unitCost', label: 'Actual Cost' },
      { id: 'sellingPrice', label: 'Selling Price' },
    ],
    main: 'returnQty',
    vat: false,
  },
}

type Props = {
  mode: PurchaseMode
  suppliers: string[]
  onClose: () => void
  /** Footer actions keep their old toast-only behaviour. */
  notify: (msg: string, kind?: 'success' | 'info' | 'error') => void
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const
const VAT_RATES = [0, 5]
const EMPTY_PAD: Record<PadField, string> = { qty: '', returnQty: '', unitCost: '', sellingPrice: '', disc: '' }

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function qtyFmt(n: number) {
  if (!Number.isFinite(n)) return '0'
  return String(parseFloat(n.toFixed(3)))
}

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function numStr(n: number) {
  return n ? String(parseFloat(n.toFixed(3))) : ''
}

function asRow(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function lineAmounts(mode: PurchaseMode, l: { qty: number; returnQty: number; unitCost: number; disc: number; vatPct: number }) {
  if (mode === 'return') {
    const base = l.returnQty * l.unitCost
    return { base, vat: 0, total: base }
  }
  const base = Math.max(0, l.qty * l.unitCost - l.disc)
  const vat = (base * l.vatPct) / 100
  return { base, vat, total: base + vat }
}

/** Product master row (GET /products). */
function mapProductRow(r: Record<string, unknown>): Item {
  const inv = asRow(r.inventory)
  return {
    productId: Number(r.productId ?? r.ProductID) || 0,
    barcode: String(r.barcode ?? r.BarCode ?? r.productCode ?? r.ProductCode ?? '').trim(),
    name: String(r.shortName || r.shortDescription || r.productName || r.ProductName || '').trim(),
    packQty: Number(inv.packQty ?? r.packQty) || 1,
    qtyOnHand: Number(inv.qtyOnHand ?? r.qtyOnHand) || 0,
    unitCost: Number(inv.lastPurchaseCost ?? inv.averageCost ?? r.lastPurchaseCost) || 0,
    sellingPrice: Number(inv.unitPrice ?? r.unitPrice) || 0,
  }
}

export default function PurchaseEntryDialog({ mode, suppliers, onClose, notify }: Props) {
  const meta = MODE[mode]
  const isReturn = mode === 'return'
  const enteredDate = useMemo(isoToday, [])
  const [supplier, setSupplier] = useState('')
  const [itemWithSupplier, setItemWithSupplier] = useState(false)
  const [docDate, setDocDate] = useState(isoToday)
  const [payMode, setPayMode] = useState<'CREDIT' | 'CASH'>('CREDIT')
  const [supInvNo, setSupInvNo] = useState('')
  const [lpoNo, setLpoNo] = useState('')
  const [purchaseRefNo, setPurchaseRefNo] = useState('')
  const [returnType, setReturnType] = useState<'With GRN' | 'Without GRN'>('With GRN')
  const [remarks, setRemarks] = useState('')
  const [roundOff, setRoundOff] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const lineKey = useRef(1)

  const [tiles, setTiles] = useState<Item[]>([])
  const [tilesState, setTilesState] = useState<'loading' | 'ready' | 'error'>('loading')

  const [pad, setPad] = useState<{ item: Item; lineKey: number | null } | null>(null)
  const [padVals, setPadVals] = useState<Record<PadField, string>>(EMPTY_PAD)
  const [padVat, setPadVat] = useState(5)
  const [padField, setPadField] = useState<PadField>(meta.main)
  const padRefs = useRef<Partial<Record<PadField, HTMLInputElement | null>>>({})

  const totals = useMemo(() => {
    let total = 0
    for (const l of lines) total += lineAmounts(mode, l).total
    return total
  }, [lines, mode])
  const netAmount = totals + (Number(roundOff) || 0)

  const lineByProduct = useMemo(() => {
    const m = new Map<number, Line>()
    for (const line of lines) m.set(line.productId, line)
    return m
  }, [lines])

  // All items for the tile grid (loaded once).
  useEffect(() => {
    let alive = true
    setTilesState('loading')
    apiService
      .fetchProducts()
      .then((rows) => {
        if (!alive) return
        setTiles(rows.map(mapProductRow).filter((p) => p.productId > 0 && p.name))
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
    const t = window.setTimeout(() => padRefs.current[padField]?.focus(), 0)
    return () => window.clearTimeout(t)
    // Only when the pad opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pad])

  function openPad(item: Item) {
    setError(null)
    const line = lineByProduct.get(item.productId)
    const src = line ?? item
    setPad({ item: src, lineKey: line?.key ?? null })
    setPadVals({
      qty: line ? numStr(line.qty) : '',
      returnQty: line ? numStr(line.returnQty) : '',
      unitCost: numStr(src.unitCost),
      sellingPrice: numStr(src.sellingPrice),
      disc: line ? numStr(line.disc) : '',
    })
    setPadVat(line ? line.vatPct : isReturn ? 0 : 5)
    setPadField(meta.main)
  }

  function setPadVal(field: PadField, v: string) {
    setPadVals((prev) => ({ ...prev, [field]: v.slice(0, 10) }))
  }

  function onPadKey(k: string) {
    const cur = padVals[padField]
    if (k === 'C') {
      setPadVal(padField, cur.slice(0, -1))
      return
    }
    if (k === '.' && cur.includes('.')) return
    setPadVal(padField, cur + k)
    padRefs.current[padField]?.focus()
  }

  function applyPad() {
    if (!pad) return
    if (!(Number(padVals[meta.main]) > 0)) {
      setError(`Enter ${isReturn ? 'return qty' : 'qty'}`)
      setPadField(meta.main)
      padRefs.current[meta.main]?.focus()
      return
    }
    const { item } = pad
    const next: Line = {
      ...item,
      key: pad.lineKey ?? lineKey.current++,
      unitCost: Number(padVals.unitCost) || 0,
      sellingPrice: Number(padVals.sellingPrice) || 0,
      qty: Number(padVals.qty) || 0,
      returnQty: Number(padVals.returnQty) || 0,
      disc: Number(padVals.disc) || 0,
      vatPct: meta.vat ? padVat : 0,
    }
    setLines((prev) =>
      pad.lineKey != null ? prev.map((l) => (l.key === pad.lineKey ? next : l)) : [...prev, next],
    )
    setError(null)
    setPad(null)
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  function clearForm() {
    setSupplier('')
    setItemWithSupplier(false)
    setDocDate(isoToday())
    setPayMode('CREDIT')
    setSupInvNo('')
    setLpoNo('')
    setPurchaseRefNo('')
    setReturnType('With GRN')
    setRemarks('')
    setRoundOff('')
    setLines([])
    setError(null)
    setPad(null)
  }

  function needLines(action: string) {
    if (lines.length > 0) return true
    setError(`Add at least one line before ${action}`)
    return false
  }

  function save() {
    if (!supplier) {
      setError('Select a supplier')
      return
    }
    if (!needLines('saving')) return
    notify(meta.saved, 'success')
    clearForm()
  }

  const padPreview = pad
    ? lineAmounts(mode, {
        qty: Number(padVals.qty) || 0,
        returnQty: Number(padVals.returnQty) || 0,
        unitCost: Number(padVals.unitCost) || 0,
        disc: Number(padVals.disc) || 0,
        vatPct: meta.vat ? padVat : 0,
      })
    : null

  return (
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-mfg pd-rcp" role="dialog" aria-modal="true" aria-labelledby="pd-purchase-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              {isReturn ? <RotateCcw size={15} strokeWidth={2} /> : <CreditCard size={15} strokeWidth={2} />}
            </div>
            <div>
              <p className="pd-mod-kicker">Purchase</p>
              <h2 id="pd-purchase-title" className="pd-mod-item-name">{meta.title}</h2>
            </div>
          </div>
          <span className="stk-head-right">
            <span className="stk-status">{meta.status}</span>
            <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
              <X size={13} />
            </button>
          </span>
        </div>

        <div className="rcp-body">
          <div className="pur-top">
            <div className="pd-form-row">
              <label>{meta.word} #</label>
              <input value="" readOnly placeholder="Auto" />
            </div>
            <div className="pd-form-row pur-supplier">
              <label>Supplier</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                <option value="">Select…</option>
                {suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="pd-form-row">
              <label>{meta.word} Date</label>
              <DatePicker value={docDate} onChange={setDocDate} />
            </div>
            <div className="pd-form-row">
              <label>Pay Mode</label>
              <div className="lst-seg pur-seg" role="radiogroup" aria-label="Pay mode">
                {(['CREDIT', 'CASH'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={payMode === m}
                    className={payMode === m ? 'is-on' : undefined}
                    onClick={() => setPayMode(m)}
                  >
                    {m === 'CREDIT' ? 'Credit' : 'Cash'}
                  </button>
                ))}
              </div>
            </div>
            <div className="pd-form-row">
              <label>Sup Inv #</label>
              <input value={supInvNo} onChange={(e) => setSupInvNo(e.target.value)} />
            </div>
            {isReturn ? (
              <div className="pd-form-row">
                <label>Purchase No</label>
                <input value={purchaseRefNo} onChange={(e) => setPurchaseRefNo(e.target.value)} />
              </div>
            ) : (
              <div className="pd-form-row">
                <label>LPO No</label>
                <input value={lpoNo} onChange={(e) => setLpoNo(e.target.value)} />
              </div>
            )}
            {isReturn ? (
              <div className="pd-form-row">
                <label>Return Type</label>
                <div className="lst-seg pur-seg" role="radiogroup" aria-label="Return type">
                  {(['With GRN', 'Without GRN'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={returnType === t}
                      className={returnType === t ? 'is-on' : undefined}
                      onClick={() => setReturnType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={`pd-form-row pur-remarks${isReturn ? ' is-short' : ''}`}>
              <label>Remark</label>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <label className="pur-check">
              <input
                type="checkbox"
                checked={itemWithSupplier}
                onChange={(e) => setItemWithSupplier(e.target.checked)}
              />
              Item with supplier
            </label>
            <span className="pur-entered">Entered {enteredDate}</span>
          </div>

          {error ? <p className="pd-mfg-msg">{error}</p> : null}

          <div className="rcp-main">
            {/* Left: lines */}
            <section className={`rcp-lines ${isReturn ? 'pret-lines' : 'pur-lines'}`}>
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    {isReturn ? (
                      <tr>
                        <th>Barcode</th>
                        <th>Description</th>
                        <th className="num">Qty</th>
                        <th className="num">Return</th>
                        <th className="num">Cost</th>
                        <th className="num">Total</th>
                        <th className="col-menu" />
                      </tr>
                    ) : (
                      <tr>
                        <th>Barcode</th>
                        <th>Description</th>
                        <th className="num">Qty</th>
                        <th className="num">Cost</th>
                        <th className="num">Disc</th>
                        <th className="num">VAT</th>
                        <th className="num">Total</th>
                        <th className="col-menu" />
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={isReturn ? 7 : 8} className="rcp-empty">Tap a product on the right to add it</td>
                      </tr>
                    ) : (
                      lines.map((line) => (
                        <tr key={line.key} className="rcp-row" onClick={() => openPad(line)}>
                          <td>{line.barcode}</td>
                          <td>{line.name}</td>
                          {isReturn ? (
                            <>
                              <td className="num">{line.qty ? qtyFmt(line.qty) : '—'}</td>
                              <td className="num rcp-qty">{qtyFmt(line.returnQty)}</td>
                              <td className="num">{money(line.unitCost)}</td>
                            </>
                          ) : (
                            <>
                              <td className="num rcp-qty">{qtyFmt(line.qty)}</td>
                              <td className="num">{money(line.unitCost)}</td>
                              <td className="num">{line.disc ? money(line.disc) : '—'}</td>
                              <td className="num">{line.vatPct}%</td>
                            </>
                          )}
                          <td className="num">{money(lineAmounts(mode, line).total)}</td>
                          <td className="col-menu">
                            <button
                              type="button"
                              className="pd-row-delete"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeLine(line.key)
                              }}
                              aria-label="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
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
                          onClick={() => openPad(p)}
                          title={p.name}
                        >
                          <span className="pd-product-name">{p.name.toLowerCase()}</span>
                          <span className="pd-product-foot">
                            <span className="pd-product-price">Cost {money(p.unitCost)}</span>
                            {line ? (
                              <span className="rcp-tile-qty">{qtyFmt(isReturn ? line.returnQty : line.qty)}</span>
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

        <div className="pd-mod-foot pur-foot">
          <div className="pur-totals">
            <span>
              Total <b>AED {money(totals)}</b>
            </span>
            <label>
              Round Off
              <input
                value={roundOff}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(e) => setRoundOff(signedDecimal(e.target.value))}
              />
            </label>
            <span className="is-net">
              Net <b>AED {money(netAmount)}</b>
            </span>
          </div>
          <span className="pd-mod-foot-spacer" />
          {isReturn ? null : (
            <button type="button" className="pd-mod-foot-btn" onClick={() => notify('Switched to Edit mode', 'info')}>
              Edit
            </button>
          )}
          <button type="button" className="pd-mod-foot-btn" onClick={() => needLines('posting') && notify('Posted', 'success')}>
            Post
          </button>
          <button type="button" className="pd-mod-foot-btn" onClick={() => notify('Posted to temp account', 'info')}>
            Acc Post Temp
          </button>
          <button type="button" className="pd-mod-foot-btn" onClick={() => needLines('printing') && notify('Sent to printer', 'success')}>
            Print
          </button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={save}>
            Save
          </button>
        </div>
      </div>

      {pad && padPreview ? (
        <div
          className="pd-mod-overlay rcp-pad-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPad(null)
          }}
        >
          <div className="pd-qty-dialog rcp-pad pur-pad" role="dialog" aria-modal="true" aria-labelledby="pur-pad-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Hash size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">
                    {pad.lineKey != null ? 'Change Line' : isReturn ? 'Return Line' : 'Purchase Line'}
                  </p>
                  <h2 id="pur-pad-title" className="pd-mod-item-name">{pad.item.name}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setPad(null)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields rcp-pad-fields">
                <div className="pur-pad-fields">
                  {meta.fields.map((f) => (
                    <label key={f.id} className={padField === f.id ? 'is-on' : undefined}>
                      <span>{f.label}</span>
                      <input
                        ref={(el) => {
                          padRefs.current[f.id] = el
                        }}
                        value={padVals[f.id]}
                        inputMode="none"
                        placeholder="0"
                        onFocus={() => setPadField(f.id)}
                        onChange={(e) => setPadVal(f.id, decimal(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            applyPad()
                          }
                          if (e.key === 'Escape') setPad(null)
                        }}
                      />
                    </label>
                  ))}
                </div>
                {meta.vat ? (
                  <div className="rcp-units pur-vat" role="radiogroup" aria-label="VAT">
                    {VAT_RATES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={padVat === v}
                        className={`rcp-unit${padVat === v ? ' is-on' : ''}`}
                        onClick={() => setPadVat(v)}
                      >
                        VAT {v}%
                      </button>
                    ))}
                  </div>
                ) : null}
                <dl className="rcp-pad-info">
                  <div>
                    <dt>Barcode · Pack</dt>
                    <dd>
                      {pad.item.barcode || '—'} · {qtyFmt(pad.item.packQty)}
                    </dd>
                  </div>
                  <div>
                    <dt>In Stock</dt>
                    <dd>{qtyFmt(pad.item.qtyOnHand)}</dd>
                  </div>
                  {meta.vat ? (
                    <div>
                      <dt>VAT</dt>
                      <dd>AED {money(padPreview.vat)}</dd>
                    </div>
                  ) : null}
                  <div className="is-total">
                    <dt>{isReturn ? 'Return Total' : 'Line Total'}</dt>
                    <dd>AED {money(padPreview.total)}</dd>
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
    </div>
  )
}
