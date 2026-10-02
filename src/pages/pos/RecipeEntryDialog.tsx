/**
 * Recipe Details Entry — same units and cost rules as the VB form.
 * GM/ML are stored as KG/LT. Line cost uses the ingredient average cost.
 *
 * Layout: finished product on top; recipe table on the left; a home-screen style
 * grid of raw-material tiles on the right. Tapping a tile opens a
 * qty + unit pad, and Done puts the line in the table.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChefHat, Hash, Search, Trash2, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { decimal } from '../../utils/validate'
import './RecipeEntryDialog.css'

type ProductHit = {
  productId: number
  barcode: string
  productName: string
  shortName: string
  packDescription: string
  packQty: number
  averageCost: number
  uniqueId: number
  /** Stock unit, when the row carries one — picks the pad's starting unit. */
  unit?: string
}

type Line = {
  key: number
  rawProductId: number
  barcode: string
  productName: string
  packDescription: string
  packQty: number
  averageCost: number
  unit: string
  enteredQty: number
  qtyDisplay: string
  lineCost: number
}

type Props = {
  finishedProductId?: number | null
  onClose: () => void
}


const UNITS = ['GM', 'KG', 'ML', 'LT', 'METER', 'PCS'] as const
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function qtyFmt(n: number) {
  if (!Number.isFinite(n)) return '0'
  return String(parseFloat(n.toFixed(6)))
}

function moneyFmt(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '0.00'
  return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function lineAmounts(averageCost: number, enteredQty: number, unit: string) {
  const u = unit.toUpperCase()
  const cost = Number(averageCost) || 0
  if (!(enteredQty > 0)) return null
  if (u === 'GM' || u === 'ML') {
    return { unit: u, lineCost: (cost / 1000) * enteredQty }
  }
  if (u === 'KG' || u === 'LT' || u === 'METER' || u === 'PCS') {
    return { unit: u, lineCost: cost * enteredQty }
  }
  return null
}

/** Average cost back out of a saved line (GM/ML lines are priced per 1000). */
function costFromLine(lineCost: number, enteredQty: number, unit: string) {
  if (!(enteredQty > 0)) return 0
  const per = lineCost / enteredQty
  const u = unit.toUpperCase()
  return u === 'GM' || u === 'ML' ? per * 1000 : per
}

/** Pad's starting unit from the item's stock unit: KG → GM, LT → ML, else as-is. */
function defaultUnit(stockUnit?: string): (typeof UNITS)[number] {
  const u = String(stockUnit ?? '').trim().toUpperCase()
  if (u === 'PCS' || u === 'NOS' || u === 'BOX') return 'PCS'
  if (u === 'LT' || u === 'LTR' || u === 'ML') return 'ML'
  if (u === 'METER') return 'METER'
  return 'GM'
}

function mapHit(r: Record<string, unknown>): ProductHit {
  return {
    productId: Number(r.productId) || 0,
    barcode: String(r.barcode ?? ''),
    productName: String(r.productName ?? ''),
    shortName: String(r.shortName ?? ''),
    packDescription: String(r.packDescription ?? ''),
    packQty: Number(r.packQty) || 1,
    averageCost: Number(r.averageCost) || 0,
    uniqueId: Number(r.uniqueId) || Number(r.productId) || 0,
    unit: String(r.unitName ?? r.unit ?? ''),
  }
}

function displayName(p: ProductHit) {
  return p.shortName || p.productName
}

export default function RecipeEntryDialog({ finishedProductId, onClose }: Props) {
  const [finished, setFinished] = useState<ProductHit | null>(null)
  const [finishedQuery, setFinishedQuery] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [remarks, setRemarks] = useState('')
  const [hasSaved, setHasSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const [hits, setHits] = useState<ProductHit[]>([])
  const [hitOpen, setHitOpen] = useState(false)
  const [hitIndex, setHitIndex] = useState(0)
  const lineKey = useRef(1)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Catalogue (right side)
  const [tiles, setTiles] = useState<ProductHit[]>([])
  const [tilesState, setTilesState] = useState<'loading' | 'ready' | 'error'>('loading')

  // Qty pad
  const [pad, setPad] = useState<{ product: ProductHit; lineKey: number | null } | null>(null)
  const [padQty, setPadQty] = useState('')
  const [padUnit, setPadUnit] = useState<(typeof UNITS)[number]>('GM')
  const padInputRef = useRef<HTMLInputElement | null>(null)

  const unitCostTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.lineCost, 0),
    [lines],
  )

  function applyFinished(recipe: Record<string, unknown>) {
    const product: ProductHit = {
      productId: Number(recipe.finishedProductId) || 0,
      barcode: String(recipe.barcode ?? ''),
      productName: String(recipe.productName ?? ''),
      shortName: String(recipe.shortName ?? ''),
      packDescription: '',
      packQty: 1,
      averageCost: 0,
      uniqueId: Number(recipe.finishedUniqueId) || Number(recipe.finishedProductId) || 0,
    }
    setFinished(product)
    setFinishedQuery(product.productName)
    setRemarks(String(recipe.remarks ?? ''))
    const rawLines = Array.isArray(recipe.lines) ? recipe.lines : []
    setLines(
      rawLines.map((row) => {
        const line = row as Record<string, unknown>
        const unit = String(line.unit ?? 'PCS')
        const enteredQty = Number(line.enteredQty) || 0
        const lineCost = Number(line.lineCost) || 0
        return {
          key: lineKey.current++,
          rawProductId: Number(line.rawProductId) || 0,
          barcode: String(line.barcode ?? ''),
          productName: String(line.productName ?? ''),
          packDescription: String(line.packDescription ?? ''),
          packQty: Number(line.packQty) || 1,
          averageCost: Number(line.averageCost) || costFromLine(lineCost, enteredQty, unit),
          unit,
          enteredQty,
          qtyDisplay: String(line.qtyDisplay ?? ''),
          lineCost,
        }
      }),
    )
    setHasSaved(rawLines.length > 0)
  }

  useEffect(() => {
    if (!finishedProductId) return
    let alive = true
    setBusy(true)
    apiService
      .fetchRecipe(finishedProductId)
      .then((res) => {
        if (!alive) return
        const recipe = (res.recipe ?? res) as Record<string, unknown>
        applyFinished(recipe)
      })
      .catch((err) => setError(errMessage(err, 'Could not load recipe')))
      .finally(() => {
        if (alive) setBusy(false)
      })
    return () => {
      alive = false
    }
  }, [finishedProductId])

  // Raw materials for the tile grid (loaded once).
  useEffect(() => {
    let alive = true
    setTilesState('loading')
    apiService
      .searchRecipeProducts({ role: 'raw' })
      .then((rows) => {
        if (!alive) return
        setTiles(rows.map((r) => mapHit(r)).filter((p) => p.productId > 0 && p.productName))
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

  const shownTiles = useMemo(
    () => tiles.filter((p) => !finished || p.productId !== finished.productId),
    [tiles, finished],
  )

  const qtyByProduct = useMemo(() => {
    const m = new Map<number, Line>()
    for (const line of lines) m.set(line.rawProductId, line)
    return m
  }, [lines])

  function clearForm() {
    setFinished(null)
    setFinishedQuery('')
    setLines([])
    setRemarks('')
    setHasSaved(false)
    setHint(null)
    setError(null)
    setHits([])
    setHitOpen(false)
    setPad(null)
  }

  async function onFinishedChange(value: string) {
    setFinishedQuery(value)
    setFinished(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const q = value.trim()
      if (!q) {
        setHits([])
        setHitOpen(false)
        return
      }
      try {
        const list = await apiService.searchRecipeProducts({ role: 'finished', q, mode: 'contains' })
        const found = list.map((row) => mapHit(row)).filter((p) => p.productId > 0)
        setHits(found)
        setHitIndex(0)
        setHitOpen(found.length > 0)
      } catch (err) {
        setError(errMessage(err, 'Product search failed'))
      }
    }, 220)
  }

  async function chooseFinished(product: ProductHit) {
    setHitOpen(false)
    setHits([])
    setBusy(true)
    setError(null)
    setHint(null)
    try {
      const res = await apiService.fetchRecipe(product.productId)
      const recipe = (res.recipe ?? res) as Record<string, unknown>
      applyFinished(recipe)
    } catch (err) {
      setError(errMessage(err, 'Could not load recipe'))
    } finally {
      setBusy(false)
    }
  }

  function onFinishedKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!hitOpen || hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHitIndex((i) => Math.min(i + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHitIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = hits[hitIndex] ?? hits[0]
      if (pick) void chooseFinished(pick)
    } else if (e.key === 'Escape') {
      setHitOpen(false)
    }
  }

  function openPad(product: ProductHit, existing?: Line) {
    setError(null)
    if (!finished) {
      setError('Select finished product first')
      return
    }
    if (product.productId === finished.productId) {
      setError('Finished product cannot be added as its own raw material')
      return
    }
    const line = existing ?? lines.find((l) => l.rawProductId === product.productId)
    setPad({ product, lineKey: line?.key ?? null })
    setPadQty(line ? qtyFmt(line.enteredQty) : '')
    setPadUnit(line ? (UNITS.find((u) => u === line.unit.toUpperCase()) ?? 'GM') : defaultUnit(product.unit))
  }

  function openLine(line: Line) {
    openPad(
      {
        productId: line.rawProductId,
        barcode: line.barcode,
        productName: line.productName,
        shortName: '',
        packDescription: line.packDescription,
        packQty: line.packQty,
        averageCost: line.averageCost,
        uniqueId: line.rawProductId,
      },
      line,
    )
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
    const entered = Number(padQty)
    const amounts = lineAmounts(pad.product.averageCost, entered, padUnit)
    if (!(entered > 0) || !amounts) {
      setError('Enter qty')
      padInputRef.current?.focus()
      return
    }
    const p = pad.product
    const next: Line = {
      key: pad.lineKey ?? lineKey.current++,
      rawProductId: p.productId,
      barcode: p.barcode,
      productName: displayName(p),
      packDescription: p.packDescription,
      packQty: p.packQty,
      averageCost: p.averageCost,
      unit: amounts.unit,
      enteredQty: entered,
      qtyDisplay: `${qtyFmt(entered)}(${amounts.unit})`,
      lineCost: Math.round((amounts.lineCost + Number.EPSILON) * 100) / 100,
    }
    setLines((prev) =>
      pad.lineKey != null ? prev.map((l) => (l.key === pad.lineKey ? next : l)) : [...prev, next],
    )
    setError(null)
    setPad(null)
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((line) => line.key !== key))
  }

  async function save() {
    if (!finished?.productId) {
      setError('Select finished product')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one raw material')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiService.saveRecipe(finished.productId, {
        remarks,
        lines: lines.map((line) => ({
          rawProductId: line.rawProductId,
          enteredQty: line.enteredQty,
          unit: line.unit,
          lineCost: line.lineCost,
        })),
      })
      const msg = hasSaved ? 'Recipe details updated' : 'Recipe details saved'
      clearForm()
      setHint(msg)
    } catch (err) {
      setError(errMessage(err, 'Could not save recipe'))
    } finally {
      setBusy(false)
    }
  }

  const padPreview = pad ? lineAmounts(pad.product.averageCost, Number(padQty), padUnit) : null

  return (
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-mfg pd-rcp" role="dialog" aria-modal="true" aria-labelledby="pd-recipe-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <ChefHat size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Manufacturing</p>
              <h2 id="pd-recipe-title" className="pd-mod-item-name">Recipe Entry</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={13} />
          </button>
        </div>

        <div className="rcp-body">
          {/* Top: finished product */}
          <div className="rcp-top">
            <div className="pd-form-row pd-mfg-search rcp-finished">
              <label>Finished Product</label>
              <span className="pd-mfg-search-box">
                <Search size={14} />
                <input
                  value={finishedQuery}
                  onChange={(e) => void onFinishedChange(e.target.value)}
                  onKeyDown={onFinishedKey}
                  placeholder="Search finished product"
                  autoComplete="off"
                  autoFocus
                />
              </span>
              {hitOpen && hits.length > 0 ? (
                <div className="pd-stk-hits pd-mfg-hits" role="listbox" aria-label="Items">
                  {hits.map((h, i) => (
                    <button
                      key={h.productId}
                      type="button"
                      role="option"
                      aria-selected={i === hitIndex}
                      className={i === hitIndex ? 'is-active' : undefined}
                      onMouseEnter={() => setHitIndex(i)}
                      onClick={() => void chooseFinished(h)}
                    >
                      <strong>{h.barcode || '—'}</strong>
                      <span>{h.productName}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="pd-form-row rcp-remarks">
              <label>Remarks</label>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>

          {error ? <p className="pd-mfg-msg">{error}</p> : null}
          {hint ? <p className="pd-mfg-ok">{hint}</p> : null}

          <div className="rcp-main">
            {/* Left: recipe lines */}
            <section className="rcp-lines">
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Product</th>
                      <th>Pack</th>
                      <th className="num">Qty</th>
                      <th className="num">Cost</th>
                      <th>Unit</th>
                      <th className="col-menu" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="rcp-empty">
                          {finished
                            ? 'Tap a product on the right to add it'
                            : 'Choose a finished product, add raw materials, then Save'}
                        </td>
                      </tr>
                    ) : (
                      lines.map((line) => (
                        <tr key={line.key} className="rcp-row" onClick={() => openLine(line)}>
                          <td>{line.barcode}</td>
                          <td>{line.productName}</td>
                          <td>{line.packDescription}</td>
                          <td className="num rcp-qty">{qtyFmt(line.enteredQty)}</td>
                          <td className="num">{moneyFmt(line.lineCost)}</td>
                          <td>{line.unit}</td>
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
                  {!finished ? (
                    <div className="rcp-tiles-wait">
                      <Search size={22} />
                      <strong>Search a finished product</strong>
                      <span>Its raw materials will show here.</span>
                    </div>
                  ) : tilesState === 'loading' ? (
                    <p className="pd-cat-msg">Loading items…</p>
                  ) : tilesState === 'error' ? (
                    <p className="pd-cat-msg">Could not load items</p>
                  ) : shownTiles.length === 0 ? (
                    <p className="pd-cat-msg">No items</p>
                  ) : (
                    shownTiles.map((p) => {
                      const inRecipe = qtyByProduct.get(p.productId)
                      return (
                        <button
                          key={p.productId}
                          type="button"
                          className={`pd-product rcp-tile${inRecipe ? ' is-in' : ''}`}
                          onClick={() => openPad(p)}
                          title={p.productName}
                        >
                          <span className="pd-product-name">{displayName(p).toLowerCase()}</span>
                          <span className="pd-product-foot">
                            <span className="pd-product-price">AED {moneyFmt(p.averageCost)}</span>
                            {inRecipe ? (
                              <span className="rcp-tile-qty">
                                {qtyFmt(inRecipe.enteredQty)} {inRecipe.unit}
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
            {lines.length} item{lines.length === 1 ? '' : 's'} · Unit Cost: <strong>AED {moneyFmt(unitCostTotal)}</strong>
          </span>
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn" onClick={clearForm} disabled={busy}>New</button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : hasSaved ? 'Update' : 'Save'}
          </button>
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
          <div className="pd-qty-dialog rcp-pad" role="dialog" aria-modal="true" aria-labelledby="rcp-pad-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Hash size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">{pad.lineKey != null ? 'Change Qty' : 'Raw Material Qty'}</p>
                  <h2 id="rcp-pad-title" className="pd-mod-item-name">{displayName(pad.product)}</h2>
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
                <div className="rcp-units" role="radiogroup" aria-label="Unit">
                  {UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={padUnit === u}
                      className={`rcp-unit${padUnit === u ? ' is-on' : ''}`}
                      onClick={() => {
                        setPadUnit(u)
                        padInputRef.current?.focus()
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <dl className="rcp-pad-info">
                  <div>
                    <dt>Barcode</dt>
                    <dd>{pad.product.barcode || '—'}</dd>
                  </div>
                  <div>
                    <dt>Pack</dt>
                    <dd>{pad.product.packDescription || pad.product.packQty}</dd>
                  </div>
                  <div>
                    <dt>Avg Cost</dt>
                    <dd>AED {moneyFmt(pad.product.averageCost)}</dd>
                  </div>
                  <div className="is-total">
                    <dt>Line Cost</dt>
                    <dd>AED {moneyFmt(padPreview?.lineCost ?? 0)}</dd>
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
