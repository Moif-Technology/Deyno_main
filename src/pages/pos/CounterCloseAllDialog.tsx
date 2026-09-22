/**
 * RptCounterCloseDetailsPending — Counter Close ALL.
 * X-Report = live snapshot. Z-Report = PrintSalesReportSummary (requires collected amount).
 */
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { printCounterReport } from '../../lib/printCounterReport'
import { getEnrollment } from '../../utils/deviceEnrollment'
import { getPosSession } from '../../utils/posSession'

const DENOMS = [
  { key: '1000', value: 1000, label: '1000' },
  { key: '500', value: 500, label: '500' },
  { key: '200', value: 200, label: '200' },
  { key: '100', value: 100, label: '100' },
  { key: '50', value: 50, label: '50' },
  { key: '20', value: 20, label: '20' },
  { key: '10', value: 10, label: '10' },
  { key: '5', value: 5, label: '5' },
  { key: '1', value: 1, label: '1' },
  { key: 'p50', value: 0.5, label: '0.50' },
  { key: 'p25', value: 0.25, label: '0.25' },
  { key: 'p10', value: 0.1, label: '0.10' },
] as const

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const

type Props = { onClose: () => void }
type Summary = Record<string, unknown>
type StaffRow = {
  staffId: number | null
  staffName: string
  billCount: number
  saleAmount: number
}

function money(n: unknown) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

function n(v: unknown) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function emptyCounts() {
  return Object.fromEntries(DENOMS.map((d) => [d.key, ''])) as Record<string, string>
}

export default function CounterCloseAllDialog({ onClose }: Props) {
  const session = getPosSession()
  const counterLabel = getEnrollment()?.stationName || String(session.counterNo || session.stationId || '')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [data, setData] = useState<Summary | null>(null)
  const [counts, setCounts] = useState(emptyCounts)
  const [focusKey, setFocusKey] = useState<string>('1000')
  const [collectedOverride, setCollectedOverride] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [closedNo, setClosedNo] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const denomTotal = useMemo(() => {
    return DENOMS.reduce((sum, d) => sum + d.value * (Number(counts[d.key]) || 0), 0)
  }, [counts])

  const collected =
    collectedOverride != null && collectedOverride !== '' ? Number(collectedOverride) || 0 : denomTotal
  const toCollect = n(data?.cashToBeCollected)
  const difference = collected - toCollect

  async function load() {
    setState('loading')
    setError(null)
    try {
      const row = await apiService.fetchCounterSummary({ allStaff: true })
      setData(row)
      setState('ready')
    } catch (err) {
      setData(null)
      setState('error')
      setError(errMessage(err, 'Could not load counter close'))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function setCount(key: string, raw: string) {
    if (raw && !/^\d*$/.test(raw)) return
    setCounts((prev) => ({ ...prev, [key]: raw }))
    setCollectedOverride(null)
  }

  function numPad(k: string) {
    if (k === 'C') {
      setCount(focusKey, '')
      return
    }
    if (k === '.') return
    setCount(focusKey, `${counts[focusKey] ?? ''}${k}`.replace(/^0+(?=\d)/, ''))
  }

  async function runReport(reportType: 'X' | 'Z') {
    setError(null)
    setInfo(null)
    if (reportType === 'Z') {
      if (closedNo) {
        setError('Counter already closed.')
        return
      }
      if (collectedOverride == null && !DENOMS.some((d) => String(counts[d.key] ?? '').trim() !== '')) {
        setError('Enter Collected Amount...........')
        return
      }
    }
    setBusy(true)
    try {
      const res = await apiService.closeCounter({
        reportType,
        collectedCash: collected,
        allStaff: true,
        remarks,
      })
      const merged: Summary = {
        ...(data ?? {}),
        ...res,
        collectedCash: collected,
        cashDifference: difference,
      }
      setData(merged)
      if (reportType === 'Z') {
        const closeNo = String(res.closeNo ?? '')
        setClosedNo(closeNo || 'CLOSED')
        setInfo(`Z - Report  ${closeNo}`)
      } else {
        setInfo('X - Report')
      }
      try {
        await printCounterReport(merged, {
          reportType,
          closeNo: String(res.closeNo ?? ''),
          counterNo: (merged.counterNo as number | string | undefined) ?? session.counterNo,
          reportAt: new Date(),
        })
      } catch (printErr) {
        setError(errMessage(printErr, `${reportType}-Report print failed`))
      }
    } catch (err) {
      setError(errMessage(err, reportType === 'Z' ? 'Could not close counter' : 'Could not load X-Report'))
    } finally {
      setBusy(false)
    }
  }

  const staffSales = Array.isArray(data?.staffSales) ? (data?.staffSales as StaffRow[]) : []

  function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
      <div className={`pd-cc-row${strong ? ' is-strong' : ''}`}>
        <span>{label}</span>
        <b>{value}</b>
      </div>
    )
  }

  return (
    <div className="pd-mod-overlay pd-cc-overlay" role="presentation">
      <div className="pd-cc" role="dialog" aria-modal="true" aria-labelledby="pd-cc-title">
        <header className="pd-sv-head">
          <div>
            <p className="pd-mod-kicker">Reports</p>
            <h2 id="pd-cc-title">COUNTER CLOSE ALL</h2>
          </div>
          <div className="pd-cc-head-meta">
            <span>
              Counter No : <b>{String(data?.counterNo ?? counterLabel)}</b>
            </span>
            <span>
              Cashier : <b>ALL</b>
            </span>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        {state === 'loading' ? <p className="pd-sv-empty">Loading counter reading…</p> : null}
        {state === 'error' && !data ? <p className="pd-sv-empty">{error}</p> : null}

        {data ? (
          <div className="pd-cc-body">
            <section className="pd-cc-summary">
              <Row label="Total Cash" value={money(data.totalCash)} />
              <Row label="Credits Received" value={money(data.creditReceiptCash)} />
              <Row label="Credit Received - C. Card Amt" value={money(data.creditReceiptCard)} />
              <Row label="Total Cash IN" value={money(data.cashIn)} />
              <Row label="Total Cash Out" value={money(data.cashOut)} />
              <Row label="Refund Amt" value={money(data.totalRefund)} />
              <Row label="Advance Received" value={money(data.advanceReceived)} />
              <Row label="Credit Amt" value={money(data.totalCredit)} />
              <Row label="Credit Card Amt" value={money(data.totalCard)} />
              <Row label="Net Card Amount (Sale + Tip)" value={money(data.netCardAmount)} />
              <Row label="Online" value={money(data.totalOnline)} />
              <Row label="Voucher Amt" value={money(data.totalVoucher)} />
              <Row label="Compliment" value={money(data.totalCompliment)} />
              <Row label="Total Discount Amount" value={money(data.totalDiscount)} />
              <Row label="Item Discount" value={money(data.itemDiscountTotal)} />
              <Row label="Tax Amount" value={money(data.totalTax)} />
              <Row label="Total Tip" value={money(data.totalTip)} />
              <Row label="Cash Tip" value={money(data.totalCashTip)} />
              <Row label="Card Tip" value={money(data.totalCardTip)} />
              <Row label="Online Tip" value={money(data.totalOnlineTip)} />
              <Row label="Cash To Be Collected" value={money(toCollect)} strong />
              <Row label="Total Sales" value={money(data.totalSales)} strong />
            </section>

            <section className="pd-cc-cash">
              <div className="pd-cc-denoms">
                {DENOMS.map((d) => (
                  <label key={d.key} className={focusKey === d.key ? 'is-focus' : undefined}>
                    <span>{d.label}</span>
                    <input
                      inputMode="numeric"
                      value={counts[d.key]}
                      onFocus={() => setFocusKey(d.key)}
                      onChange={(e) => setCount(d.key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="pd-cc-pad">
                {KEYS.map((k) => (
                  <button key={k} type="button" onClick={() => numPad(k)}>
                    {k}
                  </button>
                ))}
              </div>
              <label className="pd-cc-collected">
                <span>Collected Amount</span>
                <input
                  inputMode="decimal"
                  value={collectedOverride ?? (denomTotal ? money(denomTotal) : '')}
                  onChange={(e) => setCollectedOverride(e.target.value)}
                />
              </label>
              <div className={`pd-cc-diff${difference < 0 ? ' is-short' : ''}`}>
                <span>Cash Difference</span>
                <b>{money(difference)}</b>
              </div>
              <label className="pd-cc-remarks">
                <span>Remarks :</span>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </label>
            </section>
          </div>
        ) : null}

        {detailsOpen && staffSales.length ? (
          <div className="pd-cc-staff">
            {staffSales.map((s) => (
              <p key={`${s.staffId}-${s.staffName}`}>
                {s.staffName} — {s.billCount} bills — {money(s.saleAmount)}
              </p>
            ))}
          </div>
        ) : null}

        {error && data ? <p className="pd-cc-err">{error}</p> : null}
        {info ? <p className="pd-cc-ok">{info}</p> : null}

        <footer className="pd-cc-foot">
          <div className="pd-cc-counts">
            <span>Bill : {n(data?.billCount)}</span>
            <span>Cash Bill : {n(data?.cashBillCount)}</span>
            <span>Credit Bill : {n(data?.creditBillCount)}</span>
            <span>Card Bill : {n(data?.cardBillCount)}</span>
            <span>Multi Payment Bill : {n(data?.multiBillCount)}</span>
            <span>Compliment Bill : {n(data?.complimentBillCount)}</span>
            <span>No Of Customers : {n(data?.noOfCustomers)}</span>
            {n(data?.pendingKotCount) > 0 ? (
              <span className="pd-cc-warn">{n(data?.pendingKotCount)} KOT pending</span>
            ) : null}
          </div>
          <div className="pd-cc-actions">
            <button type="button" className="pd-cc-x" disabled={busy || !data} onClick={() => void runReport('X')}>
              X-Report
            </button>
            <button
              type="button"
              className="pd-cc-z"
              disabled={busy || !data || Boolean(closedNo)}
              onClick={() => void runReport('Z')}
            >
              Z- Report
            </button>
            <button type="button" className="pd-cc-x" onClick={() => setDetailsOpen((o) => !o)}>
              Details
            </button>
            <button type="button" className="pd-settle-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
