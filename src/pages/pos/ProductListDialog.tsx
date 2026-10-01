/**
 * Product list / edit — minimal list layout: search (filters as you type) ·
 * group · sub-group in one toolbar row, the common table, count in the footer.
 * Double-click a row (or Edit Product) to open it.
 */
import { useEffect, useMemo, useState } from 'react'
import { Package, Pencil, Search, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { ownMenuGroups } from './ProductEntryDialog'
import './ListToolbar.css'

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
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-ol-wide pd-edm lst-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-prd-list-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Package size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Edit</p>
              <h2 id="pd-prd-list-title" className="pd-mod-item-name">Product Edit</h2>
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
                placeholder="Search barcode, name or price"
                autoFocus
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtered.length === 1) openSelected(filtered[0].productId)
                }}
              />
              {search ? (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <select
              className="lst-select"
              value={groupId}
              aria-label="Group"
              onChange={(e) => {
                setGroupId(e.target.value)
                setSubGroupId('')
              }}
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              className="lst-select"
              value={subGroupId}
              aria-label="Sub group"
              onChange={(e) => setSubGroupId(e.target.value)}
              disabled={!groupId}
            >
              <option value="">All sub groups</option>
              {subGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="pd-mfg-msg">{error}</p> : null}

          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Description</th>
                  <th>Arabic</th>
                  <th className="num">Qty</th>
                  <th className="num">Price</th>
                  <th>Popup</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Loading…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{search || groupId ? 'No matching products' : 'No products yet'}</td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.productId}
                      className={selected === row.productId ? 'is-selected' : undefined}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelected(row.productId)}
                      onDoubleClick={() => openSelected(row.productId)}
                    >
                      <td>{row.barcode || '—'}</td>
                      <td>{row.description || '—'}</td>
                      <td>{row.arabic || '—'}</td>
                      <td className="num">{row.qty || '—'}</td>
                      <td className="num">{row.price ? Number(row.price).toFixed(2) : '—'}</td>
                      <td>{row.orderNo || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pd-mod-foot">
          <span className="pd-mfg-count lst-count">
            Count <b>{filtered.length}</b>
            {filtered.length !== rows.length ? ` of ${rows.length}` : ''}
          </span>
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn is-ok" disabled={!selected} onClick={() => openSelected()}>
            <Pencil size={14} /> Edit Product
          </button>
        </div>
      </div>
    </div>
  )
}
