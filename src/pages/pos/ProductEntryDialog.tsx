/**
 * Product entry / edit — same fields and VAT maths as Saloon POS ProductMasterDetailsDialog.
 */
import { useEffect, useRef, useState } from 'react'
import { Package, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'

type Opt = { id: number; name: string; code: string; groupId?: number }

/** Restaurant tills sell MOH- menu groups. Other groups on the same branch stay off this list. */
export function ownMenuGroups(rows: Record<string, unknown>[]): Opt[] {
  const mapped = rows.map((g) => ({
    id: Number(g.groupId ?? g.GroupID) || 0,
    name: String(g.groupDescription ?? g.GroupDescription ?? g.groupCode ?? g.GroupCode ?? '').trim(),
    code: String(g.groupCode ?? g.GroupCode ?? '').trim(),
  })).filter((g) => g.id > 0 && g.name)
  const own = mapped.filter((g) => g.code.toUpperCase().startsWith('MOH-'))
  return own.length ? own : mapped
}

function menuGroupCode(name: string, taken: Set<string>) {
  const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'GROUP'
  let code = `MOH-${slug}`.slice(0, 50)
  let n = 2
  while (taken.has(code.toUpperCase())) {
    const suffix = `-${n}`
    code = (`MOH-${slug}`.slice(0, 50 - suffix.length) + suffix).slice(0, 50)
    n += 1
  }
  return code
}

type Props = {
  productId?: number | null
  taxRate?: number
  onClose: () => void
  onSaved: () => void
  onMenuChanged?: () => void
}

const MAKE_TYPES = ['Standard', 'Assembly', 'Service']
const PRODUCT_TYPES = ['Stock', 'Non-stock', 'Service']
const STOCK_TYPES = ['Normal', 'Batch', 'Serial']
const UNITS = ['PCS', 'KG', 'GM', 'LT', 'ML', 'METER']

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function num(s: string) {
  const n = Number(String(s).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function numStr(v: unknown) {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return ''
  return String(parseFloat(n.toFixed(2)))
}

export default function ProductEntryDialog({ productId, taxRate = 5, onClose, onSaved, onMenuChanged }: Props) {
  const isEdit = productId != null && productId > 0
  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<Opt[]>([])
  const [pinnedGroup, setPinnedGroup] = useState<Opt | null>(null)
  const [subGroups, setSubGroups] = useState<Opt[]>([])
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupArabic, setNewGroupArabic] = useState('')
  const [groupBusy, setGroupBusy] = useState(false)

  const [newBarcode, setNewBarcode] = useState(!isEdit)
  const [barcode, setBarcode] = useState('')
  const [productCode, setProductCode] = useState('')
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [arabic, setArabic] = useState('')
  const [brand, setBrand] = useState('')
  const [groupId, setGroupId] = useState('')
  const [subGroupId, setSubGroupId] = useState('')
  const [makeType, setMakeType] = useState('Standard')
  const [productType, setProductType] = useState('Service')
  const [stockType, setStockType] = useState('Normal')
  const [unit, setUnit] = useState('PCS')
  const [identity, setIdentity] = useState('No')

  const [unitCost, setUnitCost] = useState('')
  const [vatInPct, setVatInPct] = useState(String(taxRate))
  const [vatInAmt, setVatInAmt] = useState('')
  const [costWithVat, setCostWithVat] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [vatOutPct, setVatOutPct] = useState(String(taxRate))
  const [vatOutAmt, setVatOutAmt] = useState('')
  const [priceWithVat, setPriceWithVat] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [marginPct, setMarginPct] = useState('')
  const [levels, setLevels] = useState(['', '', '', '', ''])
  const [lastPurch, setLastPurch] = useState('')
  const [avgCost, setAvgCost] = useState('')

  const [packQty, setPackQty] = useState('1')
  const [packet, setPacket] = useState('')
  const [qtyOnHand, setQtyOnHand] = useState('')
  const [reorderLevel, setReorderLevel] = useState('')
  const [reorderQty, setReorderQty] = useState('')
  const [location, setLocation] = useState('Main')
  const [supplierRef, setSupplierRef] = useState('')
  const [origin, setOrigin] = useState('')
  const [remarks, setRemarks] = useState('')
  const suppress = useRef(false)
  const nameRef = useRef<HTMLInputElement | null>(null)

  function applyOutputFromNet(price: string, rate: string) {
    const net = num(price)
    const pct = num(rate)
    const vat = net * pct / 100
    suppress.current = true
    setVatOutAmt(money(vat))
    setPriceWithVat(money(net + vat))
    suppress.current = false
  }

  function applyInputFromNet(cost: string, rate: string) {
    const net = num(cost)
    const pct = num(rate)
    const vat = net * pct / 100
    suppress.current = true
    setVatInAmt(money(vat))
    setCostWithVat(money(net + vat))
    suppress.current = false
  }

  useEffect(() => {
    let alive = true
    apiService.fetchGroups().then((rows) => {
      if (!alive) return
      setGroups(ownMenuGroups(rows))
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!groupId) {
      setSubGroups([])
      return
    }
    let alive = true
    apiService.fetchSubGroups({ groupId }).then((rows) => {
      if (!alive) return
      setSubGroups(rows.map((sg) => ({
        id: Number(sg.subGroupId ?? sg.SubGroupID) || 0,
        groupId: Number(sg.groupId ?? sg.GroupID) || 0,
        name: String(sg.subGroupDescription ?? sg.SubGroupDescription ?? '').trim(),
        code: '',
      })).filter((sg) => sg.id > 0 && sg.name))
    }).catch(() => {})
    return () => { alive = false }
  }, [groupId])

  useEffect(() => {
    if (!isEdit || !productId) {
      nameRef.current?.focus()
      return
    }
    let alive = true
    setLoading(true)
    apiService.fetchProduct(productId).then((p) => {
      if (!alive) return
      const inv = (p.inventory ?? {}) as Record<string, unknown>
      suppress.current = true
      setProductCode(String(p.productCode ?? ''))
      setBarcode(String(p.barcode ?? ''))
      setNewBarcode(false)
      setName(String(p.productName ?? p.description ?? ''))
      setShortName(String(p.shortName ?? p.shortDescription ?? ''))
      setArabic(String(p.descriptionArabic ?? ''))
      setBrand(String(p.brandName ?? ''))
      setMakeType(String(p.makeType || 'Standard'))
      setProductType(String(p.productType || 'Stock'))
      setStockType(String(p.stockType || 'Normal'))
      setUnit(String(p.unitName || p.unit || 'PCS'))
      setIdentity(Number(p.productIdentity) === 1 ? 'Yes' : 'No')
      setGroupId(p.groupId != null ? String(p.groupId) : '')
      setSubGroupId(p.subgroupId != null ? String(p.subgroupId) : '')
      if (p.groupId != null) {
        const currentId = Number(p.groupId)
        const currentName = String(p.groupName ?? p.groupDescription ?? '').trim()
        if (currentId > 0 && currentName) {
          setPinnedGroup({ id: currentId, name: currentName, code: '' })
        }
      }
      setUnitCost(numStr(inv.averageCost ?? inv.lastPurchaseCost))
      setAvgCost(numStr(inv.averageCost))
      setLastPurch(numStr(inv.lastPurchaseCost))
      setUnitPrice(numStr(inv.unitPrice))
      setMinPrice(numStr(inv.minimumRetailPrice))
      setDiscountPct(numStr(inv.discountPercentage))
      setMarginPct(numStr(inv.minimumMarginPercentage))
      setVatInPct(numStr(inv.inputTax1Rate) || String(taxRate))
      setVatOutPct(numStr(inv.outputTax1Rate) || String(taxRate))
      setLevels([1, 2, 3, 4, 5].map((n) => numStr(inv[`priceLevel${n}`])))
      setPackQty(numStr(inv.packQty ?? p.packQty) || '1')
      setQtyOnHand(numStr(inv.qtyOnHand))
      setReorderLevel(numStr(inv.reorderLevel))
      setReorderQty(numStr(inv.reorderQty))
      setPacket(String(p.packDescription ?? ''))
      setRemarks(String(p.remarks ?? ''))
      setLocation(String(inv.locationCode || 'Main'))
      setOrigin(String(p.countryOfOrigin ?? ''))
      setSupplierRef(String(p.supplierRefNo ?? ''))
      const price = Number(inv.unitPrice) || 0
      const outRate = Number(inv.outputTax1Rate) || taxRate
      setVatOutAmt(money(price * outRate / 100))
      setPriceWithVat(money(price + price * outRate / 100))
      const cost = Number(inv.averageCost) || 0
      const inRate = Number(inv.inputTax1Rate) || taxRate
      setVatInAmt(money(cost * inRate / 100))
      setCostWithVat(money(cost + cost * inRate / 100))
      suppress.current = false
    }).catch((err) => {
      if (alive) setError(errMessage(err, 'Could not load product'))
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [isEdit, productId, taxRate])

  async function saveNewGroup() {
    const groupDescription = newGroupName.trim()
    if (!groupDescription) {
      setError('Group name is required.')
      return
    }
    const useOwnCode = groups.some((g) => g.code.toUpperCase().startsWith('MOH-'))
    const taken = new Set(groups.map((g) => g.code.toUpperCase()))
    const groupCode = useOwnCode ? menuGroupCode(groupDescription, taken) : undefined
    setGroupBusy(true)
    setError(null)
    try {
      const created = await apiService.createGroup({
        groupDescription,
        groupDescriptionArabic: newGroupArabic.trim(),
        ...(groupCode ? { groupCode } : {}),
      })
      const id = Number(created.groupId) || 0
      if (id < 1) throw new Error('Group was not created')
      const opt: Opt = {
        id,
        name: String(created.groupDescription ?? groupDescription),
        code: String(created.groupCode ?? groupCode ?? ''),
      }
      setGroups((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))
      setGroupId(String(id))
      setSubGroupId('')
      setAddingGroup(false)
      setNewGroupName('')
      setNewGroupArabic('')
      onMenuChanged?.()
    } catch (err) {
      setError(errMessage(err, 'Could not create group'))
    } finally {
      setGroupBusy(false)
    }
  }

  async function save() {
    const description = name.trim()
    if (!description) {
      setTab(0)
      setError('Product Name is required.')
      nameRef.current?.focus()
      return
    }
    const derived = description.toUpperCase().replace(/\s+/g, '-').slice(0, 20)
    const code = productCode.trim() || derived || `PRD-${Date.now() % 1000000}`
    const outRate = num(vatOutPct)
    const netPrice = outRate > 0 && priceWithVat
      ? num(priceWithVat) / (1 + outRate / 100)
      : num(unitPrice)
    const averageCost = unitCost || avgCost || '0'
    setBusy(true)
    setError(null)
    const body = {
      productCode: code.slice(0, 50),
      newBarcode,
      ...(newBarcode || !barcode.trim() ? {} : { barcode: barcode.trim() }),
      description,
      shortDescription: shortName.trim() || description,
      descriptionArabic: arabic.trim(),
      makeType,
      productBrand: brand.trim(),
      groupId: groupId ? Number(groupId) : undefined,
      subGroupId: subGroupId ? Number(subGroupId) : undefined,
      baseCost: averageCost,
      unitCost: averageCost,
      averageCost,
      lastPurchCost: lastPurch || averageCost,
      discountPct,
      marginPct,
      minUnitPrice: minPrice,
      unitPrice: money(netPrice),
      vatIn: vatInAmt,
      vatInPct,
      costWithVat,
      vatOut: vatOutAmt,
      vatOutPct,
      priceWithVat,
      priceLevel1: levels[0],
      priceLevel2: levels[1],
      priceLevel3: levels[2],
      priceLevel4: levels[3],
      priceLevel5: levels[4],
      productType,
      stockType,
      unit,
      packQty: packQty || '1',
      packetDetails: packet,
      location: location || 'Main',
      reorderLevel,
      reorderQty,
      qtyOnHand,
      productIdentity: identity,
      remark: remarks,
      supplierRefNo: supplierRef,
      origin,
    }
    try {
      if (isEdit && productId) await apiService.updateProduct(productId, body)
      else await apiService.createProduct(body)
      onMenuChanged?.()
      onSaved()
    } catch (err) {
      setError(errMessage(err, 'Could not save product'))
    } finally {
      setBusy(false)
    }
  }

  const tabs = ['General', 'Stock & Supplier', 'Pricing']
  const groupOptions = pinnedGroup && !groups.some((g) => g.id === pinnedGroup.id)
    ? [...groups, pinnedGroup]
    : groups

  return (
    <div className="pd-mod-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="pd-ol-dialog pd-ol-wide pd-edm pd-prd-edit" role="dialog" aria-modal="true" aria-labelledby="pd-prd-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Package size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">{isEdit ? 'Edit' : 'Creation'}</p>
              <h2 id="pd-prd-title" className="pd-mod-item-name">{isEdit ? 'Edit Product' : 'Product Entry'}</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="pd-ol-body">

        <div className="pd-booking-tabs">
          {tabs.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`pd-booking-tab${tab === i ? ' is-on' : ''}`}
              onClick={() => setTab(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <p className="pd-mfg-count">Loading…</p> : null}
        {error ? <p className="pd-mfg-msg">{error}</p> : null}

        {!loading ? (
          <div className="pd-edm-fields">
            {tab === 0 ? (
              <>
                <div className="pd-form-row">
                  <label>Barcode</label>
                  <input value={barcode} disabled={newBarcode} onChange={(e) => setBarcode(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>New Barcode</label>
                  <select value={newBarcode ? 'yes' : 'no'} onChange={(e) => setNewBarcode(e.target.value === 'yes')}>
                    <option value="yes">Auto</option>
                    <option value="no">Manual</option>
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Product Name</label>
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => {
                      const v = e.target.value
                      setName(v)
                      setShortName(v)
                    }}
                  />
                </div>
                <div className="pd-form-row">
                  <label>Short Description</label>
                  <input value={shortName} onChange={(e) => setShortName(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Arabic</label>
                  <input value={arabic} dir="rtl" onChange={(e) => setArabic(e.target.value)} />
                </div>
                <div className="pd-form-row pd-edm-span">
                  <label>Group</label>
                  <div className="pd-edm-inline">
                    <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setSubGroupId('') }}>
                      <option value="">Select</option>
                      {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button
                      type="button"
                      className="pd-form-code-btn"
                      disabled={groupBusy}
                      onClick={() => setAddingGroup((open) => !open)}
                    >
                      New group
                    </button>
                  </div>
                </div>
                {addingGroup ? (
                  <div className="pd-edm-span pd-edm-inline">
                    <input
                      value={newGroupName}
                      placeholder="Group name"
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveNewGroup() } }}
                    />
                    <input
                      value={newGroupArabic}
                      dir="rtl"
                      placeholder="Arabic"
                      onChange={(e) => setNewGroupArabic(e.target.value)}
                    />
                    <button type="button" className="pd-mfg-add" disabled={groupBusy} onClick={() => void saveNewGroup()}>
                      {groupBusy ? 'Saving…' : 'Save group'}
                    </button>
                    <button type="button" className="pd-form-code-btn" disabled={groupBusy} onClick={() => setAddingGroup(false)}>
                      Cancel
                    </button>
                  </div>
                ) : null}
                <div className="pd-form-row">
                  <label>Sub Group</label>
                  <select value={subGroupId} onChange={(e) => setSubGroupId(e.target.value)} disabled={!groupId}>
                    <option value="">Select</option>
                    {subGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Make Type</label>
                  <select value={makeType} onChange={(e) => setMakeType(e.target.value)}>
                    {MAKE_TYPES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Product Type</label>
                  <select value={productType} onChange={(e) => setProductType(e.target.value)}>
                    {PRODUCT_TYPES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Brand</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Product Code</label>
                  <input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="Optional" />
                </div>
                <div className="pd-form-row">
                  <label>Unit Cost</label>
                  <input value={unitCost} onChange={(e) => { setUnitCost(e.target.value); if (!suppress.current) applyInputFromNet(e.target.value, vatInPct) }} />
                </div>
                <div className="pd-form-row">
                  <label>VAT In %</label>
                  <input value={vatInPct} onChange={(e) => { setVatInPct(e.target.value); if (!suppress.current) applyInputFromNet(unitCost, e.target.value) }} />
                </div>
                <div className="pd-form-row">
                  <label>VAT In Amt</label>
                  <input value={vatInAmt} readOnly />
                </div>
                <div className="pd-form-row">
                  <label>Cost With VAT</label>
                  <input
                    value={costWithVat}
                    onChange={(e) => {
                      const gross = e.target.value
                      setCostWithVat(gross)
                      if (suppress.current) return
                      const rate = num(vatInPct)
                      const g = num(gross)
                      const net = rate <= 0 ? g : g / (1 + rate / 100)
                      suppress.current = true
                      setUnitCost(money(net))
                      setVatInAmt(money(g - net))
                      suppress.current = false
                    }}
                  />
                </div>
                <div className="pd-form-row">
                  <label>Unit Price</label>
                  <input value={unitPrice} onChange={(e) => { setUnitPrice(e.target.value); if (!suppress.current) applyOutputFromNet(e.target.value, vatOutPct) }} />
                </div>
                <div className="pd-form-row">
                  <label>VAT Out %</label>
                  <input value={vatOutPct} onChange={(e) => { setVatOutPct(e.target.value); if (!suppress.current) applyOutputFromNet(unitPrice, e.target.value) }} />
                </div>
                <div className="pd-form-row">
                  <label>VAT Out Amt</label>
                  <input value={vatOutAmt} readOnly />
                </div>
                <div className="pd-form-row">
                  <label>Price With VAT</label>
                  <input
                    value={priceWithVat}
                    onChange={(e) => {
                      const gross = e.target.value
                      setPriceWithVat(gross)
                      if (suppress.current) return
                      const rate = num(vatOutPct)
                      const g = num(gross)
                      const net = rate <= 0 ? g : g / (1 + rate / 100)
                      suppress.current = true
                      setUnitPrice(money(net))
                      setVatOutAmt(money(g - net))
                      suppress.current = false
                    }}
                  />
                </div>
              </>
            ) : null}

            {tab === 1 ? (
              <>
                <div className="pd-form-row">
                  <label>Unit</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                    {UNITS.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Stock Type</label>
                  <select value={stockType} onChange={(e) => setStockType(e.target.value)}>
                    {STOCK_TYPES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Pack Qty</label>
                  <input value={packQty} onChange={(e) => setPackQty(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Packet Details</label>
                  <input value={packet} onChange={(e) => setPacket(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Qty On Hand</label>
                  <input value={qtyOnHand} onChange={(e) => setQtyOnHand(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Reorder Level</label>
                  <input value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Reorder Qty</label>
                  <input value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Supplier Ref</label>
                  <input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Origin</label>
                  <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Product Identity</label>
                  <select value={identity} onChange={(e) => setIdentity(e.target.value)}>
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>
                <div className="pd-form-row pd-edm-span">
                  <label>Remarks</label>
                  <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>
              </>
            ) : null}

            {tab === 2 ? (
              <>
                <div className="pd-form-row">
                  <label>Min Price</label>
                  <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Discount %</label>
                  <input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Margin %</label>
                  <input value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Last Purchase</label>
                  <input value={lastPurch} onChange={(e) => setLastPurch(e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Average Cost</label>
                  <input value={avgCost} readOnly />
                </div>
                {levels.map((value, i) => (
                  <div className="pd-form-row" key={i}>
                    <label>Price Level {i + 1}</label>
                    <input
                      value={value}
                      onChange={(e) => setLevels((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    />
                  </div>
                ))}
              </>
            ) : null}
          </div>
        ) : null}

        </div>

        <div className="pd-mod-foot">
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void save()} disabled={busy || loading}>
            {busy ? 'Saving…' : isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
