/**
 * SettlementScreen — same engine as MoifHMS SettlementScreen.vb / Cash() / SaveSalesDetails.
 * CREDIT is UI-only until the next phase.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { CreditCard, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { getPosSession } from '../../utils/posSession'

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const
const TENDERS = ['CASH', 'CARD', 'ONLINE'] as const

export type SettleTender = (typeof TENDERS)[number]
export type SettleMethod = SettleTender | 'CREDIT'

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
}

type Props = {
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

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export default function SettlementScreen({ bill, onClose, onCompleted, onAlreadySettled }: Props) {
  const net = round2(bill.net)
  const due = round2(Math.abs(net))
  const isReturn = net < 0 || bill.items.some((it) => Number(it.qty ?? it.Qty) < 0)
  const [selected, setSelected] = useState<SettleMethod>('CASH')
  const [draft, setDraft] = useState(() => (bill.prefillPaid > 0 ? money(bill.prefillPaid) : ''))
  const [alloc, setAlloc] = useState<Alloc>(emptyAlloc)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tipAsk, setTipAsk] = useState<number | null>(null)
  const busyRef = useRef(false)

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
        setDraft((prev) => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // submitPay is recreated; bind latest via refs would be heavier — keep deps tight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, tipAsk, selected, draft, alloc, net])

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
  const change = !isSplit && cash > 0 && card <= 0 && online <= 0 ? round2(Math.max(0, cash - due)) : 0
  const remaining = round2(Math.max(0, due - allocated + (change > 0 ? change : 0)))
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
  }

  function onKeyPad(k: string) {
    if (busy || selected === 'CREDIT' || tipAsk != null) return
    setError(null)
    if (k === 'C') {
      setDraft('')
      return
    }
    setDraft((prev) => {
      if (k === '.' && prev.includes('.')) return prev
      if (prev === '0' && k !== '.') return k
      const next = prev + k
      const bits = next.split('.')
      if (bits[1] && bits[1].length > 2) return prev
      return next
    })
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
      onCompleted({
        billNo: String(result.billNo ?? ''),
        salesId: String(result.salesId ?? ''),
        net,
        paid,
        change: round2(Number(result.balancePaid ?? Math.max(0, paid - due - tip))),
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
    const paid = onlyCash ? parts[0].amount : split ? due : Math.max(sum, 0)
    if (!split && paid + 0.02 < due) {
      setError('Amount Paid is Less than Net Amount..........')
      return
    }

    if (onlyCard && paid + 0.02 > due && tipConfirmed == null) {
      setTipAsk(round2(paid - due))
      setAlloc(next)
      return
    }
    const tip = onlyCard && tipConfirmed != null && tipConfirmed > 0 ? tipConfirmed : 0
    const settleParts = split
      ? parts
      : [{ payMode: parts[0].payMode, amount: due }]
    await postSettle(settleParts, split ? due : paid, tip)
  }

  async function confirmTip(yes: boolean) {
    const excess = tipAsk ?? 0
    setTipAsk(null)
    if (!yes) return
    await submitPay(excess)
  }

  return (
    <div
      className="pd-mod-overlay pd-settle-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && tipAsk == null) onClose()
      }}
    >
      <div className="pd-settle" role="dialog" aria-modal="true" aria-labelledby="pd-settle-title">
        <header className="pd-settle-head">
          <div>
            <p className="pd-mod-kicker">Settlement</p>
            <h2 id="pd-settle-title">SETTLEMENT</h2>
          </div>
          <div className="pd-settle-billno">Bill {bill.kotLabel}</div>
          <button type="button" className="pd-mod-x" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={13} />
          </button>
        </header>

        <div className="pd-settle-due">
          <span>{isReturn ? 'RETURN DUE' : 'TOTAL DUE'}</span>
          <strong>AED {money(due)}</strong>
        </div>

        <div className="pd-settle-methods">
          <p>PAYMENT METHOD</p>
          <div className="pd-settle-method-row">
            {TENDERS.map((m) => (
              <button
                key={m}
                type="button"
                className={`pd-settle-method${selected === m ? ' is-on' : ''}`}
                onClick={() => selectMethod(m)}
                disabled={busy}
              >
                {m === 'CARD' ? 'CARD' : m}
              </button>
            ))}
            <button
              type="button"
              className="pd-settle-method"
              onClick={() => selectMethod('CREDIT')}
              disabled={busy}
            >
              CREDIT
            </button>
          </div>
        </div>

        <div className="pd-settle-body">
          <div className="pd-settle-details">
            <div className="pd-settle-row">
              <span>Cash</span>
              <strong>{money(cash)}</strong>
            </div>
            <div className="pd-settle-row">
              <span>Card</span>
              <strong>{money(card)}</strong>
            </div>
            <div className="pd-settle-row">
              <span>Online</span>
              <strong>{money(online)}</strong>
            </div>
            <div className="pd-settle-row is-sum">
              <span>Paid</span>
              <strong>{money(paidShown)}</strong>
            </div>
            <div className={`pd-settle-row${remaining > 0.009 ? ' is-due' : ''}`}>
              <span>{change > 0.009 ? 'Change' : 'Balance'}</span>
              <strong>{money(change > 0.009 ? change : remaining)}</strong>
            </div>
            <div className="pd-settle-draft">
              {selected === 'CREDIT' ? 'CREDIT' : `${selected} entry`} · {draft || '0'}
            </div>
          </div>
          <div className="pd-settle-keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="pd-key" onClick={() => onKeyPad(k)} disabled={busy}>
                {k}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="pd-settle-err">{error}</p> : null}

        <footer className="pd-settle-foot">
          <button type="button" className="pd-settle-cancel" onClick={onClose} disabled={busy}>
            CANCEL
          </button>
          <button
            type="button"
            className="pd-pay pd-settle-pay"
            onClick={() => void submitPay()}
            disabled={busy}
          >
            <CreditCard size={16} />
            {busy ? 'PAYING…' : `${isReturn ? 'REFUND' : 'PAY'} AED ${money(due)}`}
          </button>
        </footer>
      </div>

      {tipAsk != null ? (
        <div className="pd-settle-tip" role="dialog" aria-modal="true">
          <div className="pd-ol-dialog pd-ol-narrow">
            <div className="pd-mod-header">
              <div>
                <p className="pd-mod-kicker">Card</p>
                <h2 className="pd-mod-item-name">CONFIRM TIP</h2>
              </div>
            </div>
            <div className="pd-ol-body">
              <p className="pd-confirm-msg">
                PAID AMOUNT IS MORE THAN NET AMOUNT.
                <br />
                EXCESS: AED {money(tipAsk)}
                <br />
                <br />
                YES = ADD EXCESS TO TIP
                <br />
                NO = CANCEL
              </p>
              <div className="pd-admin-foot">
                <button type="button" className="pd-mod-foot-btn is-close" onClick={() => void confirmTip(false)}>
                  NO
                </button>
                <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void confirmTip(true)}>
                  YES
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
