/**
 * Advance Payment — left: customer + details (code, mobile, address, O/S,
 * advance); right: pay mode, amount, keypad, Save. Amount clears after Save.
 *
 * `kind` sets the labels so the same screen can serve Receipt later.
 * There is no advance-payment endpoint yet, so Save only confirms locally.
 */
import { useEffect, useRef, useState } from 'react'
import { Banknote, User, X } from 'lucide-react'
import { apiService } from '../../api/apiService'
import { SearchSelect, type SearchSelectOption } from '../../components/common/SearchSelect'
import { decimal } from '../../utils/validate'
import './AdvancePaymentDialog.css'

type PayMode = 'CASH' | 'CARD' | 'BANK' | 'CHEQUE' | 'ONLINE'

/** Pay modes shown as chips — add or remove here. */
const PAY_MODES: { id: PayMode; label: string }[] = [
  { id: 'CASH', label: 'Cash' },
  { id: 'CARD', label: 'Card' },
  { id: 'BANK', label: 'Bank' },
  { id: 'CHEQUE', label: 'Cheque' },
  { id: 'ONLINE', label: 'Online' },
]

export type PaymentKind = 'advance' | 'receipt'

type Customer = SearchSelectOption & { mobile: string; custCode: string; address: string }

type Props = {
  kind?: PaymentKind
  onClose: () => void
  onSaved: (p: { customerName: string; mode: PayMode; amount: number }) => void
}

const KIND: Record<PaymentKind, { title: string; kicker: string }> = {
  advance: { title: 'Advance Amount', kicker: 'Credit' },
  receipt: { title: 'Receipt', kicker: 'Credit' },
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'] as const

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function billRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  for (const k of ['bills', 'data', 'rows']) {
    if (Array.isArray(obj[k])) return obj[k] as Record<string, unknown>[]
  }
  return []
}

export default function AdvancePaymentDialog({ kind = 'advance', onClose, onSaved }: Props) {
  const meta = KIND[kind]
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [osBalance, setOsBalance] = useState<number | null>(null)
  /** Advance saved for each customer while this screen is open. */
  const [advanceBy, setAdvanceBy] = useState<Record<string, number>>({})
  const [mode, setMode] = useState<PayMode>('CASH')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)
  const amountRef = useRef<HTMLInputElement | null>(null)

  function loadCustomers() {
    if (loaded.current) return
    loaded.current = true
    setCustomersLoading(true)
    apiService
      .fetchCustomers({ limit: 400 })
      .then((rows) =>
        setCustomers(
          rows
            .map((c) => ({
              id: num(c.customerId ?? c.CustomerID),
              name: String(c.customerName ?? c.CustomerName ?? '').trim(),
              mobile: String(c.mobileNo ?? c.MobileNo ?? c.telephone ?? c.Telephone ?? '').trim(),
              custCode: String(c.customerCode ?? c.CustomerCode ?? '').trim(),
              address: [c.address ?? c.Address, c.city ?? c.City].map((v) => String(v ?? '').trim()).filter(Boolean).join(', '),
              code: String(c.mobileNo ?? c.MobileNo ?? c.customerCode ?? c.CustomerCode ?? '').trim(),
            }))
            .filter((c) => c.id > 0 && c.name),
        ),
      )
      .catch(() => {
        loaded.current = false
      })
      .finally(() => setCustomersLoading(false))
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  // O/S balance for the chosen customer (sum of their open bills).
  useEffect(() => {
    if (!customer) {
      setOsBalance(null)
      return
    }
    let alive = true
    setOsBalance(null)
    apiService
      .fetchCustomerOutstandingBills(String(customer.id))
      .then((res) => {
        if (!alive) return
        setOsBalance(
          billRows(res).reduce((s, b) => s + num(b.billOsBalance ?? b.BillOsBalance ?? b.osBalance ?? b.balance), 0),
        )
      })
      .catch(() => {
        if (alive) setOsBalance(0)
      })
    return () => {
      alive = false
    }
  }, [customer])

  function onKey(k: string) {
    setError(null)
    if (k === '⌫') setAmount((prev) => prev.slice(0, -1))
    else if (!(k === '.' && amount.includes('.'))) setAmount((prev) => (prev + k).slice(0, 10))
    amountRef.current?.focus()
  }

  function save() {
    const n = Number(amount)
    if (!customer) {
      setError('Select a customer')
      return
    }
    if (!(n > 0)) {
      setError('Enter an amount')
      amountRef.current?.focus()
      return
    }
    const id = String(customer.id)
    setAdvanceBy((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + n }))
    onSaved({ customerName: customer.name, mode, amount: n })
    setAmount('')
    setError(null)
    amountRef.current?.focus()
  }

  const advance = customer ? advanceBy[String(customer.id)] ?? 0 : 0

  return (
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-ol-dialog adv3" role="dialog" aria-modal="true" aria-labelledby="pd-adv-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Banknote size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">{meta.kicker}</p>
              <h2 id="pd-adv-title" className="pd-mod-item-name">{meta.title}</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="adv3-body">
          {/* Left: customer + details */}
          <section className="adv3-left" aria-label="Customer">
            <SearchSelect
              id="pd-adv-customer"
              value={customer?.id ?? null}
              valueLabel={customer?.name}
              options={customers}
              loading={customersLoading}
              onOpen={loadCustomers}
              onChange={(o) => {
                setCustomer(customers.find((c) => c.id === o.id) ?? { ...o, mobile: '', custCode: '', address: '' })
                setError(null)
                window.setTimeout(() => amountRef.current?.focus(), 0)
              }}
              placeholder="Select customer"
              searchPlaceholder="Search name or mobile"
              emptyText="No customers"
            />
            {customer ? (
              <div className="adv3-card">
                <strong className="adv3-name">{customer.name}</strong>
                <dl>
                  {customer.custCode ? (
                    <div>
                      <dt>Code</dt>
                      <dd>{customer.custCode}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Mobile</dt>
                    <dd>{customer.mobile || '—'}</dd>
                  </div>
                  {customer.address ? (
                    <div>
                      <dt>Address</dt>
                      <dd>{customer.address}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="adv3-totals">
                  <div>
                    <span>O/S Balance</span>
                    <b>AED {osBalance == null ? '…' : money(osBalance)}</b>
                  </div>
                  <div className="is-adv">
                    <span>Advance</span>
                    <b>AED {money(advance)}</b>
                  </div>
                </div>
              </div>
            ) : (
              <div className="adv3-card is-empty">
                <User size={26} />
                <span>Select a customer to see their details</span>
              </div>
            )}
          </section>

          {/* Right: pay mode · amount · keypad · save */}
          <section className="adv3-right" aria-label="Payment">
            <div className="adv3-modes" role="radiogroup" aria-label="Payment mode">
              {PAY_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  className={mode === m.id ? 'is-on' : undefined}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <label className="adv3-amount">
              <em>AED</em>
              <input
                ref={amountRef}
                value={amount}
                inputMode="none"
                placeholder="0.00"
                aria-label="Amount"
                onChange={(e) => {
                  setError(null)
                  setAmount(decimal(e.target.value).slice(0, 10))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    save()
                  }
                }}
              />
            </label>

            <div className="adv3-keys" role="group" aria-label="Keypad">
              {KEYS.map((k) => (
                <button key={k} type="button" className="pd-key" onClick={() => onKey(k)}>
                  {k}
                </button>
              ))}
            </div>

            {error ? <p className="adv3-error">{error}</p> : null}

            <button type="button" className="adv3-save" onClick={save}>
              Save
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
