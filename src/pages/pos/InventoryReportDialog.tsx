/**
 * RptInventoryfrm → ProductInventory.rpt (easyway Product INVENTORY).
 * Filters match the VB Stock Product form; Show Report fills a print sheet.
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Boxes, ChevronLeft, FileSpreadsheet, FileText, Printer, Search, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { exportInventoryExcel, exportInventoryPdf } from './inventoryReportExport'

type Opt = { id: number; name: string }
type InvRow = {
  productId: number
  barcode: string
  description: string
  packQty: number
  productWiseQty: number
  unitCost: number
  unitPrice: number
  amount: number
  groupName: string
  subGroup: string
  subSubGroup: string
  supplierName: string
}

type Report = {
  reportTitle: string
  heading1: string
  heading2: string
  heading3: string
  heading4: string
  hidePrice: boolean
  groupWise: boolean
  supplierWise: boolean
  rows: InvRow[]
  totals: { count: number; qty: number; amount: number }
}

type Props = { onClose: () => void }

function money(n: unknown) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

function qtyFmt(n: unknown) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function asRows(payload: unknown): InvRow[] {
  if (!payload || typeof payload !== 'object') return []
  const list = (payload as { rows?: unknown }).rows
  if (!Array.isArray(list)) return []
  return list.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>
    return {
      productId: Number(row.productId) || 0,
      barcode: String(row.barcode ?? ''),
      description: String(row.description ?? ''),
      packQty: Number(row.packQty) || 0,
      productWiseQty: Number(row.productWiseQty) || 0,
      unitCost: Number(row.unitCost) || 0,
      unitPrice: Number(row.unitPrice) || 0,
      amount: Number(row.amount) || 0,
      groupName: String(row.groupName ?? ''),
      subGroup: String(row.subGroup ?? ''),
      subSubGroup: String(row.subSubGroup ?? ''),
      supplierName: String(row.supplierName ?? ''),
    }
  })
}

export default function InventoryReportDialog({ onClose }: Props) {
  const [groups, setGroups] = useState<Opt[]>([])
  const [allSubGroups, setAllSubGroups] = useState<(Opt & { groupId: number })[]>([])
  const [allSubSubs, setAllSubSubs] = useState<(Opt & { subGroupId: number })[]>([])
  const [brands, setBrands] = useState<Opt[]>([])
  const [suppliers, setSuppliers] = useState<Opt[]>([])
  const [locations, setLocations] = useState<string[]>([])

  const [supplierId, setSupplierId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [productName, setProductName] = useState('')
  const [subGroupId, setSubGroupId] = useState('')
  const [subSubGroupId, setSubSubGroupId] = useState('')
  const [location, setLocation] = useState('')
  const [productType, setProductType] = useState('')
  const [qtyOp, setQtyOp] = useState('<>')
  const [qty, setQty] = useState('')
  const [costType, setCostType] = useState('LastPurchaseCost')
  const [groupWise, setGroupWise] = useState(false)
  const [supplierWise, setSupplierWise] = useState(false)
  const [hidePrice, setHidePrice] = useState(false)

  const [view, setView] = useState<'filters' | 'report'>('filters')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)

  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [viewGroup, setViewGroup] = useState('')
  const [viewName, setViewName] = useState('')

  const subGroups = useMemo(
    () => (groupId ? allSubGroups.filter((s) => s.groupId === Number(groupId)) : []),
    [allSubGroups, groupId],
  )
  const subSubs = useMemo(
    () => (subGroupId ? allSubSubs.filter((s) => s.subGroupId === Number(subGroupId)) : []),
    [allSubSubs, subGroupId],
  )

  useEffect(() => {
    let cancelled = false
    async function loadLookups() {
      try {
        const [groupRows, subRows, subSubRows, lookups] = await Promise.all([
          apiService.fetchGroups(),
          apiService.fetchSubGroups(),
          apiService.fetchSubSubGroups(),
          apiService.fetchInventoryLookups(),
        ])
        if (cancelled) return
        const tillGroups = (lookups.groups ?? [])
          .map((g) => ({
            id: Number(g.id ?? g.groupId) || 0,
            name: String(g.name ?? g.groupDescription ?? ''),
          }))
          .filter((g) => g.id > 0 && g.name)
        const mappedGroups = groupRows
          .map((g) => ({
            id: Number(g.groupId ?? g.GroupID) || 0,
            name: String(g.groupDescription ?? g.GroupDescription ?? g.groupName ?? ''),
            code: String(g.groupCode ?? g.GroupCode ?? ''),
          }))
          .filter((g) => g.id > 0 && g.name)
        const moh = mappedGroups.filter((g) => g.code.toUpperCase().startsWith('MOH-'))
        const nextGroups = tillGroups.length
          ? tillGroups
          : (moh.length ? moh : mappedGroups).map(({ id, name }) => ({ id, name }))
        const groupIds = new Set(nextGroups.map((g) => g.id))
        setGroups(nextGroups)
        setAllSubGroups(
          subRows
            .map((g) => ({
              id: Number(g.subGroupId ?? g.SubGroupID) || 0,
              name: String(g.subGroupDescription ?? g.SubGroupDescription ?? ''),
              groupId: Number(g.groupId ?? g.GroupID) || 0,
            }))
            .filter((g) => g.id > 0 && g.name && (!groupIds.size || groupIds.has(g.groupId))),
        )
        setAllSubSubs(
          subSubRows
            .map((g) => ({
              id: Number(g.subSubGroupId ?? g.SubSubGroupID) || 0,
              name: String(g.subSubGroupDescription ?? g.SubSubGroupDescription ?? ''),
              subGroupId: Number(g.subGroupId ?? g.SubGroupID) || 0,
            }))
            .filter((g) => g.id > 0 && g.name),
        )
        setBrands(
          lookups.brands
            .map((b) => ({ id: Number(b.id) || 0, name: String(b.name ?? '') }))
            .filter((b) => b.id > 0),
        )
        setSuppliers(
          lookups.suppliers
            .map((s) => ({ id: Number(s.id) || 0, name: String(s.name ?? '') }))
            .filter((s) => s.id > 0),
        )
        setLocations(lookups.locations)
      } catch {
        if (!cancelled) {
          /* filters still usable empty */
        }
      }
    }
    void loadLookups()
    return () => {
      cancelled = true
    }
  }, [])

  async function showReport() {
    setState('loading')
    setError(null)
    try {
      const res = await apiService.fetchInventoryReport({
        supplierId: supplierId || undefined,
        brandId: brandId || undefined,
        groupId: groupId || undefined,
        name: productName.trim() || undefined,
        subGroupId: subGroupId || undefined,
        subSubGroupId: subSubGroupId || undefined,
        location: location || undefined,
        productType: productType || undefined,
        qtyOp: qty.trim() ? qtyOp : undefined,
        qty: qty.trim() || undefined,
        costType,
        groupWise,
        supplierWise,
        hidePrice,
      })
      const rows = asRows(res)
      if (rows.length === 0) {
        setReport(null)
        setState('idle')
        setError('No Item Found For This Criteria..........')
        return
      }
      const totals = (res.totals as Report['totals']) ?? {
        count: rows.length,
        qty: rows.reduce((n, r) => n + r.productWiseQty, 0),
        amount: rows.reduce((n, r) => n + r.amount, 0),
      }
      setReport({
        reportTitle: String(res.reportTitle ?? 'Product INVENTORY'),
        heading1: String(res.heading1 ?? ''),
        heading2: String(res.heading2 ?? ''),
        heading3: String(res.heading3 ?? ''),
        heading4: String(res.heading4 ?? ''),
        hidePrice: Boolean(res.hidePrice) || hidePrice,
        groupWise: Boolean(res.groupWise) || groupWise,
        supplierWise: Boolean(res.supplierWise) || supplierWise,
        rows,
        totals,
      })
      setViewGroup('')
      setViewName('')
      setView('report')
      setState('idle')
    } catch (err) {
      setReport(null)
      setState('error')
      setError(errMessage(err, 'Could not load stock report'))
    }
  }

  const filteredReport = useMemo(() => {
    if (!report) return null
    const g = viewGroup.trim().toLowerCase()
    const n = viewName.trim().toLowerCase()
    const rows =
      g || n
        ? report.rows.filter((row) => {
            if (g && row.groupName.trim().toLowerCase() !== g) return false
            if (
              n &&
              !row.description.toLowerCase().includes(n) &&
              !row.barcode.toLowerCase().includes(n)
            ) {
              return false
            }
            return true
          })
        : report.rows
    const totals = rows.reduce(
      (acc, r) => {
        acc.count += 1
        acc.qty += r.productWiseQty
        acc.amount += r.amount
        return acc
      },
      { count: 0, qty: 0, amount: 0 },
    )
    totals.amount = Math.round(totals.amount * 100) / 100
    return { ...report, rows, totals }
  }, [report, viewGroup, viewName])

  const groupOptions = useMemo(() => {
    if (!report) return []
    const seen = new Set<string>()
    const list: string[] = []
    for (const row of report.rows) {
      const name = row.groupName.trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      list.push(name)
    }
    return list.sort((a, b) => a.localeCompare(b))
  }, [report])

  const sections = useMemo(() => {
    if (!filteredReport) return []
    if (filteredReport.supplierWise) {
      const map = new Map<string, InvRow[]>()
      for (const row of filteredReport.rows) {
        const key = row.supplierName || row.subSubGroup || '—'
        const list = map.get(key) ?? []
        list.push(row)
        map.set(key, list)
      }
      return [...map.entries()].map(([name, items]) => ({ name, items }))
    }
    if (filteredReport.groupWise) {
      const map = new Map<string, InvRow[]>()
      for (const row of filteredReport.rows) {
        const key = row.groupName || '—'
        const list = map.get(key) ?? []
        list.push(row)
        map.set(key, list)
      }
      return [...map.entries()].map(([name, items]) => ({ name, items }))
    }
    return [{ name: '', items: filteredReport.rows }]
  }, [filteredReport])

  const colCount = filteredReport?.hidePrice ? 4 : 7

  function runExcel() {
    if (!filteredReport) return
    try {
      setExporting('excel')
      exportInventoryExcel(filteredReport)
    } catch (err) {
      setError(errMessage(err, 'Could not export Excel'))
    } finally {
      setExporting(null)
    }
  }

  function runPdf() {
    if (!filteredReport) return
    try {
      setExporting('pdf')
      exportInventoryPdf(filteredReport)
    } catch (err) {
      setError(errMessage(err, 'Could not export PDF'))
    } finally {
      setExporting(null)
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
      <div
        className={`pd-inv${view === 'report' ? ' is-report' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pd-inv-title"
      >
        <header className="pd-inv-head">
          <div className="pd-inv-head-left">
            {view === 'report' ? (
              <button type="button" className="pd-mod-back" onClick={() => setView('filters')} aria-label="Back">
                <ChevronLeft size={16} />
              </button>
            ) : (
              <span className="pd-mod-header-icon">
                <Boxes size={16} />
              </span>
            )}
            <div>
              <p className="pd-mod-kicker">Transactions</p>
              <h2 id="pd-inv-title">{view === 'report' ? 'Product Inventory' : 'Stock Product'}</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        {view === 'filters' ? (
          <>
            <div className="pd-inv-body">
              <div className="pd-inv-card">
                <div className="pd-inv-form">
                  <label>
                    <span>Group</span>
                    <select
                      value={groupId}
                      onChange={(e) => {
                        setGroupId(e.target.value)
                        setSubGroupId('')
                        setSubSubGroupId('')
                      }}
                    >
                      <option value="">All groups</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="pd-inv-name">
                    <span>Product Name</span>
                    <span className="pd-inv-search">
                      <Search size={14} />
                      <input
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void showReport()
                        }}
                        placeholder="Search name or barcode"
                      />
                    </span>
                  </label>
                  <label>
                    <span>Last Supplier</span>
                    <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                      <option value="">All</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Product Brand</span>
                    <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                      <option value="">All</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>SubGroup</span>
                    <select
                      value={subGroupId}
                      disabled={!groupId}
                      onChange={(e) => {
                        setSubGroupId(e.target.value)
                        setSubSubGroupId('')
                      }}
                    >
                      <option value="">All</option>
                      {subGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>SubSubGroup</span>
                    <select
                      value={subSubGroupId}
                      disabled={!subGroupId}
                      onChange={(e) => setSubSubGroupId(e.target.value)}
                    >
                      <option value="">All</option>
                      {subSubs.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Location</span>
                    <select value={location} onChange={(e) => setLocation(e.target.value)}>
                      <option value="">All</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Product Type</span>
                    <select value={productType} onChange={(e) => setProductType(e.target.value)}>
                      <option value="">All</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="RAW MATERIAL">RAW MATERIAL</option>
                      <option value="COMBO">COMBO</option>
                    </select>
                  </label>
                  <label>
                    <span>Cost Type</span>
                    <select value={costType} onChange={(e) => setCostType(e.target.value)}>
                      <option value="LastPurchaseCost">Last Purchase Cost</option>
                      <option value="AverageCost">Average Cost</option>
                    </select>
                  </label>
                  <div className="pd-inv-qty">
                    <span>Qty On Hand</span>
                    <div>
                      <select value={qtyOp} onChange={(e) => setQtyOp(e.target.value)} aria-label="Qty operator">
                        <option value="&gt;">&gt;</option>
                        <option value="&lt;">&lt;</option>
                        <option value="=">=</option>
                        <option value="&gt;=">&gt;=</option>
                        <option value="&lt;=">&lt;=</option>
                        <option value="&lt;&gt;">&lt;&gt;</option>
                      </select>
                      <input
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="All"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                </div>

                <div className="pd-inv-options">
                  <button
                    type="button"
                    className={`pd-inv-chip${groupWise ? ' is-on' : ''}`}
                    onClick={() => {
                      setGroupWise((v) => !v)
                      setSupplierWise(false)
                    }}
                  >
                    Group Wise
                  </button>
                  <button
                    type="button"
                    className={`pd-inv-chip${supplierWise ? ' is-on' : ''}`}
                    onClick={() => {
                      setSupplierWise((v) => !v)
                      setGroupWise(false)
                    }}
                  >
                    Supplier Wise
                  </button>
                  <button
                    type="button"
                    className={`pd-inv-chip${hidePrice ? ' is-on' : ''}`}
                    onClick={() => setHidePrice((v) => !v)}
                  >
                    Hide Price
                  </button>
                </div>
              </div>

              {error ? (
                <p className="pd-inv-msg" role="status">
                  {error}
                </p>
              ) : (
                <p className="pd-inv-hint">
                  Filter by group or type a product name. Leave Qty blank to list all items.
                </p>
              )}
            </div>
            <footer className="pd-inv-foot">
              <button type="button" className="pd-inv-ghost" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="pd-inv-go"
                disabled={state === 'loading'}
                onClick={() => void showReport()}
              >
                {state === 'loading' ? 'Collecting data…' : 'Show Report'}
              </button>
            </footer>
          </>
        ) : filteredReport ? (
          <>
            <div className="pd-rv-toolbar">
              <span className="pd-rv-toolbar-title">Report Viewer</span>
              <button type="button" className="pd-rv-tool" disabled={!!exporting} onClick={runExcel}>
                <FileSpreadsheet size={14} />
                {exporting === 'excel' ? 'Excel…' : 'Excel'}
              </button>
              <button type="button" className="pd-rv-tool" disabled={!!exporting} onClick={runPdf}>
                <FileText size={14} />
                {exporting === 'pdf' ? 'PDF…' : 'PDF'}
              </button>
              <button type="button" className="pd-rv-tool" onClick={() => window.print()}>
                <Printer size={14} /> Print
              </button>
              <span className="pd-inv-total">
                COUNT : {filteredReport.totals.count}
                {filteredReport.hidePrice ? '' : `  ·  TOTAL : ${money(filteredReport.totals.amount)}`}
              </span>
              <button type="button" className="pd-inv-ghost" onClick={() => setView('filters')}>
                Back
              </button>
            </div>
            <div className="pd-rv-filters">
              <label>
                <span>Group</span>
                <select value={viewGroup} onChange={(e) => setViewGroup(e.target.value)}>
                  <option value="">All groups</option>
                  {groupOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pd-rv-name">
                <span>Name</span>
                <span className="pd-inv-search">
                  <Search size={14} />
                  <input
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    placeholder="Search name or barcode"
                  />
                </span>
              </label>
            </div>
            <div className="pd-inv-body pd-inv-body-report">
              <div className="pd-inv-sheet" id="pd-inv-print">
                <div className="pd-inv-letterhead">
                  {filteredReport.heading1 ? <h3>{filteredReport.heading1}</h3> : null}
                  {filteredReport.heading2 ? <p>{filteredReport.heading2}</p> : null}
                  <h1>{filteredReport.reportTitle}</h1>
                  <div className="pd-inv-sub">
                    <span>{filteredReport.heading3}</span>
                    {filteredReport.heading4 ? <span>{filteredReport.heading4}</span> : null}
                  </div>
                </div>
                <table className="pd-inv-grid">
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Description</th>
                      <th className="num">Pack Qty</th>
                      <th className="num">Qty</th>
                      {filteredReport.hidePrice ? null : (
                        <>
                          <th className="num">Cost</th>
                          <th className="num">Amount</th>
                          <th className="num">Price</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReport.rows.length === 0 ? (
                      <tr>
                        <td colSpan={colCount} className="pd-inv-empty">
                          No Item Found For This Criteria..........
                        </td>
                      </tr>
                    ) : (
                      sections.map((sec) => (
                      <Fragment key={sec.name || 'all'}>
                        {sec.name ? (
                          <tr className="pd-inv-group">
                            <td colSpan={colCount}>{sec.name}</td>
                          </tr>
                        ) : null}
                        {sec.items.map((row, idx) => (
                          <tr key={`${row.productId}-${idx}`}>
                            <td>{row.barcode}</td>
                            <td>{row.description}</td>
                            <td className="num">{qtyFmt(row.packQty)}</td>
                            <td className="num">{qtyFmt(row.productWiseQty)}</td>
                            {filteredReport.hidePrice ? null : (
                              <>
                                <td className="num">{money(row.unitCost)}</td>
                                <td className="num">{money(row.amount)}</td>
                                <td className="num">{money(row.unitPrice)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </Fragment>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>COUNT : {filteredReport.totals.count}</td>
                      <td className="num">Total Qty</td>
                      <td className="num">{qtyFmt(filteredReport.totals.qty)}</td>
                      {filteredReport.hidePrice ? null : (
                        <>
                          <td />
                          <td className="num">{money(filteredReport.totals.amount)}</td>
                          <td />
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
