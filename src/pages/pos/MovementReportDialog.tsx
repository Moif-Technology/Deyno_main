/**
 * RptProductMovementRpt — stock ledger from settle / purchase / adjustment logs.
 * Closing = Opening + In − Out.
 *
 * Same layout as the Stock Report: opens straight on the report (today). Top
 * bar: Summary / Details + date range on the left; search and Print ▾ (Print /
 * PDF / Excel) on the right. Common table, fixed totals footer. Search filters
 * the loaded rows live; Enter in it asks the server for that item.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, ChevronDown, FileSpreadsheet, FileText, Printer, Search, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { DateRangePicker } from '../../components/common/DateRangePicker'
import { exportMovementExcel, exportMovementPdf } from './movementReportExport'
import './InventoryReportDialog.css'

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
  const [dateFrom, setDateFrom] = useState(todayISO)
  const [dateTo, setDateTo] = useState(todayISO)
  const [mode, setMode] = useState<'summary' | 'detail'>('summary')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [search, setSearch] = useState('')
  const [printOpen, setPrintOpen] = useState(false)
  const printRef = useRef<HTMLDivElement | null>(null)
  const requestId = useRef(0)

  async function loadReport(from = dateFrom, to = dateTo, name = '') {
    const id = ++requestId.current
    setState('loading')
    setError(null)
    try {
      const lo = from <= to ? from : to
      const hi = from <= to ? to : from
      const res = await apiService.fetchMovementReport({ dateFrom: lo, dateTo: hi, name: name.trim() || undefined })
      if (id !== requestId.current) return
      const items = asItems(res)
      const lines = asLines(res)
      const totals = (items.length ? (res.totals as Report['totals']) : null) ?? {
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
        dateFrom: String(res.dateFrom ?? lo),
        dateTo: String(res.dateTo ?? hi),
        items,
        lines,
        totals,
      })
      if (!items.length && lines.length) setMode('detail')
      setState('ready')
    } catch (err) {
      if (id !== requestId.current) return
      setState('error')
      setError(errMessage(err, 'Could not load movement report'))
    }
  }

  // Show today's movement on open.
  useEffect(() => {
    void loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!printOpen) return
    const onDown = (e: MouseEvent) => {
      if (!printRef.current?.contains(e.target as Node)) setPrintOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [printOpen])

  const filtered = useMemo(() => {
    if (!report) return null
    const n = search.trim().toLowerCase()
    const items = n
      ? report.items.filter((row) => row.description.toLowerCase().includes(n) || row.barcode.toLowerCase().includes(n))
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
  }, [report, search, mode])

  const rowCount = filtered ? (mode === 'detail' ? filtered.lines.length : filtered.items.length) : 0
  const loadedCount = report ? (mode === 'detail' ? report.lines.length : report.items.length) : 0

  function runPrint(kind: 'print' | 'pdf' | 'excel') {
    setPrintOpen(false)
    if (!filtered) return
    try {
      if (kind === 'excel') exportMovementExcel({ ...filtered, mode })
      else if (kind === 'pdf') exportMovementPdf({ ...filtered, mode })
      else window.print()
    } catch (err) {
      setError(errMessage(err, kind === 'excel' ? 'Could not export Excel' : 'Could not export PDF'))
    }
  }

  const colCount = mode === 'detail' ? 9 : 7

  const tableHead =
    mode === 'detail' ? (
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
    ) : (
      <tr>
        <th>Barcode</th>
        <th>Description</th>
        <th>Group</th>
        <th className="num">Opening</th>
        <th className="num">In</th>
        <th className="num">Out</th>
        <th className="num">Closing</th>
      </tr>
    )

  function tableBody() {
    if (!filtered) return null
    if (rowCount === 0) {
      return (
        <tr>
          <td colSpan={colCount} className="pd-inv-empty">
            No movement in this date range
          </td>
        </tr>
      )
    }
    if (mode === 'detail') {
      return filtered.lines.map((row, i) => (
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
    }
    return filtered.items.map((row) => (
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
  }

  return (
    <div
      className="pd-mod-overlay pd-inv-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`pd-inv is-report irp mvr is-${mode}`} role="dialog" aria-modal="true" aria-labelledby="pd-mv-title">
        <header className="pd-inv-head">
          <div className="pd-inv-head-left">
            <span className="pd-mod-header-icon">
              <ArrowLeftRight size={16} />
            </span>
            <div>
              <p className="pd-mod-kicker">Transactions</p>
              <h2 id="pd-mv-title">Movement Report</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        <div className="irp-bar">
          <div className="irp-toggles">
            <div className="mvr-seg" role="tablist" aria-label="View">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'summary'}
                className={mode === 'summary' ? 'is-on' : undefined}
                onClick={() => setMode('summary')}
              >
                Summary
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'detail'}
                className={mode === 'detail' ? 'is-on' : undefined}
                onClick={() => setMode('detail')}
              >
                Details
              </button>
            </div>
            <div className="mvr-range">
              <DateRangePicker
                from={dateFrom}
                to={dateTo}
                onChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                  void loadReport(from, to, search)
                }}
              />
            </div>
          </div>

          <div className="irp-actions">
            <span className="irp-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadReport(dateFrom, dateTo, search)
                }}
                placeholder="Search item or doc no"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    void loadReport(dateFrom, dateTo, '')
                  }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <div className="irp-print" ref={printRef}>
              <button
                type="button"
                className="irp-btn is-primary"
                disabled={!rowCount}
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

        <div className="irp-screen">
          <div className={`pd-grid-wrap irp-table${state === 'loading' ? ' is-loading' : ''}`}>
            <table className="pd-grid">
              <thead>{tableHead}</thead>
              <tbody>
                {filtered ? (
                  tableBody()
                ) : (
                  <tr>
                    <td colSpan={colCount} className="pd-inv-empty">
                      {state === 'loading' ? 'Collecting data…' : 'No report yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="irp-foot">
          <span>
            Count <b>{filtered?.totals.count ?? 0}</b>
            {rowCount !== loadedCount ? <em> of {loadedCount}</em> : null}
          </span>
          {mode === 'summary' ? (
            <span>
              Opening <b>{qtyFmt(filtered?.totals.opening ?? 0)}</b>
            </span>
          ) : null}
          <span className="mvr-in">
            In <b>{qtyFmt(filtered?.totals.inQty ?? 0)}</b>
          </span>
          <span className="mvr-out">
            Out <b>{qtyFmt(filtered?.totals.outQty ?? 0)}</b>
          </span>
          {mode === 'summary' ? (
            <span className="is-amount">
              Closing <b>{qtyFmt(filtered?.totals.closing ?? 0)}</b>
            </span>
          ) : null}
          {state === 'loading' ? <span className="irp-foot-status">Loading…</span> : null}
        </footer>

        {/* Print only: the formatted report sheet */}
        {filtered ? (
          <div className="pd-inv-sheet irp-print-sheet">
            <div className="pd-inv-letterhead">
              {filtered.heading1 ? <h3>{filtered.heading1}</h3> : null}
              {filtered.heading2 ? <p>{filtered.heading2}</p> : null}
              <h1>{filtered.reportTitle}</h1>
              <div className="pd-inv-sub">
                <span>{filtered.heading3}</span>
                <span>{filtered.heading4}</span>
              </div>
            </div>
            <table className="pd-inv-grid">
              <thead>{tableHead}</thead>
              <tbody>{tableBody()}</tbody>
              <tfoot>
                {mode === 'detail' ? (
                  <tr>
                    <td colSpan={5}>COUNT : {filtered.totals.count}</td>
                    <td className="num" />
                    <td className="num">{qtyFmt(filtered.totals.inQty)}</td>
                    <td className="num">{qtyFmt(filtered.totals.outQty)}</td>
                    <td className="num" />
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={3}>COUNT : {filtered.totals.count}</td>
                    <td className="num">{qtyFmt(filtered.totals.opening)}</td>
                    <td className="num">{qtyFmt(filtered.totals.inQty)}</td>
                    <td className="num">{qtyFmt(filtered.totals.outQty)}</td>
                    <td className="num">{qtyFmt(filtered.totals.closing)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
