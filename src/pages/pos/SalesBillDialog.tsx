/**
 * SalesMasterBackOfficeFrm.DisplayRecord — read-only bill after viewer double-click.
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'

type Props = {
  salesId: string
  onClose: () => void
}

type Item = {
  slNo: number
  shortDescription: string
  qty: number
  unitPrice: number
  discount: number
  subTotalC: number
  tax1AmountC: number
  lineTotal: number
  modifier: string
}

function money(n: unknown) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
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

export default function SalesBillDialog({ salesId, onClose }: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [bill, setBill] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    let alive = true
    setState('loading')
    apiService
      .fetchSalesViewerBill(salesId)
      .then((res) => {
        if (!alive) return
        const list = Array.isArray(res.items) ? res.items : []
        setBill(res)
        setItems(
          list.map((it, i) => {
            const row = it as Record<string, unknown>
            return {
              slNo: Number(row.slNo) || i + 1,
              shortDescription: String(row.shortDescription ?? row.ShortDescription ?? ''),
              qty: Number(row.qty ?? row.Qty) || 0,
              unitPrice: Number(row.unitPrice ?? row.UnitPrice) || 0,
              discount: Number(row.discount ?? row.DiscountAmount) || 0,
              subTotalC: Number(row.subTotalC ?? row.SubTotalC) || 0,
              tax1AmountC: Number(row.tax1AmountC ?? row.Tax1AmountC) || 0,
              lineTotal: Number(row.lineTotal ?? row.LineTotal) || 0,
              modifier: String(row.modifier ?? ''),
            }
          }),
        )
        setState('ready')
      })
      .catch((err) => {
        if (!alive) return
        setError(errMessage(err, 'Sales Not Found !!!!!!'))
        setState('error')
      })
    return () => {
      alive = false
    }
  }, [salesId])

  return (
    <div className="pd-mod-overlay pd-sb-overlay" role="presentation">
      <div className="pd-sb" role="dialog" aria-modal="true" aria-labelledby="pd-sb-title">
        <header className="pd-sv-head">
          <div>
            <p className="pd-mod-kicker">Sales</p>
            <h2 id="pd-sb-title">{String(bill?.paymentMode ?? 'SALES')}</h2>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        {state === 'loading' ? <p className="pd-sv-empty">Loading bill…</p> : null}
        {state === 'error' ? <p className="pd-sv-empty">{error}</p> : null}

        {state === 'ready' && bill ? (
          <>
            <div className="pd-sb-meta">
              <label>
                <span>Bill No</span>
                <strong>{String(bill.billNo ?? '')}</strong>
              </label>
              <label>
                <span>Bill Date</span>
                <strong>{fmtWhen(bill.billTime ?? bill.billDate)}</strong>
              </label>
              <label>
                <span>Customer Name</span>
                <strong>{String(bill.customerName ?? 'Walk-in')}</strong>
              </label>
              <label>
                <span>Payment Mode</span>
                <strong>{String(bill.paymentMode ?? '')}</strong>
              </label>
              <label>
                <span>Cashier Name</span>
                <strong>{String(bill.cashierName ?? '')}</strong>
              </label>
              <label>
                <span>Waiter</span>
                <strong>{String(bill.waiterName ?? '')}</strong>
              </label>
              <label>
                <span>Counter No.</span>
                <strong>{String(bill.counterNo ?? '')}</strong>
              </label>
              <label>
                <span>CreditCard No.</span>
                <strong>{String(bill.creditCardNo || '—')}</strong>
              </label>
              <label>
                <span>Table</span>
                <strong>{String(bill.tableName || '—')}</strong>
              </label>
            </div>

            <div className="pd-sv-grid-wrap pd-sb-grid">
              <table className="pd-sv-grid">
                <thead>
                  <tr>
                    <th>Sl No</th>
                    <th>Short Description</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit Price</th>
                    <th className="num">Disc.</th>
                    <th className="num">TaxableAmount</th>
                    <th className="num">VAT</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.slNo}>
                      <td>{it.slNo}</td>
                      <td>
                        {it.shortDescription}
                        {it.modifier ? <div className="pd-sb-mod">{it.modifier}</div> : null}
                      </td>
                      <td className="num">{it.qty}</td>
                      <td className="num">{money(it.unitPrice)}</td>
                      <td className="num">{money(it.discount)}</td>
                      <td className="num">{money(it.subTotalC)}</td>
                      <td className="num">{money(it.tax1AmountC)}</td>
                      <td className="num">{money(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="pd-sb-foot">
              <div className="pd-sb-totals">
                <span>
                  Amount : <b>{money(bill.subTotal)}</b>
                </span>
                <span>
                  Disc. : <b>{money(bill.discountAmount)}</b>
                </span>
                <span>
                  Tax : <b>{money(bill.tax1Amount)}</b>
                </span>
                <span>
                  Total : <b>{money(bill.amount)}</b>
                </span>
                <span>
                  Paid : <b>{money(bill.paidAmount)}</b>
                </span>
                <span>
                  Balance : <b>{money(bill.balancePaid)}</b>
                </span>
              </div>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  )
}
