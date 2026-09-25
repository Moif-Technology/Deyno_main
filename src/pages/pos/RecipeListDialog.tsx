/**
 * Recipe list — products that already have a recipe. Double-click opens entry.
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'

type Props = {
  onClose: () => void
  onSelect: (finishedProductId: number) => void
  onNew: () => void
}

type Row = {
  finishedProductId: number
  barcode: string
  productName: string
  lineCount: number
  unitCostTotal: number
  remarks: string
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function moneyFmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function RecipeListDialog({ onClose, onSelect, onNew }: Props) {
  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function load(filters = { name, barcode }) {
    setState('loading')
    setError(null)
    try {
      const list = await apiService.fetchRecipes({
        q: filters.name.trim() || undefined,
        barcode: filters.barcode.trim() || undefined,
      })
      setRows(
        list.map((r) => ({
          finishedProductId: Number(r.finishedProductId) || 0,
          barcode: String(r.barcode ?? ''),
          productName: String(r.productName ?? ''),
          lineCount: Number(r.lineCount) || 0,
          unitCostTotal: Number(r.unitCostTotal) || 0,
          remarks: String(r.remarks ?? ''),
        })),
      )
      setSelected(null)
      setState('idle')
    } catch (err) {
      setRows([])
      setState('error')
      setError(errMessage(err, 'Could not load recipes'))
    }
  }

  useEffect(() => {
    void load({ name: '', barcode: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function removeSelected() {
    if (!selected) return
    const row = rows.find((r) => r.finishedProductId === selected)
    if (!row) return
    if (!window.confirm(`Delete the recipe for ${row.productName}?`)) return
    try {
      await apiService.deleteRecipe(selected)
      await load()
    } catch (err) {
      setError(errMessage(err, 'Could not delete recipe'))
    }
  }

  return (
    <div
      className="pd-mod-overlay pd-inv-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-inv pd-stk-list" role="dialog" aria-modal="true" aria-labelledby="pd-recipe-list-title">
        <header className="pd-inv-head">
          <div className="pd-inv-head-left">
            <div>
              <p className="pd-mod-kicker">Manufacturing</p>
              <h2 id="pd-recipe-list-title">Recipe List</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        <div className="pd-stk-list-filters">
          <label>
            <span>Product name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>Barcode</span>
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </label>
          <button type="button" className="pd-inv-go" onClick={() => void load()} disabled={state === 'loading'}>
            {state === 'loading' ? 'Loading…' : 'Search'}
          </button>
        </div>

        {error ? <p className="pd-inv-msg">{error}</p> : null}

        <div className="pd-stk-grid-wrap">
          <table className="pd-inv-grid">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Finished product</th>
                <th className="num">Lines</th>
                <th className="num">Unit cost</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {state !== 'loading' && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="pd-inv-empty">No recipes for this counter yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.finishedProductId}
                    className={selected === row.finishedProductId ? 'is-sel' : undefined}
                    onClick={() => setSelected(row.finishedProductId)}
                    onDoubleClick={() => onSelect(row.finishedProductId)}
                  >
                    <td>{row.barcode || '—'}</td>
                    <td>{row.productName}</td>
                    <td className="num">{row.lineCount}</td>
                    <td className="num">{moneyFmt(row.unitCostTotal)}</td>
                    <td>{row.remarks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="pd-inv-foot">
          <span className="pd-inv-total">COUNT : {rows.length}</span>
          <button type="button" className="pd-inv-ghost" onClick={onNew}>New</button>
          <button type="button" className="pd-inv-go" onClick={() => selected && onSelect(selected)} disabled={!selected}>
            Open
          </button>
          <button type="button" className="pd-inv-ghost" onClick={() => void removeSelected()} disabled={!selected}>
            Delete
          </button>
          <button type="button" className="pd-inv-ghost" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  )
}
