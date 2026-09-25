/**
 * SalesViewerFrm — date/customer/bill filters + grid.
 * Double-click → SalesMasterBackOfficeFrm (read-only bill).
 */
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { DatePicker } from '../../components/common/DatePicker'
import { SearchBar } from '../../components/common/SearchBar'
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
  }, [])

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
      <div className="pd-sv" role="dialog" aria-modal="true" aria-labelledby="pd-sv-title">
        <header className="pd-sv-head">
          <div>
            <p className="pd-mod-kicker">Report Viewers</p>
            <h2 id="pd-sv-title">SALES VIEWER</h2>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        <div className="pd-sv-filters">
          <label>
            <span>From</span>
            <DatePicker value={dateFrom} onChange={setDateFrom} max={dateTo} />
          </label>
          <label>
            <span>To</span>
            <DatePicker value={dateTo} onChange={setDateTo} min={dateFrom} />
          </label>
          <label>
            <span>Bill No</span>
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Bill No" />
          </label>
          <label>
            <span>Counter</span>
            <input value={counterNo} onChange={(e) => setCounterNo(e.target.value)} placeholder="Counter" />
          </label>
          <label>
            <span>Customer</span>
            <input
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value)
                if (!e.target.value) setCustomerId('')
              }}
              placeholder="Customer"
            />
          </label>
          <label>
            <span>Location</span>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="ALL">ALL</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Payment</span>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="ALL">All</option>
              <option value="CASH">CASH</option>
              <option value="CREDITCARD">CREDITCARD</option>
              <option value="ONLINE">ONLINE</option>
              <option value="SPLITPAY">SPLITPAY</option>
            </select>
          </label>
          <label className="pd-sv-search">
            <span>Search</span>
            <SearchBar
              size="sm"
              value={search}
              onValueChange={setSearch}
              onSubmit={() => void load()}
              placeholder="Bill / customer / cashier"
            />
          </label>
          <button type="button" className="pd-sv-search-btn" onClick={() => void load()}>
            Search
          </button>
        </div>

        <div className="pd-sv-grid-wrap">
          <table className="pd-sv-grid">
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Counter</th>
                <th>Customer</th>
                <th>Bill Date</th>
                <th>Bill Time</th>
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
                    Loading…
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
                    No data to print............
                  </td>
                </tr>
              ) : null}
              {visible.map((row) => {
                const id = String(row.salesId ?? row.SalesID)
                return (
                  <tr
                    key={id}
                    className={selectedId === id ? 'is-sel' : undefined}
                    onClick={() => setSelectedId(id)}
                    onDoubleClick={() => openRow(row)}
                  >
                    <td>{String(row.billNo ?? row.BillNo ?? '')}</td>
                    <td>{String(row.counterNo ?? row.CounterNo ?? '')}</td>
                    <td>{String(row.customerName ?? row.CustomerName ?? '')}</td>
                    <td>{fmtDate(row.billDate ?? row.BillDate)}</td>
                    <td>{fmtTime(row.billTime ?? row.BillTime)}</td>
                    <td>{String(row.paymentMode ?? row.PaymentMode ?? '')}</td>
                    <td>{String(row.deliveryBoy ?? row.DeliveryBoy ?? '')}</td>
                    <td className="num">{money(row.amount ?? row.Amount)}</td>
                    <td className="num">{money(row.discount ?? row.Discount)}</td>
                    <td className="num">{money(row.taxableAmount ?? row.TaxableAmount)}</td>
                    <td className="num">{money(row.tax1AmountM ?? row.Tax1AmountM)}</td>
                    <td className="num">{money(row.total ?? row.Total)}</td>
                    <td>{String(row.postStatus ?? row.PostStatus ?? '')}</td>
                    <td>{String(row.cashierName ?? row.CashierName ?? '')}</td>
                    <td>{String(row.counterCloseStatus ?? row.CounterCloseStatus ?? '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <footer className="pd-sv-foot">
          <span>COUNT : {visible.length}</span>
          <span>TOTAL AMOUNT : {money(totalAmt)}</span>
          <span className="pd-sv-hint">Double-click a row to open the bill</span>
          <button
            type="button"
            className="pd-sv-search-btn"
            onClick={() => {
              const row = visible.find((r) => String(r.salesId ?? r.SalesID) === selectedId)
              if (row) openRow(row)
            }}
          >
            Select
          </button>
        </footer>
      </div>

      {openSalesId ? (
        <SalesBillDialog salesId={openSalesId} onClose={() => setOpenSalesId(null)} />
      ) : null}
    </div>
  )
}
