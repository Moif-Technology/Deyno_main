/**
 * Product list / edit — group and sub-group filters, same columns as Saloon POS.
 */
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { ownMenuGroups } from './ProductEntryDialog'

type Props = {
  onClose: () => void
  onEdit: (productId: number) => void
}

type GroupOpt = { id: number; name: string }
type SubOpt = { id: number; name: string; groupId: number }
type ProductRow = {
  productId: number
  barcode: string
  description: string
  arabic: string
  qty: string
  price: string
  orderNo: string
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export default function ProductListDialog({ onClose, onEdit }: Props) {
  const [groups, setGroups] = useState<GroupOpt[]>([])
  const [subGroups, setSubGroups] = useState<SubOpt[]>([])
  const [groupId, setGroupId] = useState('')
  const [subGroupId, setSubGroupId] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<ProductRow[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiService.fetchGroups().then((list) => {
      setGroups(ownMenuGroups(list).map((g) => ({ id: g.id, name: g.name })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!groupId) {
      setSubGroups([])
      return
    }
    apiService.fetchSubGroups({ groupId }).then((list) => {
      setSubGroups(list.map((sg) => ({
        id: Number(sg.subGroupId ?? sg.SubGroupID) || 0,
        groupId: Number(sg.groupId ?? sg.GroupID) || 0,
        name: String(sg.subGroupDescription ?? sg.SubGroupDescription ?? '').trim(),
      })).filter((sg) => sg.id > 0 && sg.name && String(sg.groupId) === groupId))
    }).catch(() => {})
  }, [groupId])

  async function load(nextGroup = groupId, nextSub = subGroupId) {
    setLoading(true)
    setError(null)
    try {
      const list = await apiService.fetchProducts({
        groupId: nextGroup || undefined,
        subGroupId: nextSub || undefined,
        limit: 2000,
      })
      setRows(list.map((item) => {
        const inv = (item.inventory ?? {}) as Record<string, unknown>
        return {
          productId: Number(item.productId) || 0,
          barcode: String(item.barcode ?? ''),
          description: String(item.shortName ?? item.productName ?? ''),
          arabic: String(item.descriptionArabic ?? ''),
          qty: String(item.packQty ?? inv.packQty ?? ''),
          price: String(inv.unitPrice ?? ''),
          orderNo: item.counterPopupFlag ? 'Yes' : '',
        }
      }).filter((r) => r.productId > 0))
      setSelected(null)
    } catch (err) {
      setRows([])
      setError(errMessage(err, 'Could not load products'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(groupId, subGroupId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, subGroupId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => [r.barcode, r.description, r.arabic, r.price].some((v) => v.toLowerCase().includes(q)))
  }, [rows, search])

  function openSelected(id = selected) {
    if (id) onEdit(id)
  }

  return (
    <div className="pd-mod-overlay pd-inv-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pd-inv pd-prd-list" role="dialog" aria-modal="true" aria-labelledby="pd-prd-list-title">
        <header className="pd-inv-head">
          <div>
            <p className="pd-mod-kicker">Edit</p>
            <h2 id="pd-prd-list-title">Product List</h2>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close"><X size={13} /></button>
        </header>

        <div className="pd-stk-list-filters">
          <label>
            <span>Group</span>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value)
                setSubGroupId('')
              }}
            >
              <option value="">All groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label>
            <span>Sub group</span>
            <select value={subGroupId} onChange={(e) => setSubGroupId(e.target.value)} disabled={!groupId}>
              <option value="">All sub groups</option>
              {subGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input
              value={search}
              placeholder="Barcode, description or price"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {error ? <p className="pd-inv-msg">{error}</p> : null}
        {loading ? <p className="pd-inv-msg">Loading…</p> : null}

        <div className="pd-stk-grid-wrap">
          <table className="pd-inv-grid">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Description</th>
                <th>Arabic</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Order</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="pd-inv-empty">
                    {search || groupId ? 'No matching products' : 'No products yet'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.productId}
                    className={selected === row.productId ? 'is-sel' : undefined}
                    onClick={() => setSelected(row.productId)}
                    onDoubleClick={() => openSelected(row.productId)}
                  >
                    <td>{row.barcode || '—'}</td>
                    <td>{row.description || '—'}</td>
                    <td>{row.arabic || '—'}</td>
                    <td className="num">{row.qty || '—'}</td>
                    <td className="num">{row.price || '—'}</td>
                    <td className="num">{row.orderNo || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="pd-inv-foot">
          <span className="pd-inv-total">{selected ? '1 selected' : `${filtered.length} items`}</span>
          <button type="button" className="pd-inv-go" disabled={!selected} onClick={() => openSelected()}>
            Edit Product
          </button>
          <button type="button" className="pd-inv-ghost" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  )
}
