/**
 * Recipe list — products that already have a recipe. Double-click opens entry.
 * Minimal list layout: one search (filters live; Enter asks the server), the
 * common table, count in the footer.
 */
import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Plus, Search, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import './ListToolbar.css'

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
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function load(q = '') {
    setState('loading')
    setError(null)
    try {
      const list = await apiService.fetchRecipes({ q: q.trim() || undefined })
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
    void load()
  }, [])

  // Live filter on what's loaded: name or barcode.
  const shown = useMemo(() => {
    const n = search.trim().toLowerCase()
    if (!n) return rows
    return rows.filter((r) => r.productName.toLowerCase().includes(n) || r.barcode.toLowerCase().includes(n))
  }, [rows, search])

  async function removeSelected() {
    if (!selected) return
    const row = rows.find((r) => r.finishedProductId === selected)
    if (!row) return
    if (!window.confirm(`Delete the recipe for ${row.productName}?`)) return
    try {
      await apiService.deleteRecipe(selected)
      await load(search)
    } catch (err) {
      setError(errMessage(err, 'Could not delete recipe'))
    }
  }

  return (
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-ol-table pd-mfg lst-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-recipe-list-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <ClipboardList size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Manufacturing</p>
              <h2 id="pd-recipe-list-title" className="pd-mod-item-name">Recipe List</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="pd-ol-body">
          <div className="lst-bar">
            <span className="lst-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void load(search)
                }}
                placeholder="Search product name or barcode"
                autoFocus
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    void load()
                  }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <button type="button" className="lst-btn is-primary" onClick={onNew}>
              <Plus size={14} />
              New Recipe
            </button>
          </div>

          {error ? <p className="pd-mfg-msg">{error}</p> : null}

          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Finished Product</th>
                  <th className="num">Lines</th>
                  <th className="num">Unit Cost</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {state === 'loading' && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Loading…</td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{search.trim() ? 'No recipe matches this search' : 'No recipes for this counter yet'}</td>
                  </tr>
                ) : (
                  shown.map((row) => (
                    <tr
                      key={row.finishedProductId}
                      className={selected === row.finishedProductId ? 'is-selected' : undefined}
                      style={{ cursor: 'pointer' }}
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
        </div>

        <div className="pd-mod-foot">
          <span className="pd-mfg-count lst-count">
            {state === 'loading' ? (
              'Loading…'
            ) : (
              <>
                Count <b>{shown.length}</b>
                {shown.length !== rows.length ? ` of ${rows.length}` : ''}
              </>
            )}
          </span>
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn is-close" onClick={() => void removeSelected()} disabled={!selected}>
            Delete
          </button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => selected && onSelect(selected)} disabled={!selected}>
            Open
          </button>
        </div>
      </div>
    </div>
  )
}
