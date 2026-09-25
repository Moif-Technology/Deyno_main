/**
 * RptProductMovementRpt — stock ledger from settle / purchase / adjustment logs.
 * Filters: item name + from / to date. Closing = Opening + In − Out.
 */
import { useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronLeft, FileSpreadsheet, FileText, Printer, Search, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { exportMovementExcel, exportMovementPdf } from './movementReportExport'

type ItemRow = {
  productId: number
  barcode: string
  description: string
  groupName: string
  opening: number
  inQty: number
  outQty: number
  closing: number
}

type LineRow = {
  logId: number
  productId: number
  barcode: string
  description: string
  groupName: string
  date: string
  type: string
  documentNo: string
  opening: number
  inQty: number
  outQty: number
  closing: number
}

type Report = {
  reportTitle: string
  heading1: string
  heading2: string
  heading3: string
  heading4: string
  dateFrom: string
  dateTo: string
  items: ItemRow[]
  lines: LineRow[]
  totals: { count: number; opening: number; inQty: number; outQty: number; closing: number }
}

type Props = { onClose: () => void }

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function qtyFmt(n: unknown) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0.00'
  return v.toFixed(2)
}

function fmtWhen(d: unknown) {
  if (!d) return '—'
  const dt = new Date(String(d))
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function asItems(payload: unknown): ItemRow[] {
  if (!payload || typeof payload !== 'object') return []
  const list = (payload as { items?: unknown }).items
  if (!Array.isArray(list)) return []
  return list.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>
    return {
      productId: Number(row.productId) || 0,
      barcode: String(row.barcode ?? ''),
      description: String(row.description ?? ''),
      groupName: String(row.groupName ?? ''),
      opening: Number(row.opening) || 0,
      inQty: Number(row.inQty) || 0,
      outQty: Number(row.outQty) || 0,
      closing: Number(row.closing) || 0,
    }
  })
}

function asLines(payload: unknown): LineRow[] {
  if (!payload || typeof payload !== 'object') return []
  const list = (payload as { lines?: unknown }).lines
  if (!Array.isArray(list)) return []
  return list.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>
    return {
      logId: Number(row.logId) || 0,
      productId: Number(row.productId) || 0,
      barcode: String(row.barcode ?? ''),
      description: String(row.description ?? ''),
      groupName: String(row.groupName ?? ''),
      date: String(row.date ?? ''),
      type: String(row.type ?? ''),
      documentNo: String(row.documentNo ?? ''),
      opening: Number(row.opening) || 0,
      inQty: Number(row.inQty) || 0,
      outQty: Number(row.outQty) || 0,
      closing: Number(row.closing) || 0,
    }
  })
}

export default function MovementReportDialog({ onClose }: Props) {
  const [productName, setProductName] = useState('')
  const [dateFrom, setDateFrom] = useState(todayISO)
  const [dateTo, setDateTo] = useState(todayISO)
  const [view, setView] = useState<'filters' | 'report'>('filters')
  const [mode, setMode] = useState<'summary' | 'detail'>('summary')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [viewName, setViewName] = useState('')

  async function showReport() {
    setState('loading')
    setError(null)
    try {
      const from = dateFrom <= dateTo ? dateFrom : dateTo
      const to = dateFrom <= dateTo ? dateTo : dateFrom
      const res = await apiService.fetchMovementReport({
        dateFrom: from,
        dateTo: to,
        name: productName.trim() || undefined,
      })
      const items = asItems(res)
      const lines = asLines(res)
      if (items.length === 0 && lines.length === 0) {
        setReport(null)
        setState('idle')
        setError('No Item Found For This Criteria..........')
        return
      }
      const totals = (res.totals as Report['totals']) ?? {
        count: items.length,
        opening: items.reduce((n, r) => n + r.opening, 0),
        inQty: items.reduce((n, r) => n + r.inQty, 0),
        outQty: items.reduce((n, r) => n + r.outQty, 0),
        closing: items.reduce((n, r) => n + r.closing, 0),
      }
      setReport({
        reportTitle: String(res.reportTitle ?? 'Product Movement'),
        heading1: String(res.heading1 ?? ''),
        heading2: String(res.heading2 ?? ''),
        heading3: String(res.heading3 ?? ''),
        heading4: String(res.heading4 ?? ''),
        dateFrom: String(res.dateFrom ?? from),
        dateTo: String(res.dateTo ?? to),
        items,
        lines,
        totals,
      })
      setViewName('')
      setMode(items.length ? 'summary' : 'detail')
      setView('report')
      setState('idle')
    } catch (err) {
      setReport(null)
      setState('error')
      setError(errMessage(err, 'Could not load movement report'))
    }
  }

  const filtered = useMemo(() => {
    if (!report) return null
    const n = viewName.trim().toLowerCase()
    const items = n
      ? report.items.filter(
          (row) =>
            row.description.toLowerCase().includes(n) || row.barcode.toLowerCase().includes(n),
        )
      : report.items
    const lines = n
      ? report.lines.filter(
          (row) =>
            row.description.toLowerCase().includes(n) ||
            row.barcode.toLowerCase().includes(n) ||
            row.documentNo.toLowerCase().includes(n),
        )
      : report.lines
    const source = mode === 'detail' ? lines : items
    const totals = source.reduce(
      (acc, r) => {
        acc.count += 1
        acc.opening += r.opening
        acc.inQty += r.inQty
        acc.outQty += r.outQty
        acc.closing += r.closing
        return acc
      },
      { count: 0, opening: 0, inQty: 0, outQty: 0, closing: 0 },
    )
    totals.opening = Math.round(totals.opening * 100) / 100
    totals.inQty = Math.round(totals.inQty * 100) / 100
    totals.outQty = Math.round(totals.outQty * 100) / 100
    totals.closing = Math.round(totals.closing * 100) / 100
    return { ...report, items, lines, totals }
  }, [report, viewName, mode])

  function runExcel() {
    if (!filtered) return
    try {
      setExporting('excel')
      exportMovementExcel({ ...filtered, mode })
    } catch (err) {
      setError(errMessage(err, 'Could not export Excel'))
    } finally {
      setExporting(null)
    }
  }

  function runPdf() {
    if (!filtered) return
    try {
      setExporting('pdf')
      exportMovementPdf({ ...filtered, mode })
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
        aria-labelledby="pd-mv-title"
      >
        <header className="pd-inv-head">
          <div className="pd-inv-head-left">
            {view === 'report' ? (
              <button type="button" className="pd-mod-back" onClick={() => setView('filters')} aria-label="Back">
                <ChevronLeft size={16} />
              </button>
            ) : (
              <span className="pd-mod-header-icon">
                <ArrowLeftRight size={16} />
              </span>
            )}
            <div>
              <p className="pd-mod-kicker">Transactions</p>
              <h2 id="pd-mv-title">{view === 'report' ? 'Product Movement' : 'Movement Report'}</h2>
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
                <div className="pd-inv-form pd-mv-form">
                  <label className="pd-inv-name">
                    <span>Item Name</span>
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
                    <span>From</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </label>
                  <label>
                    <span>To</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </label>
                </div>
                <p className="pd-inv-hint">
                  Opening is stock before From date. In is received (purchase / sales return). Out is issued (sales).
                  Closing = Opening + In − Out. Leave name blank to list items that moved in the date range.
                </p>
              </div>
              {error ? <p className="pd-inv-msg">{error}</p> : null}
            </div>
            <footer className="pd-inv-foot">
              <button type="button" className="pd-inv-ghost" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="pd-inv-go"
                onClick={() => void showReport()}
                disabled={state === 'loading'}
              >
                {state === 'loading' ? 'Loading…' : 'Show Report'}
              </button>
            </footer>
          </>
        ) : filtered ? (
          <>
            <div className="pd-rv-toolbar">
              <span className="pd-rv-toolbar-title">Report Viewer</span>
              <button
                type="button"
                className={`pd-rv-tool${mode === 'summary' ? ' is-on' : ''}`}
                onClick={() => setMode('summary')}
              >
                Summary
              </button>
              <button
                type="button"
                className={`pd-rv-tool${mode === 'detail' ? ' is-on' : ''}`}
                onClick={() => setMode('detail')}
              >
                Details
              </button>
              <span className="pd-rv-name">
                <span className="pd-inv-search">
                  <Search size={13} />
                  <input
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    placeholder="Filter name / barcode"
                  />
                </span>
              </span>
              <span className="pd-inv-total">
                COUNT : {filtered.totals.count} &nbsp; IN {qtyFmt(filtered.totals.inQty)} &nbsp; OUT{' '}
                {qtyFmt(filtered.totals.outQty)}
              </span>
              <button type="button" className="pd-rv-tool" onClick={runExcel} disabled={exporting != null}>
                <FileSpreadsheet size={13} />
                Excel
              </button>
              <button type="button" className="pd-rv-tool" onClick={runPdf} disabled={exporting != null}>
                <FileText size={13} />
                PDF
              </button>
              <button type="button" className="pd-rv-tool" onClick={() => window.print()}>
                <Printer size={13} />
                Print
              </button>
            </div>
            <div className="pd-inv-body pd-inv-body-report">
              <div className="pd-inv-sheet">
                <div className="pd-inv-letterhead">
                  {filtered.heading1 ? <h3>{filtered.heading1}</h3> : null}
                  {filtered.heading2 ? <p>{filtered.heading2}</p> : null}
                  <h1>{filtered.reportTitle}</h1>
                  <div className="pd-inv-sub">
                    <span>{filtered.heading3}</span>
                    <span>{filtered.heading4}</span>
                  </div>
                </div>
                {mode === 'detail' ? (
                  <table className="pd-inv-grid">
                    <thead>
                      <tr>
                        <th>Barcode</th>
                        <th>Description</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Doc No</th>
                        <th className="num">Opening</th>
                        <th className="num">In</th>
                        <th className="num">Out</th>
                        <th className="num">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.lines.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="pd-inv-empty">
                            No Item Found For This Criteria..........
                          </td>
                        </tr>
                      ) : (
                        filtered.lines.map((row, i) => (
                          <tr key={`${row.logId}-${i}`}>
                            <td>{row.barcode}</td>
                            <td>{row.description}</td>
                            <td>{fmtWhen(row.date)}</td>
                            <td>{row.type}</td>
                            <td>{row.documentNo}</td>
                            <td className="num">{qtyFmt(row.opening)}</td>
                            <td className="num pd-mv-in">{row.inQty ? qtyFmt(row.inQty) : ''}</td>
                            <td className="num pd-mv-out">{row.outQty ? qtyFmt(row.outQty) : ''}</td>
                            <td className="num">{qtyFmt(row.closing)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5}>COUNT : {filtered.totals.count}</td>
                        <td className="num" />
                        <td className="num">{qtyFmt(filtered.totals.inQty)}</td>
                        <td className="num">{qtyFmt(filtered.totals.outQty)}</td>
                        <td className="num" />
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <table className="pd-inv-grid">
                    <thead>
                      <tr>
                        <th>Barcode</th>
                        <th>Description</th>
                        <th>Group</th>
                        <th className="num">Opening</th>
                        <th className="num">In</th>
                        <th className="num">Out</th>
                        <th className="num">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="pd-inv-empty">
                            No Item Found For This Criteria..........
                          </td>
                        </tr>
                      ) : (
                        filtered.items.map((row) => (
                          <tr key={row.productId}>
                            <td>{row.barcode}</td>
                            <td>{row.description}</td>
                            <td>{row.groupName}</td>
                            <td className="num">{qtyFmt(row.opening)}</td>
                            <td className="num pd-mv-in">{qtyFmt(row.inQty)}</td>
                            <td className="num pd-mv-out">{qtyFmt(row.outQty)}</td>
                            <td className="num">{qtyFmt(row.closing)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>COUNT : {filtered.totals.count}</td>
                        <td className="num">{qtyFmt(filtered.totals.opening)}</td>
                        <td className="num">{qtyFmt(filtered.totals.inQty)}</td>
                        <td className="num">{qtyFmt(filtered.totals.outQty)}</td>
                        <td className="num">{qtyFmt(filtered.totals.closing)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
