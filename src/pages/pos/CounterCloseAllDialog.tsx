/**
 * Counter Close.
 * mode cashier = RptCounterCloseDetails (this cashier).
 * mode admin   = RptCounterCloseDetailsPending (whole station).
 * X = print only. Z = collected amount, then close and print.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calculator,
  CheckCircle2,
  Coins,
  Lock,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { NumberPad } from '../../components/common/NumberPad'
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


/** focusKey value while the Counted cash box is the active field. */
const COLLECTED = 'collected'

type Props = {
  mode?: 'cashier' | 'admin'
  onClose: () => void
  /** Shows the app toast — used for every success / error message here. */
  notify: (message: string, kind?: 'success' | 'error' | 'info') => void
}
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

export default function CounterCloseAllDialog({ mode = 'admin', onClose, notify }: Props) {
  const allStaff = mode === 'admin'
  const session = getPosSession()
  const counterLabel = getEnrollment()?.stationName || String(session.counterNo || session.stationId || '')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Summary | null>(null)
  const [counts, setCounts] = useState(emptyCounts)
  const [focusKey, setFocusKey] = useState<string>('1000')
  const [collectedOverride, setCollectedOverride] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState<'X' | 'Z' | null>(null)
  const [closedNo, setClosedNo] = useState<string | null>(null)
  const [confirmZ, setConfirmZ] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const collectedRef = useRef<HTMLInputElement | null>(null)

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
      const row = await apiService.fetchCounterSummary({ allStaff })
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
  }, [allStaff])

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
    if (k === 'next') {
      if (focusKey === COLLECTED) focusDenom(DENOMS[0].key)
      else nextDenom()
      return
    }
    // Counted cash box: a money amount, so the decimal point works here.
    if (focusKey === COLLECTED) {
      const cur = collectedOverride ?? ''
      if (k === 'C') setCollectedOverride(cur.slice(0, -1))
      else if (!(k === '.' && cur.includes('.'))) setCollectedOverride((cur + k).slice(0, 12))
      return
    }
    if (k === 'C') {
      setCount(focusKey, '')
      return
    }
    // Note counts are whole numbers — "." jumps to Counted cash to type an amount instead.
    if (k === '.') {
      setFocusKey(COLLECTED)
      collectedRef.current?.focus()
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
    if (closedNo) {
      notify('This counter is already closed.')
      return
    }
    if (collectedOverride == null && !DENOMS.some((d) => String(counts[d.key] ?? '').trim() !== '')) {
      notify('Enter the collected amount first')
      focusDenom(focusKey)
      return
    }
    setConfirmZ(true)
  }

  async function runReport(reportType: 'X' | 'Z') {
    setConfirmZ(false)
    setBusy(reportType)
    try {
      const res = await apiService.closeCounter({
        reportType,
        collectedCash: collected,
        allStaff,
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
        notify(`Counter closed. Z-Report ${closeNo} sent to the printer.`, 'success')
      } else {
        notify('X-Report sent to the printer.', 'success')
      }
      try {
        await printCounterReport(merged, {
          reportType,
          closeNo: String(res.closeNo ?? ''),
          counterNo: (merged.counterNo as number | string | undefined) ?? session.counterNo,
          reportAt: new Date(),
        })
      } catch (printErr) {
        notify(errMessage(printErr, `${reportType}-Report print failed`))
      }
    } catch (err) {
      notify(errMessage(err, reportType === 'Z' ? 'Could not close counter' : 'Could not load X-Report'))
    } finally {
      setBusy(null)
    }
  }

  const staffSales = Array.isArray(data?.staffSales) ? (data?.staffSales as StaffRow[]) : []
  const pendingKots = n(data?.pendingKotCount)
  const hasCount = collectedOverride != null || DENOMS.some((d) => String(counts[d.key] ?? '').trim() !== '')
  const diffState = !hasCount ? 'idle' : Math.abs(difference) < 0.005 ? 'even' : difference < 0 ? 'short' : 'over'
  const diffLabel = { idle: 'Not counted yet', even: 'Balanced', short: 'Short', over: 'Excess' }[diffState]
  const notesCounted = DENOMS.filter((d) => Number(counts[d.key]) > 0).length

  /** Admin-only summary (left panel): headline figures + grouped tiles. */
  const adminGroups: { title: string; tone: string; rows: [string, unknown][] }[] = data
    ? [
        {
          title: 'Cash flow',
          tone: 'cash',
          rows: [
            ['Credits Received', data.creditReceiptCash],
            ['Advance Received', data.advanceReceived],
            ['Cash In', data.cashIn],
            ['Cash Out', data.cashOut],
            ['Refund', data.totalRefund],
          ],
        },
        {
          title: 'Card & tenders',
          tone: 'card',
          rows: [
            ['Credit Amt', data.totalCredit],
            ['Card Amt', data.totalCard],
            ['Online Sale', data.totalOnline],
            ['Compliment', data.totalCompliment],
            ['Credit Recd - Card', data.creditReceiptCard],
          ],
        },
        {
          title: 'Tips, discount & tax',
          tone: 'tip',
          rows: [
            ['Total Tip', data.totalTip],
            ['Online Tip', data.totalOnlineTip],
            ['Total Discount', data.totalDiscount],
            ['Item Discount', data.itemDiscountTotal],
          ],
        },
      ]
    : []

  /** The figures the old screen made stand out — shown as cards on top. */
  const adminKey: { label: string; value: string; main?: boolean }[] = data
    ? [
        { label: 'Total Sales', value: money(data.totalSales), main: true },
        { label: 'Cash To Be Collected', value: money(data.cashToBeCollected), main: true },
        { label: 'Total Cash', value: money(data.totalCash) },
        { label: 'Net Card (Sale + Tip)', value: money(data.netCardAmount) },
        { label: 'Tax Amount', value: money(data.totalTax) },
        { label: 'Bill Count', value: String(n(data.billCount)) },
      ]
    : []

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
        if (e.key !== 'Escape' || busy || confirmZ) return
        onClose()
      }}
    >
      <div className={`pd-cc is-simple ccv${allStaff ? ' is-admin' : ''}`} role="dialog" aria-modal="true" aria-labelledby="pd-cc-title">
        <header className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Calculator size={16} />
            </div>
            <div>
              <p className="pd-mod-kicker">
                Counter {String(data?.counterNo ?? counterLabel) || '—'} · Cashier:{' '}
                {String(data?.cashierName ?? session.staffName ?? '—')}
                {allStaff ? ' · All cashiers' : ''}
              </p>
              <h2 id="pd-cc-title" className="pd-mod-item-name">
                {allStaff ? 'Counter Close — All Cashiers' : 'Counter Close'}
              </h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close" disabled={Boolean(busy)}>
            <X size={14} />
          </button>
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
            {pendingKots > 0 ? (
              <div className="pd-cc-banner">
                <AlertTriangle size={16} />
                <span>
                  <b>
                    {pendingKots} KOT{pendingKots === 1 ? '' : 's'} still pending.
                  </b>{' '}
                  Settle or cancel them before closing.
                </span>
              </div>
            ) : null}

            <div className="ccv-main">
              {/* Admin only: the full reading. Zero figures are left out. */}
              {allStaff ? (
                <aside className="ccv-card ccv-admin" aria-label="Admin summary">
                  <div className="ccv-key">
                    {adminKey.map((k) => (
                      <div key={k.label} className={k.main ? 'ccv-key-item is-main' : 'ccv-key-item'}>
                        <span>{k.label}</span>
                        <b>{k.value}</b>
                      </div>
                    ))}
                  </div>
                  {adminGroups.map((g) => {
                    const rows = g.rows.filter(([, v]) => n(v) !== 0)
                    if (!rows.length) return null
                    return (
                      <div key={g.title}>
                        <p className="ccv-admin-title">{g.title}</p>
                        {rows.map(([label, value]) => (
                          <div key={label} className="ccv-admin-row">
                            <span>{label}</span>
                            <b>{money(value)}</b>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  <div>
                    <p className="ccv-admin-title">
                      Bills {n(data.billCount)} · Customers {n(data.noOfCustomers)}
                    </p>
                    {billCounts
                      .filter(([, v]) => n(v) !== 0)
                      .map(([label, value]) => (
                        <div key={label} className="ccv-admin-row">
                          <span>{label}</span>
                          <b>{n(value)}</b>
                        </div>
                      ))}
                  </div>
                  {staffSales.length > 1 ? (
                    <div>
                      <p className="ccv-admin-title">By cashier</p>
                      {staffSales.map((st) => (
                        <div key={`${st.staffId}-${st.staffName}`} className="ccv-admin-row">
                          <span>
                            {st.staffName} · {st.billCount} bills
                          </span>
                          <b>{money(st.saleAmount)}</b>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </aside>
              ) : null}

              {/* Left: note tiles + keypad */}
              <section className="ccv-left" aria-label="Count cash">
                <div className="ccv-card">
                  <div className="ccv-head">
                    <h3>Count Cash</h3>
                    <span className={`cc2-total${denomTotal ? ' is-on' : ''}`}>
                      Total <b>{money(denomTotal)}</b>
                    </span>
                    {notesCounted > 0 && !closedNo ? (
                      <button type="button" className="ccv-clear" onClick={clearCount}>
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {/* 3 × 3 boxes for 1000…1, then a slim row for the three small coins. */}
                  <div className="cc5">
                    <div className="cc5-grid">
                      {DENOMS.filter((d) => d.value >= 1).map((d) => {
                        const cnt = Number(counts[d.key]) || 0
                        return (
                          <label
                            key={d.key}
                            className={`cc5-box${focusKey === d.key ? ' is-focus' : ''}${cnt ? ' is-filled' : ''}`}
                          >
                            <span className="cc5-den">
                              {d.value >= 5 ? <Banknote size={14} /> : <Coins size={13} />}
                              <b>{d.label}</b>
                              <i aria-hidden="true">×</i>
                            </span>
                            <input
                              ref={(el) => {
                                inputRefs.current[d.key] = el
                              }}
                              inputMode="none"
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
                            <span className="cc5-amt">{cnt ? money(cnt * d.value) : '\u00a0'}</span>
                          </label>
                        )
                      })}
                    </div>
                    <div className="cc5-grid is-coins">
                      {DENOMS.filter((d) => d.value < 1).map((d) => {
                        const cnt = Number(counts[d.key]) || 0
                        return (
                          <label
                            key={d.key}
                            className={`cc5-box${focusKey === d.key ? ' is-focus' : ''}${cnt ? ' is-filled' : ''}`}
                          >
                            <span className="cc5-den">
                              {d.value >= 5 ? <Banknote size={14} /> : <Coins size={13} />}
                              <b>{d.label}</b>
                              <i aria-hidden="true">×</i>
                            </span>
                            <input
                              ref={(el) => {
                                inputRefs.current[d.key] = el
                              }}
                              inputMode="none"
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
                            <span className="cc5-amt">{cnt ? money(cnt * d.value) : '\u00a0'}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <NumberPad className="ccv-pad" disabled={Boolean(closedNo)} onKey={numPad} />
                <button
                  type="button"
                  className="pd-key ccv-next"
                  disabled={Boolean(closedNo)}
                  // Keep the cursor in the box while tapping.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => numPad('next')}
                >
                  Next <ArrowRight size={15} />
                </button>
              </section>

              {/* Right: result + actions */}
              <section className="ccv-right" aria-label="Result">
                <div className="ccv-card ccv-result">
                  <div className="ccv-line">
                    <span>Total sales</span>
                    <b>{money(data.totalSales)}</b>
                  </div>
                  <div className="ccv-line">
                    <span>Expected cash</span>
                    <b>{money(toCollect)}</b>
                  </div>
                  <label className="ccv-box">
                    <span>
                      <small>Counted cash</small>
                      <input
                        ref={collectedRef}
                        inputMode="none"
                        placeholder="0.00"
                        onFocus={() => setFocusKey(COLLECTED)}
                        value={collectedOverride ?? (denomTotal ? money(denomTotal) : '')}
                        disabled={Boolean(closedNo)}
                        onChange={(e) => setCollectedOverride(e.target.value)}
                      />
                    </span>
                  </label>
                  <div className={`ccv-box ccv-diff is-${diffState}`}>
                    <span>
                      <small>Difference</small>
                      <b>{hasCount ? money(difference) : '—'}</b>
                      <em>{diffLabel}</em>
                    </span>
                  </div>
                  <label className="ccv-remarks">
                    <span>Remarks</span>
                    <textarea
                      placeholder={diffState === 'short' || diffState === 'over' ? 'Reason for the difference' : 'Optional'}
                      disabled={Boolean(closedNo)}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </label>
                </div>

                {/* Same action tiles as the home screen (.pd-tile). */}
                <div className="ccv-actions">
                  <button
                    type="button"
                    className="pd-tile"
                    title="Prints the current reading. Does not close the counter."
                    disabled={Boolean(busy) || !data}
                    onClick={() => void runReport('X')}
                  >
                    {busy === 'X' ? (
                      <RefreshCw className="pd-tile-ic pd-cc-spin" strokeWidth={2} />
                    ) : (
                      <Printer className="pd-tile-ic" strokeWidth={2} />
                    )}
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">{busy === 'X' ? 'Printing…' : 'X-Report'}</span>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                  {closedNo ? (
                    <button type="button" className="pd-tile is-primary" onClick={onClose}>
                      <CheckCircle2 className="pd-tile-ic" strokeWidth={2} />
                      <span className="pd-tile-text">
                        <span className="pd-tile-label">Done</span>
                      </span>
                      <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                    </button>
                  ) : (
                    <button type="button" className="pd-tile is-primary" disabled={Boolean(busy) || !data} onClick={askZ}>
                      {busy === 'Z' ? (
                        <RefreshCw className="pd-tile-ic pd-cc-spin" strokeWidth={2} />
                      ) : (
                        <Lock className="pd-tile-ic" strokeWidth={2} />
                      )}
                      <span className="pd-tile-text">
                        <span className="pd-tile-label">{busy === 'Z' ? 'Closing…' : 'Close Counter'}</span>
                      </span>
                      <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </section>
            </div>

          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmZ}
        tone={diffState === 'short' || diffState === 'over' || pendingKots > 0 ? 'danger' : 'info'}
        title="Close the counter?"
        message={
          <>
            Expected {money(toCollect)} · Counted {money(collected)} · Difference {money(difference)} ({diffLabel}).
            {pendingKots > 0 ? ` ${pendingKots} KOT${pendingKots === 1 ? ' is' : 's are'} still pending.` : ''} This
            prints the Z-Report and can't be undone.
          </>
        }
        confirmLabel="Close Counter"
        onConfirm={() => void runReport('Z')}
        onCancel={() => setConfirmZ(false)}
      />
    </div>
  )
}
