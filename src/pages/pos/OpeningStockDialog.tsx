/**
 * Opening Stock Entry — same layout as Recipe Entry: Entry No / Date on top,
 * lines table on the left, home-style product tiles on the
 * right. Tapping a tile opens the qty pad; Done puts the line in the table.
 *
 * There is no opening-stock endpoint yet, so Save only confirms locally (as before).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Hash, ShoppingBag, Trash2, X } from 'lucide-react'
import { apiService } from '../../api/apiService'
import { DatePicker } from '../../components/common/DatePicker'
import { decimal } from '../../utils/validate'
import './RecipeEntryDialog.css'

type Item = {
  productId: number
  barcode: string
  name: string
  packetDetails: string
  packQty: number
  qtyOnHand: number
}

type Line = Item & { key: number; openingQty: number }


type Props = {
  onClose: () => void
  onSaved: (lineCount: number) => void
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function qtyFmt(n: number) {
  if (!Number.isFinite(n)) return '0'
  return String(parseFloat(n.toFixed(3)))
}

function asRow(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** Product master row (GET /products). */
function mapProductRow(r: Record<string, unknown>): Item {
  const inv = asRow(r.inventory)
  return {
    productId: Number(r.productId ?? r.ProductID) || 0,
    barcode: String(r.barcode ?? r.BarCode ?? r.productCode ?? r.ProductCode ?? '').trim(),
    name: String(r.shortName || r.shortDescription || r.productName || r.ProductName || '').trim(),
    packetDetails: String(r.packDescription ?? r.packetDetails ?? ''),
    packQty: Number(inv.packQty ?? r.packQty) || 1,
    qtyOnHand: Number(inv.qtyOnHand ?? r.qtyOnHand) || 0,
  }
}

export default function OpeningStockDialog({ onClose, onSaved }: Props) {
  const [entryNo, setEntryNo] = useState('')
  const [entryDate, setEntryDate] = useState(isoToday)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const lineKey = useRef(1)

  const [tiles, setTiles] = useState<Item[]>([])
  const [tilesState, setTilesState] = useState<'loading' | 'ready' | 'error'>('loading')

  const [pad, setPad] = useState<{ item: Item; lineKey: number | null } | null>(null)
  const [padQty, setPadQty] = useState('')
  const padInputRef = useRef<HTMLInputElement | null>(null)

  const totalQty = useMemo(() => lines.reduce((sum, l) => sum + l.openingQty, 0), [lines])
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
    const t = window.setTimeout(() => padInputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [pad])

  function openPad(item: Item) {
    setError(null)
    const line = lineByProduct.get(item.productId)
    setPad({ item: line ?? item, lineKey: line?.key ?? null })
    setPadQty(line ? qtyFmt(line.openingQty) : '')
  }

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
    const qty = Number(padQty)
    if (padQty === '' || !(qty >= 0)) {
      setError('Enter opening stock')
      padInputRef.current?.focus()
      return
    }
    const { item } = pad
    const next: Line = {
      key: pad.lineKey ?? lineKey.current++,
      productId: item.productId,
      barcode: item.barcode,
      name: item.name,
      packetDetails: item.packetDetails,
      packQty: item.packQty,
      qtyOnHand: item.qtyOnHand,
      openingQty: qty,
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
    setEntryNo('')
    setEntryDate(isoToday())
    setLines([])
    setError(null)
    setPad(null)
  }

  function save() {
    if (lines.length === 0) {
      setError('Add at least one item')
      return
    }
    onSaved(lines.length)
    clearForm()
  }

  return (
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-mfg pd-rcp" role="dialog" aria-modal="true" aria-labelledby="pd-opening-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <ShoppingBag size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Transactions</p>
              <h2 id="pd-opening-title" className="pd-mod-item-name">Opening Stock Entry</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="rcp-body">
          <div className="rcp-top">
            <div className="pd-form-row">
              <label>Entry No</label>
              <input value={entryNo} onChange={(e) => setEntryNo(e.target.value)} placeholder="Auto" />
            </div>
            <div className="pd-form-row">
              <label>Date</label>
              <DatePicker value={entryDate} onChange={setEntryDate} />
            </div>
          </div>

          {error ? <p className="pd-mfg-msg">{error}</p> : null}

          <div className="rcp-main">
            {/* Left: opening stock lines */}
            <section className="rcp-lines opn-lines">
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Short Description</th>
                      <th>Packet Details</th>
                      <th className="num">Opening Stock</th>
                      <th className="col-menu" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="rcp-empty">Tap a product on the right to add it</td>
                      </tr>
                    ) : (
                      lines.map((line) => (
                        <tr key={line.key} className="rcp-row" onClick={() => openPad(line)}>
                          <td>{line.barcode}</td>
                          <td>{line.name}</td>
                          <td>{line.packetDetails}</td>
                          <td className="num rcp-qty">{qtyFmt(line.openingQty)}</td>
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
                            <span className="pd-product-price">Stock {qtyFmt(p.qtyOnHand)}</span>
                            {line ? <span className="rcp-tile-qty">{qtyFmt(line.openingQty)}</span> : null}
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
            {lines.length} item{lines.length === 1 ? '' : 's'} · Total Qty: <strong>{qtyFmt(totalQty)}</strong>
          </span>
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn" onClick={clearForm}>New</button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={save}>Save</button>
        </div>
      </div>

      {pad ? (
        <div
          className="pd-mod-overlay rcp-pad-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPad(null)
          }}
        >
          <div className="pd-qty-dialog rcp-pad" role="dialog" aria-modal="true" aria-labelledby="opn-pad-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Hash size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">{pad.lineKey != null ? 'Change Qty' : 'Opening Stock'}</p>
                  <h2 id="opn-pad-title" className="pd-mod-item-name">{pad.item.name}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setPad(null)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields rcp-pad-fields">
                <div className="rcp-pad-qty">
                  <span>Opening Stock</span>
                  <input
                    ref={padInputRef}
                    className="pd-qty-input"
                    value={padQty}
                    inputMode="none"
                    placeholder="0"
                    onChange={(e) => setPadQty(decimal(e.target.value).slice(0, 10))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyPad()
                      }
                      if (e.key === 'Escape') setPad(null)
                    }}
                  />
                </div>
                <dl className="rcp-pad-info">
                  <div>
                    <dt>Barcode</dt>
                    <dd>{pad.item.barcode || '—'}</dd>
                  </div>
                  <div>
                    <dt>Packet Details</dt>
                    <dd>{pad.item.packetDetails || '—'}</dd>
                  </div>
                  <div>
                    <dt>Pack Qty</dt>
                    <dd>{qtyFmt(pad.item.packQty)}</dd>
                  </div>
                  <div className="is-total">
                    <dt>Current Stock</dt>
                    <dd>{qtyFmt(pad.item.qtyOnHand)}</dd>
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
