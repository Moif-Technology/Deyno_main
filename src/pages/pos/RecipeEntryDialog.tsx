/**
 * Recipe Details Entry — same units and cost rules as the VB form.
 * GM/ML are stored as KG/LT. Line cost uses the ingredient average cost.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'

type ProductHit = {
  productId: number
  barcode: string
  productName: string
  shortName: string
  packDescription: string
  packQty: number
  averageCost: number
  uniqueId: number
}

type Line = {
  key: number
  rawProductId: number
  barcode: string
  productName: string
  packDescription: string
  packQty: number
  unit: string
  enteredQty: number
  qtyDisplay: string
  lineCost: number
}

type Props = {
  finishedProductId?: number | null
  onClose: () => void
  onOpenList: () => void
}

const UNITS = ['GM', 'KG', 'ML', 'LT', 'METER', 'PCS'] as const

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
  }
}

export default function RecipeEntryDialog({ finishedProductId, onClose, onOpenList }: Props) {
  const [finished, setFinished] = useState<ProductHit | null>(null)
  const [finishedQuery, setFinishedQuery] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [remarks, setRemarks] = useState('')
  const [hasSaved, setHasSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [packet, setPacket] = useState('')
  const [packQty, setPackQty] = useState('')
  const [cost, setCost] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('GM')
  const [picked, setPicked] = useState<ProductHit | null>(null)
  const [hits, setHits] = useState<ProductHit[]>([])
  const [hitOpen, setHitOpen] = useState<'finished' | 'ingredient' | null>(null)
  const [hitIndex, setHitIndex] = useState(0)
  const lineKey = useRef(1)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        return {
          key: lineKey.current++,
          rawProductId: Number(line.rawProductId) || 0,
          barcode: String(line.barcode ?? ''),
          productName: String(line.productName ?? ''),
          packDescription: String(line.packDescription ?? ''),
          packQty: Number(line.packQty) || 1,
          unit: String(line.unit ?? 'PCS'),
          enteredQty: Number(line.enteredQty) || 0,
          qtyDisplay: String(line.qtyDisplay ?? ''),
          lineCost: Number(line.lineCost) || 0,
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

  function clearIngredient() {
    setBarcode('')
    setName('')
    setPacket('')
    setPackQty('')
    setCost('')
    setQty('')
    setUnit('GM')
    setPicked(null)
    setHits([])
    setHitOpen(null)
  }

  function clearForm() {
    setFinished(null)
    setFinishedQuery('')
    setLines([])
    setRemarks('')
    setHasSaved(false)
    setHint(null)
    setError(null)
    clearIngredient()
  }

  async function search(role: 'finished' | 'ingredient' | 'raw', text: string, exact = false) {
    const q = text.trim()
    if (!q) {
      setHits([])
      setHitOpen(null)
      return []
    }
    const list = await apiService.searchRecipeProducts({
      role,
      q,
      mode: exact ? 'exact' : 'contains',
    })
    return list.map((row) => mapHit(row as Record<string, unknown>)).filter((p) => p.productId > 0)
  }

  async function onFinishedChange(value: string) {
    setFinishedQuery(value)
    setFinished(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const found = await search('finished', value)
        setHits(found)
        setHitIndex(0)
        setHitOpen(found.length ? 'finished' : null)
      } catch (err) {
        setError(errMessage(err, 'Product search failed'))
      }
    }, 220)
  }

  async function chooseFinished(product: ProductHit) {
    setHitOpen(null)
    setHits([])
    setBusy(true)
    setError(null)
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

  function applyIngredient(product: ProductHit) {
    setPicked(product)
    setBarcode(product.barcode)
    setName(product.shortName || product.productName)
    setPacket(product.packDescription)
    setPackQty(String(product.packQty))
    setCost(String(product.averageCost))
    setHits([])
    setHitOpen(null)
  }

  async function lookupIngredient(field: 'barcode' | 'name') {
    const value = (field === 'barcode' ? barcode : name).trim()
    if (!value) return
    try {
      const found = field === 'barcode'
        ? (await apiService.searchRecipeProducts({ role: 'ingredient', barcode: value, mode: 'exact' })).map((r) => mapHit(r))
        : await search('ingredient', value, true)
      if (found.length === 1) {
        applyIngredient(found[0])
        return
      }
      if (found.length === 0) {
        setError('Item not found')
        setHitOpen(null)
        return
      }
      setHits(found)
      setHitIndex(0)
      setHitOpen('ingredient')
    } catch (err) {
      setError(errMessage(err, 'Item not found'))
    }
  }

  function onHitKey(e: KeyboardEvent<HTMLInputElement>, choose: (p: ProductHit) => void) {
    if (!hitOpen || hits.length === 0) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHitIndex((i) => Math.min(i + 1, hits.length - 1))
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHitIndex((i) => Math.max(i - 1, 0))
      return true
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const pick = hits[hitIndex] ?? hits[0]
      if (pick) choose(pick)
      return true
    }
    if (e.key === 'Escape') {
      setHitOpen(null)
      return true
    }
    return false
  }

  function addLine() {
    setError(null)
    if (!picked) {
      setError('Select an item')
      return
    }
    const entered = Number(qty)
    if (!(entered > 0)) {
      setError('Enter qty')
      return
    }
    if (finished && picked.productId === finished.productId) {
      setError('Finished product cannot be added as its own raw material')
      return
    }
    const amounts = lineAmounts(picked.averageCost, entered, unit)
    if (!amounts) {
      setError('Enter a valid qty and unit')
      return
    }
    const lineCost = Math.round((amounts.lineCost + Number.EPSILON) * 100) / 100
    setLines((prev) => [
      ...prev,
      {
        key: lineKey.current++,
        rawProductId: picked.productId,
        barcode: picked.barcode,
        productName: picked.shortName || picked.productName,
        packDescription: picked.packDescription,
        packQty: picked.packQty,
        unit: amounts.unit,
        enteredQty: entered,
        qtyDisplay: `${qtyFmt(entered)}(${amounts.unit})`,
        lineCost,
      },
    ])
    clearIngredient()
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
      setHint(hasSaved ? 'Recipe details updated' : 'Recipe details saved')
      clearForm()
    } catch (err) {
      setError(errMessage(err, 'Could not save recipe'))
    } finally {
      setBusy(false)
    }
  }

  async function openRawPicker() {
    try {
      const list = await apiService.searchRecipeProducts({ role: 'raw', q: name.trim() || undefined })
      const found = list.map((row) => mapHit(row)).filter((p) => p.productId > 0)
      setHits(found)
      setHitIndex(0)
      setHitOpen(found.length ? 'ingredient' : null)
      if (!found.length) setError('No raw material items')
    } catch (err) {
      setError(errMessage(err, 'Could not search raw materials'))
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
      <div className="pd-inv pd-stk is-report" role="dialog" aria-modal="true" aria-labelledby="pd-recipe-title">
        <header className="pd-inv-head">
          <div className="pd-inv-head-left">
            <div>
              <p className="pd-mod-kicker">Manufacturing</p>
              <h2 id="pd-recipe-title">Recipe Entry</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={13} />
          </button>
        </header>

        <div className="pd-stk-entry">
          <label className="pd-stk-remarks">
            <span>Finished product</span>
            <span className="pd-inv-search">
              <Search size={13} />
              <input
                value={finishedQuery}
                onChange={(e) => void onFinishedChange(e.target.value)}
                onKeyDown={(e) => onHitKey(e, (p) => void chooseFinished(p))}
                placeholder="Not a raw material"
                autoComplete="off"
              />
            </span>
          </label>
          <label>
            <span>Barcode</span>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (onHitKey(e, applyIngredient)) return
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void lookupIngredient('barcode')
                }
              }}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Item name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (onHitKey(e, applyIngredient)) return
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void lookupIngredient('name')
                }
              }}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Pack</span>
            <input value={packet} readOnly />
          </label>
          <label>
            <span>Pack qty</span>
            <input value={packQty} readOnly />
          </label>
          <label>
            <span>Cost</span>
            <input value={cost} readOnly />
          </label>
          <label>
            <span>Qty</span>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addLine()
              }}
            />
          </label>
          <label>
            <span>Unit</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <button type="button" className="pd-inv-go pd-stk-add" onClick={addLine} disabled={busy}>
            <Plus size={14} />
            Add
          </button>
          <button type="button" className="pd-inv-ghost" onClick={() => void openRawPicker()} disabled={busy}>
            Raw
          </button>
          {hitOpen && hits.length > 0 ? (
            <div className="pd-stk-hits" role="listbox" aria-label="Items">
              {hits.map((h, i) => (
                <button
                  key={h.productId}
                  type="button"
                  role="option"
                  aria-selected={i === hitIndex}
                  className={i === hitIndex ? 'is-active' : undefined}
                  onMouseEnter={() => setHitIndex(i)}
                  onClick={() => (hitOpen === 'finished' ? void chooseFinished(h) : applyIngredient(h))}
                >
                  <strong>{h.barcode || '—'}</strong>
                  <span>{h.productName}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="pd-inv-msg">{error}</p> : null}
        {hint ? <p className="pd-stk-ok">{hint}</p> : null}

        <div className="pd-stk-grid-wrap">
          <table className="pd-inv-grid">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Product</th>
                <th>Pack</th>
                <th className="num">Qty</th>
                <th className="num">Cost</th>
                <th>Unit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="pd-inv-empty">
                    Choose a finished product, add raw materials, then Save.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.key}>
                    <td>{line.barcode}</td>
                    <td>{line.productName}</td>
                    <td>{line.packDescription}</td>
                    <td className="num">{line.qtyDisplay}</td>
                    <td className="num">{moneyFmt(line.lineCost)}</td>
                    <td>{line.unit}</td>
                    <td>
                      <button type="button" className="pd-stk-del" onClick={() => removeLine(line.key)} aria-label="Delete">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="pd-inv-foot">
          <span className="pd-inv-total">UNIT COST : {moneyFmt(unitCostTotal)}</span>
          <label className="pd-stk-remarks" style={{ flex: 1 }}>
            <span>Remarks</span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </label>
          <button type="button" className="pd-inv-ghost" onClick={onOpenList}>List</button>
          <button type="button" className="pd-inv-ghost" onClick={clearForm} disabled={busy}>New</button>
          <button type="button" className="pd-inv-go" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : hasSaved ? 'Update' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  )
}
