/**
 * SettlementScreen — same engine as MoifHMS SettlementScreen.vb / Cash() / SaveSalesDetails.
 * CREDIT is UI-only until the next phase.
 *
 * Layout: total due on top; payment methods with a Paid amount box beside
 * Credit; the breakdown and an "Add tip" section (expands when tapped) on the
 * left; the shared number keypad on the right. The keypad types into whichever
 * box is active — Paid amount or Tip.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, CreditCard, Globe, HandCoins, Plus, Receipt, Wallet, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { NumberPad } from '../../components/common/NumberPad'
import { getPosSession } from '../../utils/posSession'
import './SettlementScreen.css'

const TENDERS = ['CASH', 'CARD', 'ONLINE'] as const
const TIP_QUICK = [5, 10, 20]

export type SettleTender = (typeof TENDERS)[number]
export type SettleMethod = SettleTender | 'CREDIT'

const METHODS: { id: SettleMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'CARD', label: 'Card', icon: CreditCard },
  { id: 'ONLINE', label: 'Online', icon: Globe },
  { id: 'CREDIT', label: 'Credit', icon: Wallet },
]

export type SettlementBill = {
  kotId: number
  kotLabel: string
  net: number
  subtotal: number
  discount: number
  tax: number
  taxable: number
  customerId: number
  waiterId: number
  tableId: number
  areaId: number
  covers: number
  remarks: string
  items: Record<string, unknown>[]
  prefillPaid: number
}

export type SettlementDone = {
  billNo: string
  salesId: string
  net: number
  paid: number
  change: number
  paymentMode: string
  cash: number
  card: number
  online: number
}

type Props = {
  /** Quick Cash: a small cash-only modal — Bill amount, Paid amount, Balance. */
  quick?: boolean
  bill: SettlementBill
  onClose: () => void
  onCompleted: (info: SettlementDone) => void
  onAlreadySettled: () => void
}

type Alloc = Record<SettleTender, number>

function money(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function parseAmt(raw: string) {
  if (!raw.trim()) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? round2(n) : 0
}

function emptyAlloc(): Alloc {
  return { CASH: 0, CARD: 0, ONLINE: 0 }
}

/** Appends a keypad key to a money string (max 2 decimals). */
function typeKey(prev: string, k: string) {
  if (k === '.' && prev.includes('.')) return prev
  if (prev === '0' && k !== '.') return k
  const next = prev + k
  const bits = next.split('.')
  if (bits[1] && bits[1].length > 2) return prev
  return next
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export default function SettlementScreen({ quick = false, bill, onClose, onCompleted, onAlreadySettled }: Props) {
  const net = round2(bill.net)
  const due = round2(Math.abs(net))
  const isReturn = net < 0 || bill.items.some((it) => Number(it.qty ?? it.Qty) < 0)
  const [selected, setSelected] = useState<SettleMethod>('CASH')
  const [draft, setDraft] = useState(() => (bill.prefillPaid > 0 ? money(bill.prefillPaid) : ''))
  const [alloc, setAlloc] = useState<Alloc>(emptyAlloc)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tipAsk, setTipAsk] = useState<number | null>(null)
  /** "Add tip" section: open/closed, the typed tip, and which box the keypad types into. */
  const [tipOpen, setTipOpen] = useState(false)
  const [tipDraft, setTipDraft] = useState('')
  const [entry, setEntry] = useState<'paid' | 'tip'>('paid')
  const busyRef = useRef(false)

  /** Tip the cashier typed in the Add tip section (0 when it is closed). */
  const tipExtra = tipOpen ? parseAmt(tipDraft) : 0
  /** What has to be covered: the bill plus that tip. */
  const need = round2(due + tipExtra)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (tipAsk != null) {
          setTipAsk(null)
          return
        }
        onClose()
        return
      }
      if (tipAsk != null) return
      if (e.key === 'Enter') {
        e.preventDefault()
        void submitPay()
        return
      }
      if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault()
        onKeyPad(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        if (entry === 'tip') setTipDraft((prev) => prev.slice(0, -1))
        else setDraft((prev) => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // submitPay is recreated; bind latest via refs would be heavier — keep deps tight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, tipAsk, selected, draft, alloc, net, entry, tipOpen, tipDraft])

  const live = useMemo(() => {
    const next = { ...alloc }
    if (selected !== 'CREDIT') next[selected] = parseAmt(draft)
    return next
  }, [alloc, draft, selected])

  const cash = live.CASH
  const card = live.CARD
  const online = live.ONLINE
  const allocated = round2(cash + card + online)
  const methodsUsed = TENDERS.filter((m) => live[m] > 0).length
  const isSplit = methodsUsed > 1
  const change = !isSplit && cash > 0 && card <= 0 && online <= 0 ? round2(Math.max(0, cash - need)) : 0
  const remaining = round2(Math.max(0, need - allocated + (change > 0 ? change : 0)))
  const paidShown = allocated > 0 ? allocated : 0

  function commitDraft(from: SettleMethod, value: string, base = alloc): Alloc {
    if (from === 'CREDIT') return base
    return { ...base, [from]: parseAmt(value) }
  }

  function selectMethod(next: SettleMethod) {
    if (busy) return
    setError(null)
    if (next === 'CREDIT') {
      setError('Credit settlement will be added in the next phase.')
      return
    }
    const committed = commitDraft(selected, draft)
    setAlloc(committed)
    setSelected(next)
    setDraft(committed[next] > 0 ? money(committed[next]) : '')
    setEntry('paid')
  }

  function onKeyPad(k: string) {
    if (busy || tipAsk != null) return
    setError(null)
    if (entry === 'tip') {
      if (k === 'C') setTipDraft('')
      else setTipDraft((prev) => typeKey(prev, k))
      return
    }
    if (selected === 'CREDIT') return
    if (k === 'C') {
      setDraft('')
      return
    }
    setDraft((prev) => typeKey(prev, k))
  }

  function toggleTip() {
    if (busy) return
    setError(null)
    if (tipOpen) {
      // Closing removes the tip.
      setTipOpen(false)
      setTipDraft('')
      setEntry('paid')
    } else {
      setTipOpen(true)
      setEntry('tip')
    }
  }

  function buildPayload(parts: { payMode: SettleTender; amount: number }[], paid: number, tip: number) {
    const session = getPosSession()
    const paymentMode =
      parts.length > 1
        ? 'SPLITPAY'
        : parts[0]?.payMode === 'CARD'
          ? 'CREDITCARD'
          : parts[0]?.payMode === 'ONLINE'
            ? 'ONLINE'
            : 'CASH'
    return {
      kotId: bill.kotId,
      kotMasterId: bill.kotId,
      stationId: session.stationId,
      StationID: session.stationId,
      customerId: bill.customerId > 0 ? bill.customerId : null,
      waiterId: bill.waiterId > 0 ? bill.waiterId : session.staffId,
      tableId: bill.tableId > 0 ? bill.tableId : null,
      areaId: bill.areaId > 0 ? bill.areaId : null,
      noOfCustomer: bill.covers,
      noOfCustomers: bill.covers,
      subTotal: bill.subtotal,
      subTotalM: bill.subtotal,
      discountAmount: bill.discount,
      taxableAmount: bill.taxable,
      tax1Amount: bill.tax,
      tax1AmountM: bill.tax,
      tax2AmountM: 0,
      tax3AmountM: 0,
      tax1RateM: 0,
      tax2RateM: 0,
      tax3RateM: 0,
      roundOffAdj: 0,
      netAmount: net,
      paidAmount: paid,
      isReturn,
      paymentMode,
      PaymentMode: paymentMode,
      tipAmount: tip,
      counterNo: session.counterNo,
      remarks: bill.remarks,
      comments: bill.remarks,
      items: bill.items,
      Items: bill.items,
      splits: parts.map((p) => ({
        payMode: p.payMode,
        amount: p.amount,
      })),
    }
  }

  function collectParts(source: Alloc, fillSelected: boolean) {
    const next = { ...source }
    if (fillSelected && selected !== 'CREDIT') {
      const sum = round2(next.CASH + next.CARD + next.ONLINE)
      const left = round2(due - sum)
      if (left > 0.009 && next[selected] <= 0) next[selected] = left
    }
    return {
      next,
      parts: TENDERS.filter((m) => next[m] > 0).map((m) => ({ payMode: m, amount: next[m] })),
    }
  }

  async function postSettle(parts: { payMode: SettleTender; amount: number }[], paid: number, tip: number) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await apiService.saveSettlement(buildPayload(parts, paid, tip))
      if (result.ok === false) {
        throw new Error(String(result.message ?? 'Try Again............'))
      }
      const paymentMode =
        parts.length > 1
          ? 'SPLITPAY'
          : parts[0]?.payMode === 'CARD'
            ? 'CREDITCARD'
            : parts[0]?.payMode === 'ONLINE'
              ? 'ONLINE'
              : 'CASH'
      const tender = (mode: SettleTender) => round2(parts.filter((p) => p.payMode === mode).reduce((n, p) => n + p.amount, 0))
      onCompleted({
        billNo: String(result.billNo ?? ''),
        salesId: String(result.salesId ?? ''),
        net,
        paid,
        change: round2(Number(result.balancePaid ?? Math.max(0, paid - due - tip))),
        paymentMode,
        cash: paymentMode === 'CASH' ? paid : tender('CASH'),
        card: tender('CARD'),
        online: tender('ONLINE'),
      })
    } catch (err) {
      const msg = errMessage(err, 'Try Again............')
      setError(msg)
      if (err instanceof ApiError && err.status === 409) {
        onAlreadySettled()
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function submitPay(tipConfirmed?: number) {
    if (busyRef.current || busy) return
    if (selected === 'CREDIT') {
      setError('Credit settlement will be added in the next phase.')
      return
    }
    if (due === 0) {
      setError('Enter Atleast One Item details...........')
      return
    }

    const committed = commitDraft(selected, draft)
    setAlloc(committed)
    // Nothing typed in Paid amount → the chosen method pays the exact amount.
    const typedSum = round2(committed.CASH + committed.CARD + committed.ONLINE)
    const { next, parts: filled } = collectParts(committed, true)
    let parts = filled
    if (!parts.length) {
      parts = [{ payMode: selected, amount: due }]
    }

    const sum = round2(parts.reduce((n, p) => n + p.amount, 0))
    const split = parts.length > 1
    if (split && Math.abs(sum - due) > 0.02) {
      setError('Split total must match Net Amount...')
      return
    }

    const onlyCash = parts.length === 1 && parts[0].payMode === 'CASH'
    const onlyCard = parts.length === 1 && parts[0].payMode === 'CARD'
    let paid = onlyCash ? parts[0].amount : split ? due : Math.max(sum, 0)
    if (!split && tipExtra > 0) {
      // With a tip: an untyped amount, or a card / online amount typed as just the bill, pays bill + tip.
      if (typedSum <= 0) paid = need
      else if (!onlyCash && paid + 0.02 >= due && paid < need) paid = need
    }
    if (!split && paid + 0.02 < need) {
      setError(tipExtra > 0 ? 'Amount Paid is Less than Net Amount + Tip..........' : 'Amount Paid is Less than Net Amount..........')
      return
    }

    // Card paid above bill (+ typed tip): ask whether the excess is a tip too.
    if (onlyCard && paid > need + 0.02 && tipConfirmed == null) {
      setTipAsk(round2(paid - need))
      setAlloc(next)
      return
    }
    const tip = round2(tipExtra + (onlyCard && tipConfirmed != null && tipConfirmed > 0 ? tipConfirmed : 0))
    const settleParts = split
      ? parts
      : [{ payMode: parts[0].payMode, amount: due }]
    await postSettle(settleParts, split ? round2(due + tipExtra) : paid, tip)
  }

  async function confirmTip(yes: boolean) {
    const excess = tipAsk ?? 0
    setTipAsk(null)
    if (!yes) return
    await submitPay(excess)
  }

  // Quick Cash: cash only (selected stays CASH), no tip section, same pay engine.
  if (quick) {
    const paidTyped = parseAmt(draft)
    const short = paidTyped > 0 && paidTyped + 0.009 < due
    return (
      <div
        className="pd-mod-overlay pd-settle-overlay"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onClose()
        }}
      >
        <div className="stl stl-quick" role="dialog" aria-modal="true" aria-labelledby="pd-quick-title">
          <div className="pd-mod-header">
            <div className="pd-mod-header-left">
              <div className="pd-mod-header-icon">
                <Banknote size={15} strokeWidth={2} />
              </div>
              <div>
                <p className="pd-mod-kicker">Bill {bill.kotLabel}</p>
                <h2 id="pd-quick-title" className="pd-mod-item-name">Quick Cash</h2>
              </div>
            </div>
            <button type="button" className="pd-mod-x" onClick={onClose} disabled={busy} aria-label="Close">
              <X size={13} />
            </button>
          </div>

          <div className="stl-body">
            <div className="stlq-main">
              <div className="stlq-left">
                <div className="stlq-line">
                  <span>Bill amount</span>
                  <b>AED {money(due)}</b>
                </div>
                <div className="stl-paid is-on stlq-paid">
                  <small>Paid amount</small>
                  <b>{draft || '0.00'}</b>
                </div>
                <div className="stlq-quick">
                  <button type="button" disabled={busy} onClick={() => setDraft(money(due))}>
                    Exact
                  </button>
                  {[50, 100, 200, 500].map((q) => (
                    <button key={q} type="button" disabled={busy} onClick={() => setDraft(String(q))}>
                      {q}
                    </button>
                  ))}
                </div>
                <div className={`stlq-line is-balance${short ? ' is-short' : ''}`}>
                  <span>{short ? 'Still to pay' : 'Balance'}</span>
                  <b>AED {money(short ? due - paidTyped : change)}</b>
                </div>
              </div>
              <NumberPad className="stl-pad" onKey={onKeyPad} disabled={busy} />
            </div>
            {error ? <p className="stl-err">{error}</p> : null}
          </div>

          <div className="stl-foot">
            <button type="button" className="pd-mod-foot-btn is-close" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="pd-mod-foot-btn is-ok stl-pay" onClick={() => void submitPay()} disabled={busy}>
              <Banknote size={16} />
              {busy ? 'Paying…' : `${isReturn ? 'Refund' : 'Pay'} AED ${money(due)}`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="pd-mod-overlay pd-settle-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && tipAsk == null) onClose()
      }}
    >
      <div className="stl" role="dialog" aria-modal="true" aria-labelledby="pd-settle-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Receipt size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Bill {bill.kotLabel}</p>
              <h2 id="pd-settle-title" className="pd-mod-item-name">Settlement</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="stl-body">
          {/* Total due */}
          <div className="stl-due">
            <span>{isReturn ? 'Return due' : 'Total due'}</span>
            <strong>AED {money(due)}</strong>
            {tipExtra > 0 ? <em>+ tip {money(tipExtra)} = AED {money(need)}</em> : null}
          </div>

          {/* Payment methods · Paid amount (next to Credit) */}
          <div className="stl-methods">
            {METHODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`stl-method${selected === id ? ' is-on' : ''}`}
                onClick={() => selectMethod(id)}
                disabled={busy}
              >
                <Icon size={16} strokeWidth={2} />
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`stl-paid${entry === 'paid' ? ' is-on' : ''}`}
              onClick={() => setEntry('paid')}
              disabled={busy}
            >
              <small>Paid amount{selected !== 'CREDIT' ? ` · ${selected.toLowerCase()}` : ''}</small>
              <b>{draft || '0.00'}</b>
            </button>
          </div>

          <div className="stl-main">
            {/* Left: breakdown + tip */}
            <div className="stl-left">
              <div className="stl-rows">
                <div>
                  <span>Cash</span>
                  <b>{money(cash)}</b>
                </div>
                <div>
                  <span>Card</span>
                  <b>{money(card)}</b>
                </div>
                <div>
                  <span>Online</span>
                  <b>{money(online)}</b>
                </div>
                <div className="is-sum">
                  <span>Paid</span>
                  <b>{money(paidShown)}</b>
                </div>
                <div className={remaining > 0.009 ? 'is-due' : undefined}>
                  <span>{change > 0.009 ? 'Change' : 'Balance'}</span>
                  <b>{money(change > 0.009 ? change : remaining)}</b>
                </div>
              </div>

              {/* Add tip — tap to open the tip section */}
              <div className={`stl-tip${tipOpen ? ' is-open' : ''}`}>
                <button type="button" className="stl-tip-toggle" onClick={toggleTip} disabled={busy} aria-expanded={tipOpen}>
                  <HandCoins size={15} />
                  {tipOpen ? 'Remove tip' : 'Add tip'}
                  {tipOpen ? <X size={13} /> : <Plus size={13} />}
                </button>
                {tipOpen ? (
                  <div className="stl-tip-body">
                    <button
                      type="button"
                      className={`stl-tip-box${entry === 'tip' ? ' is-on' : ''}`}
                      onClick={() => setEntry('tip')}
                      disabled={busy}
                    >
                      <small>Tip amount</small>
                      <b>{tipDraft || '0.00'}</b>
                    </button>
                    <div className="stl-tip-quick">
                      {TIP_QUICK.map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setTipDraft(String(q))
                            setEntry('tip')
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right: shared keypad — types into the highlighted box */}
            <NumberPad className="stl-pad" onKey={onKeyPad} disabled={busy} />
          </div>

          {error ? <p className="stl-err">{error}</p> : null}
        </div>

        <div className="stl-foot">
          <button type="button" className="pd-mod-foot-btn is-close" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="pd-mod-foot-btn is-ok stl-pay" onClick={() => void submitPay()} disabled={busy}>
            <CreditCard size={16} />
            {busy ? 'Paying…' : `${isReturn ? 'Refund' : 'Pay'} AED ${money(need)}`}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={tipAsk != null}
        title="Add the extra to the tip?"
        message={`The card amount is AED ${money(tipAsk ?? 0)} more than the bill${tipExtra > 0 ? ' and tip' : ''}. Add it as a tip?`}
        confirmLabel="Add to tip"
        onConfirm={() => void confirmTip(true)}
        onCancel={() => void confirmTip(false)}
      />
    </div>
  )
}
