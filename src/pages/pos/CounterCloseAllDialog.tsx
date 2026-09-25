/**
 * RptCounterCloseDetailsPending — Counter Close ALL.
 * X-Report = live snapshot. Z-Report = PrintSalesReportSummary (requires collected amount).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Eraser,
  FileText,
  Lock,
  Printer,
  Receipt,
  RefreshCw,
  Users,
  X,
} from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { printCounterReport } from '../../lib/printCounterReport'
import { getEnrollment } from '../../utils/deviceEnrollment'
import { getPosSession } from '../../utils/posSession'
import './CounterCloseAllDialog.css'

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

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', 'next'] as const

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
  const [busy, setBusy] = useState<'X' | 'Z' | null>(null)
  const [closedNo, setClosedNo] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showZeros, setShowZeros] = useState(false)
  const [confirmZ, setConfirmZ] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

  // Put the cursor on the first note as soon as the reading loads, so the
  // cashier can start typing counts straight away.
  useEffect(() => {
    if (state === 'ready') inputRefs.current[DENOMS[0].key]?.focus()
  }, [state])

  function setCount(key: string, raw: string) {
    if (raw && !/^\d*$/.test(raw)) return
    setCounts((prev) => ({ ...prev, [key]: raw }))
    setCollectedOverride(null)
  }

  function focusDenom(key: string) {
    setFocusKey(key)
    inputRefs.current[key]?.focus()
    inputRefs.current[key]?.select()
  }

  function nextDenom() {
    const i = DENOMS.findIndex((d) => d.key === focusKey)
    const next = DENOMS[(i + 1) % DENOMS.length]
    focusDenom(next.key)
  }

  function numPad(k: string) {
    if (k === 'C') {
      setCount(focusKey, '')
      return
    }
    if (k === 'next') {
      nextDenom()
      return
    }
    setCount(focusKey, `${counts[focusKey] ?? ''}${k}`.replace(/^0+(?=\d)/, ''))
  }

  function clearCount() {
    setCounts(emptyCounts())
    setCollectedOverride(null)
    focusDenom(DENOMS[0].key)
  }

  function askZ() {
    setError(null)
    setInfo(null)
    if (closedNo) {
      setError('This counter is already closed.')
      return
    }
    if (collectedOverride == null && !DENOMS.some((d) => String(counts[d.key] ?? '').trim() !== '')) {
      setError('Count the cash (step 2) before closing the counter.')
      focusDenom(focusKey)
      return
    }
    setConfirmZ(true)
  }

  async function runReport(reportType: 'X' | 'Z') {
    setError(null)
    setInfo(null)
    setConfirmZ(false)
    setBusy(reportType)
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
        setInfo(`Counter closed. Z-Report ${closeNo} sent to the printer.`)
      } else {
        setInfo('X-Report sent to the printer.')
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
      setBusy(null)
    }
  }

  const staffSales = Array.isArray(data?.staffSales) ? (data?.staffSales as StaffRow[]) : []
  const pendingKots = n(data?.pendingKotCount)
  const hasCount = collectedOverride != null || DENOMS.some((d) => String(counts[d.key] ?? '').trim() !== '')
  const diffState = !hasCount ? 'idle' : Math.abs(difference) < 0.005 ? 'even' : difference < 0 ? 'short' : 'over'
  const diffLabel = { idle: 'Not counted yet', even: 'Balanced', short: 'Short', over: 'Excess' }[diffState]
  const diffText = {
    idle: 'Count the cash to compare with the expected amount.',
    even: 'Counted cash matches the expected amount.',
    short: `Drawer is short by ${money(Math.abs(difference))}.`,
    over: `Drawer has ${money(difference)} more than expected.`,
  }[diffState]
  const notesCounted = DENOMS.filter((d) => Number(counts[d.key]) > 0).length

  const groups: { title: string; rows: [string, unknown][] }[] = data
    ? [
        {
          title: 'Cash',
          rows: [
            ['Total Cash', data.totalCash],
            ['Credits Received', data.creditReceiptCash],
            ['Credit Received (Card)', data.creditReceiptCard],
            ['Cash In', data.cashIn],
            ['Cash Out', data.cashOut],
            ['Refunds', data.totalRefund],
            ['Advance Received', data.advanceReceived],
          ],
        },
        {
          title: 'Card & Other Tenders',
          rows: [
            ['Credit Sales', data.totalCredit],
            ['Card', data.totalCard],
            ['Net Card (Sale + Tip)', data.netCardAmount],
            ['Online', data.totalOnline],
            ['Voucher', data.totalVoucher],
            ['Compliment', data.totalCompliment],
          ],
        },
        {
          title: 'Discount & Tax',
          rows: [
            ['Total Discount', data.totalDiscount],
            ['Item Discount', data.itemDiscountTotal],
            ['Tax', data.totalTax],
          ],
        },
        {
          title: 'Tips',
          rows: [
            ['Total Tip', data.totalTip],
            ['Cash Tip', data.totalCashTip],
            ['Card Tip', data.totalCardTip],
            ['Online Tip', data.totalOnlineTip],
          ],
        },
      ]
    : []

  const hiddenCount = groups.reduce((sum, g) => sum + g.rows.filter(([, v]) => n(v) === 0).length, 0)

  const billCounts: [string, unknown][] = [
    ['Cash', data?.cashBillCount],
    ['Credit', data?.creditBillCount],
    ['Card', data?.cardBillCount],
    ['Multi Pay', data?.multiBillCount],
    ['Compliment', data?.complimentBillCount],
  ]

  return (
    <div
      className="pd-mod-overlay pd-cc-overlay"
      role="presentation"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || busy) return
        if (confirmZ) setConfirmZ(false)
        else onClose()
      }}
    >
      <div className="pd-cc" role="dialog" aria-modal="true" aria-labelledby="pd-cc-title">
        <header className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Calculator size={16} />
            </div>
            <div>
              <p className="pd-mod-kicker">Reports</p>
              <h2 id="pd-cc-title" className="pd-mod-item-name">
                Counter Close — All Cashiers
              </h2>
            </div>
          </div>
          <div className="pd-cc-head-right">
            <span className="pd-cc-chip">
              Counter <b>{String(data?.counterNo ?? counterLabel) || '—'}</b>
            </span>
            <span className="pd-cc-chip">
              <Users size={13} /> <b>All cashiers</b>
            </span>
            <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close" disabled={Boolean(busy)}>
              <X size={14} />
            </button>
          </div>
        </header>

        {state === 'loading' ? (
          <div className="pd-cc-state">
            <RefreshCw size={22} className="pd-cc-spin" />
            <p>Loading counter reading…</p>
          </div>
        ) : null}

        {state === 'error' && !data ? (
          <div className="pd-cc-state is-error">
            <AlertTriangle size={24} />
            <p>{error}</p>
            <button type="button" className="pd-cc-btn" onClick={() => void load()}>
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        ) : null}

        {data ? (
          <div className="pd-cc-scroll">
            <div className="pd-cc-kpis">
              <div className="pd-cc-kpi is-brand">
                <span>Total Sales</span>
                <b>{money(data.totalSales)}</b>
              </div>
              <div className="pd-cc-kpi">
                <span>Cash to Collect</span>
                <b>{money(toCollect)}</b>
              </div>
              <div className="pd-cc-kpi">
                <span>Bills</span>
                <b>{n(data.billCount)}</b>
              </div>
              <div className="pd-cc-kpi">
                <span>Customers</span>
                <b>{n(data.noOfCustomers)}</b>
              </div>
            </div>

            {pendingKots > 0 ? (
              <div className="pd-cc-banner">
                <AlertTriangle size={16} />
                <span>
                  <b>
                    {pendingKots} KOT{pendingKots === 1 ? '' : 's'} still pending.
                  </b>{' '}
                  Settle or cancel them before closing the counter.
                </span>
              </div>
            ) : null}

            <div className="pd-cc-body">
              <section className="pd-cc-card pd-cc-summary" aria-label="Sales summary">
                <h3 className="pd-cc-card-title">
                  <span className="pd-cc-step">1</span> Review Sales
                  <Receipt size={15} className="pd-cc-title-ic" />
                </h3>
                {groups.map((g) => {
                  const rows = showZeros ? g.rows : g.rows.filter(([, v]) => n(v) !== 0)
                  if (!rows.length) return null
                  return (
                    <div key={g.title} className="pd-cc-group">
                      <p className="pd-cc-group-title">{g.title}</p>
                      {rows.map(([label, value]) => (
                        <div key={label} className={`pd-cc-row${n(value) === 0 ? ' is-zero' : ''}`}>
                          <span>{label}</span>
                          <b>{money(value)}</b>
                        </div>
                      ))}
                    </div>
                  )
                })}
                {hiddenCount > 0 || showZeros ? (
                  <button type="button" className="pd-cc-link" onClick={() => setShowZeros((v) => !v)}>
                    <ChevronDown size={14} className={showZeros ? 'is-up' : undefined} />
                    {showZeros ? 'Hide zero figures' : `Show ${hiddenCount} zero figure${hiddenCount === 1 ? '' : 's'}`}
                  </button>
                ) : null}
                <div className="pd-cc-group">
                  <p className="pd-cc-group-title">Bills by Payment</p>
                  <div className="pd-cc-bills">
                    {billCounts.map(([label, value]) => (
                      <span key={label}>
                        {label} <b>{n(value)}</b>
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="pd-cc-card pd-cc-cash" aria-label="Cash count">
                <h3 className="pd-cc-card-title">
                  <span className="pd-cc-step">2</span> Count Cash
                  <Banknote size={15} className="pd-cc-title-ic" />
                  {notesCounted > 0 ? (
                    <button type="button" className="pd-cc-link pd-cc-clear" onClick={clearCount} disabled={Boolean(closedNo)}>
                      <Eraser size={13} /> Clear count
                    </button>
                  ) : null}
                </h3>
                <p className="pd-cc-help">
                  Enter how many of each note or coin are in the drawer. Press <kbd>Enter</kbd> or <b>Next</b> to move
                  to the next one.
                </p>

                <div className="pd-cc-cash-grid">
                  <div className="pd-cc-denoms">
                    {DENOMS.map((d) => {
                      const cnt = Number(counts[d.key]) || 0
                      return (
                        <label
                          key={d.key}
                          className={`pd-cc-denom${focusKey === d.key ? ' is-focus' : ''}${cnt ? ' is-filled' : ''}`}
                        >
                          <span className="pd-cc-denom-label">{d.label}</span>
                          <span className="pd-cc-denom-x">×</span>
                          <input
                            ref={(el) => {
                              inputRefs.current[d.key] = el
                            }}
                            inputMode="numeric"
                            placeholder="0"
                            aria-label={`Count of ${d.label}`}
                            value={counts[d.key]}
                            disabled={Boolean(closedNo)}
                            onFocus={() => setFocusKey(d.key)}
                            onChange={(e) => setCount(d.key, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                nextDenom()
                              }
                            }}
                          />
                          <span className="pd-cc-denom-amt">{cnt ? money(cnt * d.value) : ''}</span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="pd-cc-pad" aria-label="Keypad">
                    {KEYS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={k === 'next' ? 'is-next' : k === 'C' ? 'is-clear' : undefined}
                        disabled={Boolean(closedNo)}
                        // Keep the cursor in the note box while tapping the keypad.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => numPad(k)}
                      >
                        {k === 'next' ? (
                          <>
                            Next <ArrowRight size={14} />
                          </>
                        ) : (
                          k
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pd-cc-recon">
                  <div className="pd-cc-recon-row">
                    <span>Expected cash</span>
                    <b>{money(toCollect)}</b>
                  </div>
                  <label className="pd-cc-recon-row pd-cc-collected">
                    <span>
                      Counted cash
                      <small>{collectedOverride != null ? 'Entered manually' : 'Adds up from the notes above'}</small>
                    </span>
                    <input
                      inputMode="decimal"
                      placeholder="0.00"
                      value={collectedOverride ?? (denomTotal ? money(denomTotal) : '')}
                      disabled={Boolean(closedNo)}
                      onChange={(e) => setCollectedOverride(e.target.value)}
                    />
                  </label>
                  <div className={`pd-cc-recon-row pd-cc-diff is-${diffState}`}>
                    <span>
                      Difference <em>{diffLabel}</em>
                      <small>{diffText}</small>
                    </span>
                    <b>{hasCount ? money(difference) : '—'}</b>
                  </div>
                </div>

                <label className="pd-cc-remarks">
                  <span>Remarks</span>
                  <input
                    placeholder={
                      diffState === 'short' || diffState === 'over'
                        ? 'Explain the difference (recommended)'
                        : 'Optional note for this close'
                    }
                    disabled={Boolean(closedNo)}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </label>
              </section>
            </div>

            {detailsOpen ? (
              <section className="pd-cc-card pd-cc-staff" aria-label="Sales by cashier">
                <h3 className="pd-cc-card-title">
                  <Users size={15} /> Sales by Cashier
                </h3>
                {staffSales.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Cashier</th>
                        <th>Bills</th>
                        <th>Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffSales.map((s) => (
                        <tr key={`${s.staffId}-${s.staffName}`}>
                          <td>{s.staffName}</td>
                          <td>{s.billCount}</td>
                          <td>{money(s.saleAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="pd-cc-muted">No cashier sales recorded yet.</p>
                )}
              </section>
            ) : null}
          </div>
        ) : null}

        <footer className="pd-cc-foot">
          <div className="pd-cc-msg" aria-live="polite">
            {error && data ? (
              <p className="pd-cc-err">
                <AlertTriangle size={14} /> {error}
              </p>
            ) : info ? (
              <p className="pd-cc-ok">
                <Printer size={14} /> {info}
              </p>
            ) : closedNo ? null : (
              <p className="pd-cc-muted">
                <span className="pd-cc-step is-sm">3</span> Print an X-Report to check, or close the counter with a
                Z-Report.
              </p>
            )}
          </div>
          <div className="pd-cc-actions">
            <button type="button" className="pd-cc-btn" disabled={!data} onClick={() => setDetailsOpen((o) => !o)}>
              <Users size={14} /> {detailsOpen ? 'Hide Cashiers' : 'By Cashier'}
            </button>
            <button
              type="button"
              className="pd-cc-btn"
              title="Prints the current reading. Does not close the counter."
              disabled={Boolean(busy) || !data}
              onClick={() => void runReport('X')}
            >
              {busy === 'X' ? <RefreshCw size={14} className="pd-cc-spin" /> : <FileText size={14} />}
              {busy === 'X' ? 'Printing…' : 'X-Report'}
            </button>
            {closedNo ? (
              <button type="button" className="pd-cc-btn is-primary" onClick={onClose}>
                <CheckCircle2 size={14} /> Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="pd-cc-btn is-primary"
                  disabled={Boolean(busy) || !data}
                  onClick={askZ}
                >
                  {busy === 'Z' ? <RefreshCw size={14} className="pd-cc-spin" /> : <Lock size={14} />}
                  {busy === 'Z' ? 'Closing…' : 'Close Counter'}
                </button>
              </>
            )}
          </div>
        </footer>

        {confirmZ ? (
          <div className="pd-cc-confirm" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setConfirmZ(false)}>
            <div className="pd-cc-confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="pd-cc-confirm-title">
              <span className="pd-cc-confirm-ic">
                <Lock size={22} />
              </span>
              <h3 id="pd-cc-confirm-title">Close the counter?</h3>
              <p>This prints the Z-Report and ends today's session for all cashiers. It cannot be undone.</p>

              <div className="pd-cc-confirm-sum">
                <div>
                  <span>Expected cash</span>
                  <b>{money(toCollect)}</b>
                </div>
                <div>
                  <span>Counted cash</span>
                  <b>{money(collected)}</b>
                </div>
                <div className={`is-${diffState}`}>
                  <span>Difference</span>
                  <b>
                    {money(difference)} <em>{diffLabel}</em>
                  </b>
                </div>
              </div>

              {pendingKots > 0 ? (
                <p className="pd-cc-confirm-warn">
                  <AlertTriangle size={14} /> {pendingKots} KOT{pendingKots === 1 ? ' is' : 's are'} still pending.
                </p>
              ) : null}
              {(diffState === 'short' || diffState === 'over') && !remarks.trim() ? (
                <p className="pd-cc-confirm-warn">
                  <AlertTriangle size={14} /> There's a cash difference and no remark has been added.
                </p>
              ) : null}

              <div className="pd-cc-confirm-actions">
                <button type="button" className="pd-cc-btn" autoFocus onClick={() => setConfirmZ(false)}>
                  Go Back
                </button>
                <button type="button" className="pd-cc-btn is-primary" onClick={() => void runReport('Z')}>
                  <Lock size={14} /> Yes, Close Counter
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
