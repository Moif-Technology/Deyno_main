/**
 * StockAdjustmentList — date range + document list. Double-click opens the entry.
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import type { StockDocType } from './StockEntryDialog'

type Props = {
  docType: StockDocType
  onClose: () => void
  onSelect: (entryId: number) => void
  onNew: () => void
}

const TITLES: Record<StockDocType, string> = {
  ADJ: 'Stock Adjust List',
  DMG: 'Damage List',
  ASE: 'Additional Stock List',
}

type Row = {
  entryId: number
  entryNo: string
  entryDate: string
  postStatus: string
  remark: string
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function fmtDate(d: unknown) {
  if (!d) return '—'
  const dt = new Date(String(d))
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function StockEntryListDialog({ docType, onClose, onSelect, onNew }: Props) {
  const [dateFrom, setDateFrom] = useState(daysAgoISO(7))
  const [dateTo, setDateTo] = useState(todayISO)
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setState('loading')
    setError(null)
    try {
      const list = await apiService.fetchStockEntries({ docType, dateFrom, dateTo })
      setRows(
        list.map((r) => ({
          entryId: Number(r.entryId ?? r.entry_id) || 0,
          entryNo: String(r.entryNo ?? r.entry_no ?? ''),
          entryDate: String(r.entryDate ?? r.entry_date ?? ''),
          postStatus: String(r.postStatus ?? r.post_status ?? ''),
          remark: String(r.remark ?? ''),
        })),
      )
      setState('idle')
    } catch (err) {
      setRows([])
      setState('error')
      setError(errMessage(err, 'Could not load list'))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType])

  function openRow(id: number) {
    if (id > 0) onSelect(id)
  }

  return (
    <div
      className="pd-mod-overlay pd-inv-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-inv pd-stk-list" role="dialog" aria-modal="true" aria-labelledby="pd-stk-list-title">
        <header className="pd-inv-head">
          <div className="pd-inv-head-left">
            <div>
              <p className="pd-mod-kicker">Transactions</p>
              <h2 id="pd-stk-list-title">{TITLES[docType]}</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        <div className="pd-stk-list-filters">
          <label>
            <span>From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
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
                <th>No</th>
                <th>Date</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {state === 'idle' && rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="pd-inv-empty">
                    No data matching this criteria
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.entryId}
                    className={selected === r.entryId ? 'is-sel' : undefined}
                    onClick={() => setSelected(r.entryId)}
                    onDoubleClick={() => openRow(r.entryId)}
                  >
                    <td>{r.entryNo || r.entryId}</td>
                    <td>{fmtDate(r.entryDate)}</td>
                    <td className={r.postStatus === 'POSTED' ? 'pd-stk-posted' : 'pd-stk-draft'}>
                      {r.postStatus}
                    </td>
                    <td>{r.remark}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="pd-inv-foot">
          <span className="pd-inv-total">COUNT : {rows.length}</span>
          <button type="button" className="pd-inv-ghost" onClick={onNew}>
            New
          </button>
          <button
            type="button"
            className="pd-inv-go"
            onClick={() => selected && openRow(selected)}
            disabled={!selected}
          >
            Select
          </button>
          <button type="button" className="pd-inv-ghost" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
