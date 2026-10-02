/**
 * SalesViewerFrm — date/customer/bill filters + grid.
 * Double-click → SalesMasterBackOfficeFrm (read-only bill).
 */
import { useEffect, useMemo, useState } from 'react'
import { FileText, Receipt, Search, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { digits } from '../../utils/validate'
import { DateRangePicker } from '../../components/common/DateRangePicker'
import SalesBillDialog from './SalesBillDialog'

type AreaOpt = { id: number; name: string }
type BillRow = Record<string, unknown>

type Props = {
  areas: AreaOpt[]
  onClose: () => void
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function money(n: unknown) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

function fmtDate(d: unknown) {
  if (!d) return '—'
  const dt = new Date(String(d))
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(d: unknown) {
  if (!d) return '—'
  const dt = new Date(String(d))
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export default function SalesViewerDialog({ areas, onClose }: Props) {
  const [dateFrom, setDateFrom] = useState(todayISO)
  const [dateTo, setDateTo] = useState(todayISO)
  const [billNo, setBillNo] = useState('')
  const [counterNo, setCounterNo] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [paymentMode, setPaymentMode] = useState('ALL')
  const [areaId, setAreaId] = useState('ALL')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<BillRow[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openSalesId, setOpenSalesId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const cust = customerName.trim().toLowerCase()
    return rows.filter((b) => {
      const name = String(b.customerName ?? b.CustomerName ?? '').toLowerCase()
      const bill = String(b.billNoDisplay ?? b.billNo ?? b.BillNo ?? '').toLowerCase()
      const cashier = String(b.cashierName ?? b.CashierName ?? '').toLowerCase()
      if (cust && !name.includes(cust)) return false
      if (!q) return true
      return name.includes(q) || bill.includes(q) || cashier.includes(q)
    })
  }, [rows, search, customerName])

  const totalAmt = useMemo(
    () => visible.reduce((n, r) => n + (Number(r.total ?? r.Total) || 0), 0),
    [visible],
  )

  async function load() {
    setState('loading')
    setError(null)
    try {
      const bills = await apiService.fetchSalesViewer({
        dateFrom,
        dateTo,
        billNo: billNo.trim() || undefined,
        counterNo: counterNo.trim() || undefined,
        customerId: customerId || undefined,
        paymentMode: paymentMode === 'ALL' ? undefined : paymentMode,
        areaId: areaId === 'ALL' ? undefined : areaId,
      })
      setRows(bills)
      setState('idle')
    } catch (err) {
      setRows([])
      setState('error')
      setError(errMessage(err, 'Could not load sales'))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, paymentMode, areaId])

  function onFilterKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void load()
  }

  function openRow(row: BillRow) {
    const id = String(row.salesId ?? row.SalesID ?? '')
    if (!id || id === '0') return
    setOpenSalesId(id)
  }

  return (
    <div
      className="pd-mod-overlay pd-sv-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !openSalesId) onClose()
      }}
    >
      <div className="pd-sv svx" role="dialog" aria-modal="true" aria-labelledby="pd-sv-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Receipt size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Reports A4</p>
              <h2 id="pd-sv-title" className="pd-mod-item-name">
                Sales Viewer
              </h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="svx-body">
          {/* Row 1: quick find in the loaded bills, date range, payment mode */}
          <div className="lst-bar svx-top">
            <span className="lst-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find bill, customer or cashier"
                autoFocus
              />
              {search ? (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={(from, to) => {
                setDateFrom(from)
                setDateTo(to)
              }}
            />
            <div className="lst-seg" role="radiogroup" aria-label="Payment mode">
              {[
                ['ALL', 'All'],
                ['CASH', 'Cash'],
                ['CREDITCARD', 'Card'],
                ['ONLINE', 'Online'],
                ['SPLITPAY', 'Split'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={paymentMode === value}
                  className={paymentMode === value ? 'is-on' : ''}
                  onClick={() => setPaymentMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: the narrower filters */}
          <div className="lst-bar svx-more">
            <input
              className="svx-input"
              value={billNo}
              onChange={(e) => setBillNo(e.target.value)}
              onKeyDown={onFilterKey}
              placeholder="Bill No"
              aria-label="Bill No"
            />
            <input
              className="svx-input"
              inputMode="numeric"
              value={counterNo}
              onChange={(e) => setCounterNo(digits(e.target.value, 6))}
              onKeyDown={onFilterKey}
              placeholder="Counter"
              aria-label="Counter"
            />
            <input
              className="svx-input is-wide"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value)
                if (!e.target.value) setCustomerId('')
              }}
              placeholder="Customer"
              aria-label="Customer"
            />
            <select className="lst-select" value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Location">
              <option value="ALL">All locations</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button type="button" className="lst-btn is-primary" onClick={() => void load()} disabled={state === 'loading'}>
              <Search size={14} /> Search
            </button>
          </div>

          <div className="pd-sv-grid-wrap svx-grid-wrap">
            <table className="svx-grid">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Counter</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Payment</th>
                  <th>Waiter</th>
                  <th className="num">Amount</th>
                  <th className="num">Discount</th>
                  <th className="num">Taxable</th>
                  <th className="num">Tax</th>
                  <th className="num">Total</th>
                  <th>Post</th>
                  <th>Cashier</th>
                  <th>Close</th>
                </tr>
              </thead>
              <tbody>
                {state === 'loading' ? (
                  <tr>
                    <td colSpan={15} className="pd-sv-empty">
                      Loading bills…
                    </td>
                  </tr>
                ) : null}
                {state === 'error' ? (
                  <tr>
                    <td colSpan={15} className="pd-sv-empty">
                      {error}
                    </td>
                  </tr>
                ) : null}
                {state === 'idle' && visible.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="pd-sv-empty">
                      {rows.length === 0 ? 'No bills for these filters' : 'No bill matches this search'}
                    </td>
                  </tr>
                ) : null}
                {state === 'loading'
                  ? null
                  : visible.map((row) => {
                      const id = String(row.salesId ?? row.SalesID)
                      const pay = String(row.paymentMode ?? row.PaymentMode ?? '')
                      return (
                        <tr
                          key={id}
                          className={selectedId === id ? 'is-sel' : undefined}
                          onClick={() => setSelectedId(id)}
                          onDoubleClick={() => openRow(row)}
                        >
                          <td>
                            <b>{String(row.billNo ?? row.BillNo ?? '')}</b>
                          </td>
                          <td>{String(row.counterNo ?? row.CounterNo ?? '')}</td>
                          <td title={String(row.customerName ?? row.CustomerName ?? '')}>{String(row.customerName ?? row.CustomerName ?? '')}</td>
                          <td>{fmtDate(row.billDate ?? row.BillDate)}</td>
                          <td>{fmtTime(row.billTime ?? row.BillTime)}</td>
                          <td>{pay ? <span className="lst-tag">{pay}</span> : null}</td>
                          <td title={String(row.deliveryBoy ?? row.DeliveryBoy ?? '')}>{String(row.deliveryBoy ?? row.DeliveryBoy ?? '')}</td>
                          <td className="num">{money(row.amount ?? row.Amount)}</td>
                          <td className="num">{money(row.discount ?? row.Discount)}</td>
                          <td className="num">{money(row.taxableAmount ?? row.TaxableAmount)}</td>
                          <td className="num">{money(row.tax1AmountM ?? row.Tax1AmountM)}</td>
                          <td className="num">
                            <b>{money(row.total ?? row.Total)}</b>
                          </td>
                          <td>{String(row.postStatus ?? row.PostStatus ?? '')}</td>
                          <td title={String(row.cashierName ?? row.CashierName ?? '')}>{String(row.cashierName ?? row.CashierName ?? '')}</td>
                          <td>{String(row.counterCloseStatus ?? row.CounterCloseStatus ?? '')}</td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pd-mod-foot svx-foot">
          <span className="lst-count">
            Bills <b>{visible.length}</b>
          </span>
          <span className="lst-count">
            Total <b>{money(totalAmt)}</b>
          </span>
          <span className="svx-hint">Double-tap a bill to open it</span>
          <span className="pd-mod-foot-spacer" />
          <button
            type="button"
            className="pd-mod-foot-btn is-ok"
            disabled={!selectedId}
            onClick={() => {
              const row = visible.find((r) => String(r.salesId ?? r.SalesID) === selectedId)
              if (row) openRow(row)
            }}
          >
            <FileText size={14} /> Open Bill
          </button>
        </div>
      </div>

      {openSalesId ? (
        <SalesBillDialog salesId={openSalesId} onClose={() => setOpenSalesId(null)} />
      ) : null}
    </div>
  )
}
