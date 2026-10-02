/**
 * RptInventoryfrm → ProductInventory.rpt (easyway Product INVENTORY).
 *
 * Opens straight on the report (all items) in the common table. Top bar:
 * Group wise / Supplier wise / Hide price toggles on the left; search, "All
 * Filters" (side panel with the VB Stock Product filters) and a Print menu
 * (Print / PDF / Excel) on the right. Count and totals sit in a fixed footer.
 * The letterhead sheet is kept for printing only.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { exportInventoryExcel, exportInventoryPdf } from './inventoryReportExport'
import './InventoryReportDialog.css'

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

/** Filters kept in the "All Filters" panel; applied together on Apply. */
type Filters = {
  groupId: string
  subGroupId: string
  subSubGroupId: string
  productType: string
  costType: string
  supplierId: string
  brandId: string
  location: string
  productName: string
  qtyOp: string
  qty: string
}

const EMPTY_FILTERS: Filters = {
  groupId: '',
  subGroupId: '',
  subSubGroupId: '',
  productType: '',
  costType: 'LastPurchaseCost',
  supplierId: '',
  brandId: '',
  location: '',
  productName: '',
  qtyOp: '<>',
  qty: '',
}

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

/** How many panel filters differ from the defaults (for the badge). */
function countSet(f: Filters) {
  return [
    f.groupId,
    f.subGroupId,
    f.subSubGroupId,
    f.productType,
    f.costType !== EMPTY_FILTERS.costType ? 'x' : '',
    f.supplierId,
    f.brandId,
    f.location,
    f.productName.trim(),
    f.qty.trim(),
  ].filter(Boolean).length
}

export default function InventoryReportDialog({ onClose }: Props) {
  const [groups, setGroups] = useState<Opt[]>([])
  const [allSubGroups, setAllSubGroups] = useState<(Opt & { groupId: number })[]>([])
  const [allSubSubs, setAllSubSubs] = useState<(Opt & { subGroupId: number })[]>([])
  const [brands, setBrands] = useState<Opt[]>([])
  const [suppliers, setSuppliers] = useState<Opt[]>([])
  const [locations, setLocations] = useState<string[]>([])

  // Top-bar toggles — changing one reloads the report.
  const [groupWise, setGroupWise] = useState(false)
  const [supplierWise, setSupplierWise] = useState(false)
  const [hidePrice, setHidePrice] = useState(false)

  // "All Filters" panel: applied values + the panel's working copy.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)

  const [search, setSearch] = useState('')
  const [printOpen, setPrintOpen] = useState(false)
  const printRef = useRef<HTMLDivElement | null>(null)
  const requestId = useRef(0)

  const draftSubGroups = useMemo(
    () => (draft.groupId ? allSubGroups.filter((s) => s.groupId === Number(draft.groupId)) : []),
    [allSubGroups, draft.groupId],
  )
  const draftSubSubs = useMemo(
    () => (draft.subGroupId ? allSubSubs.filter((s) => s.subGroupId === Number(draft.subGroupId)) : []),
    [allSubSubs, draft.subGroupId],
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
        /* filters still usable empty */
      }
    }
    void loadLookups()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadReport(f: Filters = filters) {
    const id = ++requestId.current
    setState('loading')
    setError(null)
    try {
      const res = await apiService.fetchInventoryReport({
        supplierId: f.supplierId || undefined,
        brandId: f.brandId || undefined,
        groupId: f.groupId || undefined,
        name: f.productName.trim() || undefined,
        subGroupId: f.subGroupId || undefined,
        subSubGroupId: f.subSubGroupId || undefined,
        location: f.location || undefined,
        productType: f.productType || undefined,
        qtyOp: f.qty.trim() ? f.qtyOp : undefined,
        qty: f.qty.trim() || undefined,
        costType: f.costType,
        groupWise,
        supplierWise,
        hidePrice,
      })
      if (id !== requestId.current) return
      const rows = asRows(res)
      const totals = (rows.length ? (res.totals as Report['totals']) : null) ?? {
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
      setState('ready')
    } catch (err) {
      if (id !== requestId.current) return
      setState('error')
      setError(errMessage(err, 'Could not load stock report'))
    }
  }

  // Show the report on open, and again whenever a toggle changes.
  useEffect(() => {
    void loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupWise, supplierWise, hidePrice])

  // Close the Print menu on an outside click.
  useEffect(() => {
    if (!printOpen) return
    const onDown = (e: MouseEvent) => {
      if (!printRef.current?.contains(e.target as Node)) setPrintOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [printOpen])

  function openPanel() {
    setDraft(filters)
    setPanelOpen(true)
  }

  function applyPanel() {
    setFilters(draft)
    setPanelOpen(false)
    void loadReport(draft)
  }

  const filteredReport = useMemo(() => {
    if (!report) return null
    const n = search.trim().toLowerCase()
    const rows = n
      ? report.rows.filter((row) => row.description.toLowerCase().includes(n) || row.barcode.toLowerCase().includes(n))
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
  }, [report, search])

  const sections = useMemo(() => {
    if (!filteredReport) return []
    if (filteredReport.supplierWise || filteredReport.groupWise) {
      const map = new Map<string, InvRow[]>()
      for (const row of filteredReport.rows) {
        const key = filteredReport.supplierWise
          ? row.supplierName || row.subSubGroup || '—'
          : row.groupName || '—'
        const list = map.get(key) ?? []
        list.push(row)
        map.set(key, list)
      }
      return [...map.entries()].map(([name, items]) => ({ name, items }))
    }
    return [{ name: '', items: filteredReport.rows }]
  }, [filteredReport])

  const colCount = filteredReport?.hidePrice ? 4 : 7
  const setCount = countSet(filters)
  const hasRows = !!filteredReport && filteredReport.rows.length > 0

  function runPrint(kind: 'print' | 'pdf' | 'excel') {
    setPrintOpen(false)
    if (!filteredReport) return
    try {
      if (kind === 'excel') exportInventoryExcel(filteredReport)
      else if (kind === 'pdf') exportInventoryPdf(filteredReport)
      else window.print()
    } catch (err) {
      setError(errMessage(err, kind === 'excel' ? 'Could not export Excel' : 'Could not export PDF'))
    }
  }

  const tableHead = (
    <tr>
      <th>Barcode</th>
      <th>Description</th>
      <th className="num">Pack Qty</th>
      <th className="num">Qty</th>
      {filteredReport?.hidePrice ? null : (
        <>
          <th className="num">Cost</th>
          <th className="num">Amount</th>
          <th className="num">Price</th>
        </>
      )}
    </tr>
  )

  function tableBody() {
    if (!filteredReport) return null
    if (filteredReport.rows.length === 0) {
      return (
        <tr>
          <td colSpan={colCount} className="pd-inv-empty">
            No Item Found For This Criteria
          </td>
        </tr>
      )
    }
    return sections.map((sec) => (
      <Fragment key={sec.name || 'all'}>
        {sec.name ? (
          <tr className="irp-section">
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
  }

  return (
    <div
      className="pd-mod-overlay pd-inv-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-inv is-report irp" role="dialog" aria-modal="true" aria-labelledby="pd-inv-title">
        <header className="pd-inv-head">
          <div className="pd-inv-head-left">
            <span className="pd-mod-header-icon">
              <Boxes size={16} />
            </span>
            <div>
              <p className="pd-mod-kicker">Transactions</p>
              <h2 id="pd-inv-title">Stock Report</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        <div className="irp-bar">
          <div className="irp-toggles">
            <button
              type="button"
              className={`irp-toggle${groupWise ? ' is-on' : ''}`}
              onClick={() => {
                setGroupWise((v) => !v)
                setSupplierWise(false)
              }}
            >
              Group wise
            </button>
            <button
              type="button"
              className={`irp-toggle${supplierWise ? ' is-on' : ''}`}
              onClick={() => {
                setSupplierWise((v) => !v)
                setGroupWise(false)
              }}
            >
              Supplier wise
            </button>
            <button
              type="button"
              className={`irp-toggle${hidePrice ? ' is-on' : ''}`}
              onClick={() => setHidePrice((v) => !v)}
            >
              Hide price
            </button>
          </div>

          <div className="irp-actions">
            <span className="irp-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or barcode" />
              {search ? (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <button type="button" className={`irp-btn${setCount ? ' is-set' : ''}`} onClick={openPanel}>
              <SlidersHorizontal size={14} />
              Filters
              {setCount ? <b className="irp-badge">{setCount}</b> : null}
            </button>
            <div className="irp-print" ref={printRef}>
              <button
                type="button"
                className="irp-btn is-primary"
                disabled={!hasRows}
                aria-haspopup="menu"
                aria-expanded={printOpen}
                onClick={() => setPrintOpen((v) => !v)}
              >
                <Printer size={14} />
                Print
                <ChevronDown size={13} />
              </button>
              {printOpen ? (
                <div className="irp-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => runPrint('print')}>
                    <Printer size={14} /> Print
                  </button>
                  <button type="button" role="menuitem" onClick={() => runPrint('pdf')}>
                    <FileText size={14} /> Save as PDF
                  </button>
                  <button type="button" role="menuitem" onClick={() => runPrint('excel')}>
                    <FileSpreadsheet size={14} /> Export Excel
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {error ? <p className="pd-inv-msg irp-msg">{error}</p> : null}

        {/* On screen: the common table */}
        <div className="irp-screen">
          <div className={`pd-grid-wrap irp-table${state === 'loading' ? ' is-loading' : ''}`}>
            <table className="pd-grid">
              <thead>{tableHead}</thead>
              <tbody>
                {filteredReport ? (
                  tableBody()
                ) : (
                  <tr>
                    <td colSpan={7} className="pd-inv-empty">
                      {state === 'loading' ? 'Collecting data…' : 'No report yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fixed footer: count and totals */}
        <footer className="irp-foot">
          <span>
            Count <b>{filteredReport?.totals.count ?? 0}</b>
            {filteredReport && report && filteredReport.totals.count !== report.rows.length ? (
              <em> of {report.rows.length}</em>
            ) : null}
          </span>
          <span>
            Total Qty <b>{qtyFmt(filteredReport?.totals.qty ?? 0)}</b>
          </span>
          {filteredReport?.hidePrice ? null : (
            <span className="is-amount">
              Total Amount <b>AED {money(filteredReport?.totals.amount ?? 0)}</b>
            </span>
          )}
          {state === 'loading' ? <span className="irp-foot-status">Loading…</span> : null}
        </footer>

        {/* Print only: the formatted report sheet */}
        {filteredReport ? (
          <div className="pd-inv-sheet irp-print-sheet" id="pd-inv-print">
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
              <thead>{tableHead}</thead>
              <tbody>{tableBody()}</tbody>
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
        ) : null}

        {/* All Filters — slides in from the right over the report */}
        {panelOpen ? (
          <div className="irp-panel-backdrop" onClick={() => setPanelOpen(false)} role="presentation">
            <aside className="irp-panel" role="dialog" aria-label="Filters" onClick={(e) => e.stopPropagation()}>
              <div className="irp-panel-head">
                <strong>Filters</strong>
                <button type="button" className="irp-panel-x" onClick={() => setPanelOpen(false)} aria-label="Close filters">
                  <X size={14} />
                </button>
              </div>
              <div className="irp-panel-body">
                <label>
                  <span>Product Name</span>
                  <input
                    value={draft.productName}
                    onChange={(e) => setDraft((d) => ({ ...d, productName: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyPanel()
                    }}
                    placeholder="Name or barcode"
                  />
                </label>
                <label>
                  <span>Group</span>
                  <select
                    value={draft.groupId}
                    onChange={(e) => setDraft((d) => ({ ...d, groupId: e.target.value, subGroupId: '', subSubGroupId: '' }))}
                  >
                    <option value="">All groups</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="irp-panel-pair">
                  <label>
                    <span>SubGroup</span>
                    <select
                      value={draft.subGroupId}
                      disabled={!draft.groupId}
                      onChange={(e) => setDraft((d) => ({ ...d, subGroupId: e.target.value, subSubGroupId: '' }))}
                    >
                      <option value="">All</option>
                      {draftSubGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>SubSubGroup</span>
                    <select
                      value={draft.subSubGroupId}
                      disabled={!draft.subGroupId}
                      onChange={(e) => setDraft((d) => ({ ...d, subSubGroupId: e.target.value }))}
                    >
                      <option value="">All</option>
                      {draftSubSubs.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="irp-panel-pair">
                  <label>
                    <span>Product Type</span>
                    <select value={draft.productType} onChange={(e) => setDraft((d) => ({ ...d, productType: e.target.value }))}>
                      <option value="">All</option>
                      <option value="NORMAL">Normal</option>
                      <option value="RAW MATERIAL">Raw Material</option>
                      <option value="COMBO">Combo</option>
                    </select>
                  </label>
                  <label>
                    <span>Cost Type</span>
                    <select value={draft.costType} onChange={(e) => setDraft((d) => ({ ...d, costType: e.target.value }))}>
                      <option value="LastPurchaseCost">Last Purchase</option>
                      <option value="AverageCost">Average</option>
                    </select>
                  </label>
                </div>
                <label>
                  <span>Last Supplier</span>
                  <select value={draft.supplierId} onChange={(e) => setDraft((d) => ({ ...d, supplierId: e.target.value }))}>
                    <option value="">All</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="irp-panel-pair">
                  <label>
                    <span>Brand</span>
                    <select value={draft.brandId} onChange={(e) => setDraft((d) => ({ ...d, brandId: e.target.value }))}>
                      <option value="">All</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Location</span>
                    <select value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}>
                      <option value="">All</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="irp-panel-qty">
                  <span>Qty On Hand</span>
                  <div>
                    <select
                      value={draft.qtyOp}
                      onChange={(e) => setDraft((d) => ({ ...d, qtyOp: e.target.value }))}
                      aria-label="Qty operator"
                    >
                      <option value="&gt;">&gt;</option>
                      <option value="&lt;">&lt;</option>
                      <option value="=">=</option>
                      <option value="&gt;=">&gt;=</option>
                      <option value="&lt;=">&lt;=</option>
                      <option value="&lt;&gt;">&lt;&gt;</option>
                    </select>
                    <input
                      value={draft.qty}
                      onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                      placeholder="All"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
              <div className="irp-panel-foot">
                <button type="button" className="irp-btn" onClick={() => setDraft(EMPTY_FILTERS)}>
                  Clear
                </button>
                <button type="button" className="irp-btn is-primary" onClick={applyPanel}>
                  Apply
                </button>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  )
}
