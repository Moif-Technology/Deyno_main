/**
 * Production Entry — same layout as Recipe Entry: Production No / Date on top,
 * produced items table on the left, home-style product tiles
 * on the right. Tapping a tile opens the qty pad; Done puts the line in the table.
 *
 * There is no production endpoint yet, so Save only confirms locally (as before).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Factory, Hash, Trash2, X } from 'lucide-react'
import { apiService } from '../../api/apiService'
import { DatePicker } from '../../components/common/DatePicker'
import { decimal } from '../../utils/validate'
import './RecipeEntryDialog.css'

type Item = {
  productId: number
  barcode: string
  name: string
  /** Stock on hand when the row carries it; null → shown as "—". */
  presentQty: number | null
}

type Line = Item & { key: number; qty: number }


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


function optNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Recipe search hit (role: finished). */
function mapHit(r: Record<string, unknown>): Item {
  return {
    productId: Number(r.productId) || 0,
    barcode: String(r.barcode ?? ''),
    name: String(r.shortName || r.productName || '').trim(),
    presentQty: optNum(r.qtyOnHand ?? r.stockQty),
  }
}

export default function ProductionEntryDialog({ onClose, onSaved }: Props) {
  const [productionNo, setProductionNo] = useState('')
  const [productionDate, setProductionDate] = useState(isoToday)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const lineKey = useRef(1)

  const [tiles, setTiles] = useState<Item[]>([])
  const [tilesState, setTilesState] = useState<'loading' | 'ready' | 'error'>('loading')

  const [pad, setPad] = useState<{ item: Item; lineKey: number | null } | null>(null)
  const [padQty, setPadQty] = useState('')
  const padInputRef = useRef<HTMLInputElement | null>(null)

  const totalQty = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines])
  const lineByProduct = useMemo(() => {
    const m = new Map<number, Line>()
    for (const line of lines) m.set(line.productId, line)
    return m
  }, [lines])

  // Recipe items for the tile grid (loaded once).
  useEffect(() => {
    let alive = true
    setTilesState('loading')
    apiService
      .searchRecipeProducts({ role: 'finished' })
      .then((rows) => {
        if (!alive) return
        setTiles(rows.map((r) => mapHit(r)).filter((p) => p.productId > 0 && p.name))
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
    setPadQty(line ? qtyFmt(line.qty) : '')
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
    if (!(qty > 0)) {
      setError('Enter qty')
      padInputRef.current?.focus()
      return
    }
    const { item } = pad
    const next: Line = {
      key: pad.lineKey ?? lineKey.current++,
      productId: item.productId,
      barcode: item.barcode,
      name: item.name,
      presentQty: item.presentQty,
      qty,
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
    setProductionNo('')
    setProductionDate(isoToday())
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
      <div className="pd-ol-dialog pd-mfg pd-rcp" role="dialog" aria-modal="true" aria-labelledby="pd-production-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Factory size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Production</p>
              <h2 id="pd-production-title" className="pd-mod-item-name">Production Entry</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="rcp-body">
          <div className="rcp-top">
            <div className="pd-form-row">
              <label>Production No</label>
              <input value={productionNo} onChange={(e) => setProductionNo(e.target.value)} placeholder="Auto" />
            </div>
            <div className="pd-form-row">
              <label>Production Date</label>
              <DatePicker value={productionDate} onChange={setProductionDate} />
            </div>
          </div>

          {error ? <p className="pd-mfg-msg">{error}</p> : null}

          <div className="rcp-main">
            {/* Left: produced items */}
            <section className="rcp-lines prd-lines">
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th className="num">Present Qty</th>
                      <th className="num">Qty</th>
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
                          <td className="num">{line.presentQty == null ? '—' : qtyFmt(line.presentQty)}</td>
                          <td className="num rcp-qty">{qtyFmt(line.qty)}</td>
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
                            <span className="pd-product-price">
                              {p.presentQty == null ? p.barcode : `Stock ${qtyFmt(p.presentQty)}`}
                            </span>
                            {line ? <span className="rcp-tile-qty">{qtyFmt(line.qty)}</span> : null}
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
          <div className="pd-qty-dialog rcp-pad" role="dialog" aria-modal="true" aria-labelledby="prd-pad-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Hash size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">{pad.lineKey != null ? 'Change Qty' : 'Production Qty'}</p>
                  <h2 id="prd-pad-title" className="pd-mod-item-name">{pad.item.name}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setPad(null)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields rcp-pad-fields">
                <div className="rcp-pad-qty">
                  <span>Qty</span>
                  <input
                    ref={padInputRef}
                    className="pd-qty-input"
                    value={padQty}
                    inputMode="decimal"
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
                    <dt>Item Code</dt>
                    <dd>{pad.item.barcode || '—'}</dd>
                  </div>
                  <div>
                    <dt>Present Qty</dt>
                    <dd>{pad.item.presentQty == null ? '—' : qtyFmt(pad.item.presentQty)}</dd>
                  </div>
                  {pad.item.presentQty != null ? (
                    <div className="is-total">
                      <dt>After Production</dt>
                      <dd>{qtyFmt(pad.item.presentQty + (Number(padQty) || 0))}</dd>
                    </div>
                  ) : null}
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
