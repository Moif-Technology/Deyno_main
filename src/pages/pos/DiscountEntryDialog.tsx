/**
 * Discount Entry — same layout as Recipe Entry: discount period + bulk "apply %
 * to a group" on top, discounted items on the left, product tiles (filtered by
 * the chosen group) on the right. Tapping a tile opens the pad: Disc % and Disc
 * Amt keep each other in step; Done puts the line in the table.
 *
 * There is no discount endpoint yet, so Save only confirms locally (as before).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Percent, Trash2, X } from 'lucide-react'
import { apiService } from '../../api/apiService'
import { DateRangePicker } from '../../components/common/DateRangePicker'
import { NumberPad } from '../../components/common/NumberPad'
import { decimal } from '../../utils/validate'
import './RecipeEntryDialog.css'
import './ListToolbar.css'

type Opt = { id: number; name: string }
type SubOpt = Opt & { groupId: number }

type Item = {
  productId: number
  barcode: string
  name: string
  groupId: number
  subGroupId: number
  sellingPrice: number
}

type Line = Item & { key: number; discPct: number; discAmt: number }

type Props = {
  groups: Opt[]
  subGroups: SubOpt[]
  onClose: () => void
  onSaved: (count: number) => void
}

type PadField = 'pct' | 'amt'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function numStr(n: number) {
  return n ? String(parseFloat(n.toFixed(2))) : ''
}

function asRow(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function mapProductRow(r: Record<string, unknown>): Item {
  const inv = asRow(r.inventory)
  return {
    productId: Number(r.productId ?? r.ProductID) || 0,
    barcode: String(r.barcode ?? r.BarCode ?? r.productCode ?? r.ProductCode ?? '').trim(),
    name: String(r.shortName || r.shortDescription || r.productName || r.ProductName || '').trim(),
    groupId: Number(r.groupId ?? r.GroupID) || 0,
    subGroupId: Number(r.subgroupId ?? r.subGroupId ?? r.SubGroupID) || 0,
    sellingPrice: Number(inv.unitPrice ?? r.unitPrice) || 0,
  }
}

export default function DiscountEntryDialog({ groups, subGroups, onClose, onSaved }: Props) {
  const [from, setFrom] = useState(isoToday)
  const [to, setTo] = useState(isoToday)
  const [groupId, setGroupId] = useState(0)
  const [subGroupId, setSubGroupId] = useState(0)
  const [bulkPct, setBulkPct] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const lineKey = useRef(1)

  const [items, setItems] = useState<Item[]>([])
  const [itemsState, setItemsState] = useState<'loading' | 'ready' | 'error'>('loading')

  const [pad, setPad] = useState<{ item: Item; lineKey: number | null } | null>(null)
  const [padPct, setPadPct] = useState('')
  const [padAmt, setPadAmt] = useState('')
  const [padField, setPadField] = useState<PadField>('pct')
  const pctRef = useRef<HTMLInputElement | null>(null)
  const amtRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let alive = true
    apiService
      .fetchProducts()
      .then((rows) => {
        if (!alive) return
        setItems(rows.map(mapProductRow).filter((p) => p.productId > 0 && p.name))
        setItemsState('ready')
      })
      .catch(() => {
        if (alive) setItemsState('error')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!pad) return
    const t = window.setTimeout(() => (padField === 'amt' ? amtRef : pctRef).current?.focus(), 0)
    return () => window.clearTimeout(t)
    // Only when the pad opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pad])

  const shownSubGroups = useMemo(
    () => (groupId ? subGroups.filter((s) => s.groupId === groupId) : []),
    [subGroups, groupId],
  )

  const tiles = useMemo(
    () =>
      items.filter(
        (p) => (!groupId || p.groupId === groupId) && (!subGroupId || p.subGroupId === subGroupId),
      ),
    [items, groupId, subGroupId],
  )

  const lineByProduct = useMemo(() => {
    const m = new Map<number, Line>()
    for (const l of lines) m.set(l.productId, l)
    return m
  }, [lines])

  const totalDisc = useMemo(() => lines.reduce((s, l) => s + l.discAmt, 0), [lines])

  function makeLine(item: Item, pct: number, key?: number): Line {
    return {
      ...item,
      key: key ?? lineKey.current++,
      discPct: round2(pct),
      discAmt: round2((item.sellingPrice * pct) / 100),
    }
  }

  /** Bulk: every item in the chosen group / subgroup at the same %. */
  function applyToAll() {
    const pct = Number(bulkPct)
    if (!(pct > 0 && pct <= 100)) {
      setError('Enter a discount % between 1 and 100')
      return
    }
    if (!tiles.length) {
      setError('No items in this group')
      return
    }
    setLines((prev) => {
      const byId = new Map(prev.map((l) => [l.productId, l]))
      for (const item of tiles) {
        const old = byId.get(item.productId)
        byId.set(item.productId, makeLine(item, pct, old?.key))
      }
      return [...byId.values()]
    })
    setError(null)
  }

  function openPad(item: Item) {
    setError(null)
    const line = lineByProduct.get(item.productId)
    setPad({ item: line ?? item, lineKey: line?.key ?? null })
    setPadPct(line ? numStr(line.discPct) : bulkPct)
    setPadAmt(line ? numStr(line.discAmt) : bulkPct ? numStr(round2((item.sellingPrice * Number(bulkPct)) / 100)) : '')
    setPadField('pct')
  }

  // Disc % and Disc Amt follow each other.
  function changePct(v: string) {
    setPadPct(v)
    if (!pad) return
    const pct = Number(v) || 0
    setPadAmt(v ? numStr(round2((pad.item.sellingPrice * pct) / 100)) : '')
  }

  function changeAmt(v: string) {
    setPadAmt(v)
    if (!pad) return
    const price = pad.item.sellingPrice
    setPadPct(v && price > 0 ? numStr(round2(((Number(v) || 0) / price) * 100)) : '')
  }

  function onPadKey(k: string) {
    const cur = padField === 'pct' ? padPct : padAmt
    const set = padField === 'pct' ? changePct : changeAmt
    if (k === 'C') set(cur.slice(0, -1))
    else if (!(k === '.' && cur.includes('.'))) set((cur + k).slice(0, 8))
  }

  function applyPad() {
    if (!pad) return
    const pct = Number(padPct)
    if (!(pct > 0 && pct <= 100)) {
      setError('Discount must be between 1% and 100%')
      return
    }
    const next = makeLine(pad.item, pct, pad.lineKey ?? undefined)
    setLines((prev) =>
      pad.lineKey != null ? prev.map((l) => (l.key === pad.lineKey ? next : l)) : [...prev, next],
    )
    setError(null)
    setPad(null)
  }

  function save() {
    if (!from || !to) {
      setError('Choose the discount period')
      return
    }
    if (!lines.length) {
      setError('Add at least one item')
      return
    }
    onSaved(lines.length)
    setLines([])
    setError(null)
  }

  return (
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-mfg pd-rcp" role="dialog" aria-modal="true" aria-labelledby="pd-disc-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Percent size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Settings</p>
              <h2 id="pd-disc-title" className="pd-mod-item-name">Discount Entry</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="rcp-body">
          <div className="dsc-top">
            <div className="pd-form-row dsc-period">
              <label>Discount period</label>
              <DateRangePicker
                from={from}
                to={to}
                onChange={(f, t) => {
                  setFrom(f)
                  setTo(t)
                }}
              />
            </div>
            <div className="dsc-bulk">
              <select
                value={groupId}
                onChange={(e) => {
                  setGroupId(Number(e.target.value))
                  setSubGroupId(0)
                }}
                aria-label="Group"
              >
                <option value={0}>All groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select
                value={subGroupId}
                onChange={(e) => setSubGroupId(Number(e.target.value))}
                disabled={!groupId}
                aria-label="Subgroup"
              >
                <option value={0}>All subgroups</option>
                {shownSubGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <label className="dsc-pct">
                <input
                  value={bulkPct}
                  inputMode="decimal"
                  placeholder="0"
                  onChange={(e) => setBulkPct(decimal(e.target.value).slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyToAll()
                  }}
                  aria-label="Discount percent for all"
                />
                %
              </label>
              <button type="button" className="lst-btn is-primary" onClick={applyToAll}>
                Apply to all
              </button>
            </div>
          </div>

          {error ? <p className="pd-mfg-msg">{error}</p> : null}

          <div className="rcp-main">
            <section className="rcp-lines dsc-lines">
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Description</th>
                      <th className="num">Price</th>
                      <th className="num">Disc %</th>
                      <th className="num">Disc</th>
                      <th className="num">Net</th>
                      <th className="col-menu" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="rcp-empty">
                          Tap a product, or pick a group and use “Apply to all”
                        </td>
                      </tr>
                    ) : (
                      lines.map((l) => (
                        <tr key={l.key} className="rcp-row" onClick={() => openPad(l)}>
                          <td>{l.barcode}</td>
                          <td>{l.name}</td>
                          <td className="num">{money(l.sellingPrice)}</td>
                          <td className="num rcp-qty">{numStr(l.discPct)}%</td>
                          <td className="num">{money(l.discAmt)}</td>
                          <td className="num">{money(l.sellingPrice - l.discAmt)}</td>
                          <td className="col-menu">
                            <button
                              type="button"
                              className="pd-row-delete"
                              onClick={(e) => {
                                e.stopPropagation()
                                setLines((prev) => prev.filter((x) => x.key !== l.key))
                              }}
                              aria-label="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rcp-cat" aria-label="Products">
              <div className="rcp-panel">
                <div className="rcp-tiles">
                  {itemsState === 'loading' ? (
                    <p className="pd-cat-msg">Loading items…</p>
                  ) : itemsState === 'error' ? (
                    <p className="pd-cat-msg">Could not load items</p>
                  ) : tiles.length === 0 ? (
                    <p className="pd-cat-msg">No items in this group</p>
                  ) : (
                    tiles.map((p) => {
                      const line = lineByProduct.get(p.productId)
                      return (
                        <button
                          key={p.productId}
                          type="button"
                          className={`pd-product rcp-tile${line ? ' is-in' : ''}`}
                          onClick={() => openPad(p)}
                          title={p.name}
                        >
                          <span className="pd-product-name">{p.name.toLowerCase()}</span>
                          <span className="pd-product-foot">
                            <span className="pd-product-price">AED {money(p.sellingPrice)}</span>
                            {line ? <span className="rcp-tile-qty">{numStr(line.discPct)}%</span> : null}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="pd-mod-foot">
          <span className="pd-mfg-count">
            {lines.length} item{lines.length === 1 ? '' : 's'} · Total discount <strong>AED {money(totalDisc)}</strong>
          </span>
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn" onClick={() => setLines([])} disabled={!lines.length}>
            Clear
          </button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={save}>
            Save
          </button>
        </div>
      </div>

      {pad ? (
        <div
          className="pd-mod-overlay rcp-pad-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPad(null)
          }}
        >
          <div className="pd-qty-dialog rcp-pad dsc-pad" role="dialog" aria-modal="true" aria-labelledby="dsc-pad-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Percent size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">{pad.lineKey != null ? 'Change Discount' : 'Discount'}</p>
                  <h2 id="dsc-pad-title" className="pd-mod-item-name">{pad.item.name}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setPad(null)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields rcp-pad-fields">
                <div className="pur-pad-fields">
                  <label className={padField === 'pct' ? 'is-on' : undefined}>
                    <span>Disc %</span>
                    <input
                      ref={pctRef}
                      value={padPct}
                      inputMode="none"
                      placeholder="0"
                      onFocus={() => setPadField('pct')}
                      onChange={(e) => changePct(decimal(e.target.value).slice(0, 6))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyPad()
                        if (e.key === 'Escape') setPad(null)
                      }}
                    />
                  </label>
                  <label className={padField === 'amt' ? 'is-on' : undefined}>
                    <span>Disc Amt</span>
                    <input
                      ref={amtRef}
                      value={padAmt}
                      inputMode="none"
                      placeholder="0.00"
                      onFocus={() => setPadField('amt')}
                      onChange={(e) => changeAmt(decimal(e.target.value).slice(0, 8))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyPad()
                        if (e.key === 'Escape') setPad(null)
                      }}
                    />
                  </label>
                </div>
                <dl className="rcp-pad-info">
                  <div>
                    <dt>Barcode</dt>
                    <dd>{pad.item.barcode || '—'}</dd>
                  </div>
                  <div>
                    <dt>Selling Price</dt>
                    <dd>AED {money(pad.item.sellingPrice)}</dd>
                  </div>
                  <div className="is-total">
                    <dt>Net Price</dt>
                    <dd>AED {money(pad.item.sellingPrice - (Number(padAmt) || 0))}</dd>
                  </div>
                </dl>
              </div>
              <div className="pd-qty-pad">
                <NumberPad onKey={onPadKey} />
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={applyPad}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={() => setPad(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
