import {
  Trees,
  Truck,
  ShoppingBag,
  Utensils,
  Sandwich,
  Pizza,
  Drumstick,
  Beef,
  Fish,
  Egg,
  Salad,
  Soup,
  Sunrise,
  Flame,
  GlassWater,
  CupSoda,
  Cake,
  Coffee,
  Smile,
  Star,
  UtensilsCrossed,
} from 'lucide-react'
import { ApiError } from '../../../api/apiService'
import { getPosSession } from '../../../utils/posSession'
import { SessionManager } from '../../../utils/sessionManager'
import { type ComponentType } from 'react'
import {
  type ProductForm,
  type VariantGroup,
  type Cat,
  type SubCat,
  type SubSubCat,
  type ProductTile,
  type ModifierPreset,
  type ServiceKind,
  type AreaRow,
  type TableRow,
  type OrderRow,
  type AlertKind,
  type TicketLine,
} from './posTypes'

export const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const

export const BLANK_PRODUCT_FORM: ProductForm = {
  id: 0,
  code: '',
  description: '',
  arabicDescription: '',
  groupId: 0,
  groupName: '',
  subgroupId: 0,
  subgroupName: '',
  kitchenLocation: '',
  kotPriority: 'NORMAL',
  unitCost: '',
  vatIn: '5',
  unitPrice: '',
  vatOut: '5',
  packQty: '1',
  unit: 'PCS',
  qtyOnHand: '',
  productType: 'NORMAL',
  itemDescription: '',
  priceLevels: ['', '', '', '', ''],
  keep: {},
}

/** MOCK: there is no variants endpoint yet, so they are kept in this browser only. */
export const VARIANT_STORE = 'deyno.productVariants'

export function loadVariantMap(): Record<string, VariantGroup[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(VARIANT_STORE) || '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

/** Counter-POS / Select Customer: digits → mobile prefill, otherwise name. */
export function prefillFromCustomerSearch(q: string): { name: string; mobile: string } {
  const trimmed = q.trim()
  if (!trimmed) return { name: '', mobile: '' }
  const compact = trimmed.replace(/[\s\-()]/g, '')
  if (/^\+?\d{6,15}$/.test(compact)) return { name: '', mobile: compact }
  return { name: trimmed, mobile: '' }
}

export function money(n: number) {
  return n.toFixed(2)
}

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Privilege Setup pages — legacy names kept as-is so stored privileges still match. */
export const PRIVILEGE_PAGES = [
  'Main Page', 'Masters', 'Amentment', 'Transaction', 'Reprint', 'Credit',
  'Reports', 'ReportsA4', 'Admin', 'Settings', 'Purchase',
]

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** "30 Sep 2026", or "1 Sep 2026 – 30 Sep 2026 · 30 days" for a range. */
export function dayCloseLabel(from: string, to: string) {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return y && m && d ? new Date(y, m - 1, d) : null
  }
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const a = parse(from)
  const b = parse(to)
  if (!a || !b) return 'Choose a date'
  if (a.getTime() === b.getTime()) return fmt(a)
  const days = Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000) + 1
  return `${fmt(a)} – ${fmt(b)} · ${days} days`
}

export function formatClock(d: Date) {
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date}     ${time}`
}

export function asRow(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

export function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Stored number → form text; blank for missing or zero. */
export function formNum(v: unknown): string {
  const n = Number(v)
  return v == null || v === '' || !Number.isFinite(n) || n === 0 ? '' : String(parseFloat(n.toFixed(2)))
}

export function mapGroups(rows: Record<string, unknown>[]): Cat[] {
  const mapped = rows.map((g) => ({
    id: num(g.groupId ?? g.GroupID),
    name: String(g.groupDescription ?? g.GroupDescription ?? g.groupName ?? '').trim(),
    code: String(g.groupCode ?? g.GroupCode ?? '').trim(),
  })).filter((g) => g.id > 0 && g.name)
  const moh = mapped.filter((g) => g.code.toUpperCase().startsWith('MOH-'))
  return moh.length ? moh : mapped
}

/** Restaurant menu groups are MOH- codes. A blank code follows that series when the branch already uses it. */
export function menuGroupCode(name: string, taken: Set<string>) {
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

export function mapSubGroups(rows: Record<string, unknown>[]): SubCat[] {
  return rows.map((g) => ({
    id: num(g.subGroupId ?? g.SubGroupID),
    name: String(g.subGroupDescription ?? g.SubGroupDescription ?? '').trim(),
    groupId: num(g.groupId ?? g.GroupID),
  })).filter((g) => g.id > 0 && g.name && g.groupId > 0)
}

export function mapSubSubGroups(rows: Record<string, unknown>[]): SubSubCat[] {
  return rows.map((g) => ({
    id: num(g.subSubGroupId ?? g.SubSubGroupID),
    name: String(g.subSubGroupDescription ?? g.SubSubGroupDescription ?? '').trim(),
    subGroupId: num(g.subGroupId ?? g.SubGroupID),
  })).filter((g) => g.id > 0 && g.name && g.subGroupId > 0)
}

/** MainGroupMaster.ApplyDiscount — missing flag defaults to allowed when GroupID > 0. */
export function flagApplyDiscount(raw: unknown, groupId: number) {
  if (raw == null || raw === '') return groupId > 0
  if (typeof raw === 'boolean') return raw
  const u = String(raw).trim().toUpperCase()
  if (u === 'TRUE' || u === 'Y' || u === 'YES') return true
  if (u === 'FALSE' || u === 'N' || u === 'NO') return false
  return num(raw) !== 0
}

export function mapProducts(rows: Record<string, unknown>[]): ProductTile[] {
  return rows.map((p) => {
    const inv = asRow(p.inventory)
    const name = String(p.productName ?? p.ProductName ?? p.shortName ?? '').trim()
    const shortName = String(p.shortName ?? p.ShortDescription ?? '').trim()
    const groupId = num(p.groupId ?? p.GroupID)
    return {
      id: num(p.productId ?? p.ProductID),
      name,
      sub: shortName && shortName !== name ? shortName : undefined,
      price: num(inv.unitPrice ?? p.unitPrice ?? p.UnitPrice),
      groupId,
      subgroupId: num(p.subgroupId ?? p.subGroupId ?? p.SubGroupID),
      subsubgroupId: num(p.subsubgroupId ?? p.subSubGroupId ?? p.SubSubGroupID),
      taxRate: num(inv.outputTax1Rate ?? p.tax1Rate ?? p.Tax1Rate),
      taxAmount: num(inv.outputTax1Amount ?? p.tax1Amount ?? p.Tax1Amount),
      productType: String(p.productType ?? p.ProductType ?? '').trim().toUpperCase(),
      barcode: String(p.barcode ?? p.BarCode ?? p.productCode ?? p.ProductCode ?? '').trim(),
      applyDiscount: flagApplyDiscount(p.applyDiscount ?? p.ApplyDiscount, groupId),
    }
  }).filter((p) => p.id > 0 && p.name)
}

export function mapModifiers(rows: Record<string, unknown>[]): ModifierPreset[] {
  return rows.map((m) => ({
    id: num(m.modifierId ?? m.ModifierID),
    name: String(m.modifier ?? m.Modifier ?? '').trim(),
    arabic: String(m.modifierArabic ?? m.ModifierArabic ?? '').trim(),
  })).filter((m) => m.name)
}

export function normalizeSupply(raw: unknown): ServiceKind {
  const u = String(raw ?? '').replace(/_/g, ' ').toUpperCase().trim()
  if (u === 'DELIVERY') return 'DELIVERY'
  if (u === 'PARCEL' || u === 'TAKEAWAY' || u === 'TAKE AWAY') return 'TAKEAWAY'
  return 'DINE IN'
}

export function areaNameKey(name: string) {
  return name.replace(/[_-]/g, ' ').toUpperCase().replace(/\s+/g, ' ').trim()
}

export function areaMatchesService(area: AreaRow, svc: ServiceKind) {
  const name = areaNameKey(area.name)
  const rawSupply = String(area.supplyType ?? '').replace(/_/g, ' ').toUpperCase().trim()
  const supplyKind = rawSupply ? normalizeSupply(rawSupply) : null
  if (svc === 'TAKEAWAY') {
    if (supplyKind === 'TAKEAWAY') return true
    return (
      name === 'TAKEAWAY' ||
      name === 'TAKE AWAY' ||
      name === 'PARCEL' ||
      name.includes('TAKE AWAY') ||
      name.includes('TAKEAWAY')
    )
  }
  if (svc === 'DELIVERY') {
    if (supplyKind === 'DELIVERY') return true
    return name === 'DELIVERY' || name.includes('DELIVERY')
  }
  if (supplyKind === 'TAKEAWAY' || supplyKind === 'DELIVERY') return false
  if (name === 'TAKEAWAY' || name === 'TAKE AWAY' || name === 'PARCEL' || name === 'DELIVERY') return false
  return true
}

export function mapAreas(rows: Record<string, unknown>[]): AreaRow[] {
  return rows.map((a) => ({
    id: num(a.areaId ?? a.AreaID ?? a.area_id),
    name: String(a.areaName ?? a.AreaName ?? a.area_name ?? '').trim(),
    supplyType: String(a.supplyType ?? a.SupplyType ?? a.supply_type ?? '').trim(),
    kotPrefix: String(a.kotPrefix ?? a.KotPrefix ?? a.kot_prefix ?? '').trim(),
    tableCreationType: num(a.tableCreationType ?? a.TableCreationType ?? a.table_creation_type),
  })).filter((a) => a.id > 0 && a.name)
}

export function tablesForAreaId(areaId: number, tableList: TableRow[]) {
  return tableList.filter((t) => t.areaId === areaId || (areaId > 0 && t.areaId === 0))
}

export function isFlpArea(area: AreaRow) {
  const supply = String(area.supplyType ?? '').replace(/_/g, ' ').toUpperCase().trim()
  const name = areaNameKey(area.name)
  if (supply === 'DINE IN' || supply === 'DINEIN') return true
  if ((supply === 'PARCEL' || supply === 'TAKEAWAY' || supply === 'TAKE AWAY') && name !== 'TAKE AWAY' && name !== 'TAKEAWAY') {
    return true
  }
  if (supply === 'DELIVERY' && name !== 'DELIVERY') return true
  return false
}

export function flpAreaTone(area: AreaRow) {
  const supply = normalizeSupply(area.supplyType)
  if (supply === 'TAKEAWAY') return 'parcel'
  if (supply === 'DELIVERY') return 'delivery'
  return 'dine'
}

/** OrderListFrm.colorsList — same area always maps to the same colour (by AreaID). */
export const AREA_PALETTE = [
  '#90EE90',
  '#ADD8E6',
  '#FFFFE0',
  '#FFB6C1',
  '#48D1CC',
  '#DDA0DD',
  '#FFA07A',
  '#D3D3D3',
  '#9ACD32',
  '#87CEFA',
  '#98FB98',
  '#F08080',
  '#F0E68C',
  '#FFE4E1',
  '#E0FFFF',
] as const

export function areaSwatch(areaId: number, areaName = '') {
  const seed =
    areaId > 0
      ? areaId
      : [...String(areaName)].reduce((n, ch) => n + ch.charCodeAt(0), 0)
  const idx = Math.abs(seed) % AREA_PALETTE.length
  return AREA_PALETTE[idx]
}

export function areaSupplyIcon(area: AreaRow) {
  const name = areaNameKey(area.name)
  const supply = normalizeSupply(area.supplyType)
  if (/OUT\s*DOOR|OUTDOOR|GARDEN|TERRACE|PATIO|ROOF/.test(name)) return Trees
  if (supply === 'DELIVERY') return Truck
  if (supply === 'TAKEAWAY') return ShoppingBag
  return Utensils
}

export function pickDefaultTable(area: AreaRow | null, tableList: TableRow[], keepTableId = 0): TableRow | null {
  if (!area) return null
  const forArea = tablesForAreaId(area.id, tableList)
  return forArea.find((t) => t.id === keepTableId) ?? null
}

export function mapOrderRows(rows: Record<string, unknown>[]): OrderRow[] {
  return rows.map((r) => {
    const prefix = String(r.KotPrefix ?? r.kotPrefix ?? '').trim()
    const kotNo = String(r.KotNumber ?? r.kotNumber ?? '').trim()
    const net = num(r.NetAmount ?? r.netAmount)
    const amount = net || num(r.Amount ?? r.amount)
    return {
      kotMasterId: num(r.kotMasterID ?? r.KotMasterID),
      kotNo: `${prefix}${kotNo}` || String(r.kotMasterID ?? ''),
      kotTime: String(r.KotTime ?? r.kotTime ?? ''),
      areaId: num(r.AreaID ?? r.areaId ?? r.area_id),
      areaName: String(r.AreaName ?? r.areaName ?? ''),
      tableName: String(r.TableName ?? r.tableName ?? ''),
      tableId: num(r.TableID ?? r.tableId ?? r.table_id),
      chairNo: num(r.ChairNo ?? r.chairNo ?? r.chair_no),
      supplyType: normalizeSupply(r.SupplyType ?? r.supplyType),
      remarks: String(r.Remarks ?? r.remarks ?? ''),
      pax: num(r.NofCustomer ?? r.nofCustomer),
      waiterName: String(r.WaiterName ?? r.waiterName ?? ''),
      waiterId: num(r.WaiterID ?? r.waiterId ?? r.waiterID),
      customerName: String(r.CustomerName ?? r.customerName ?? ''),
      amount,
    }
  }).filter((r) => r.kotMasterId > 0)
}

export function kotDetailsRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(asRow)
  const root = asRow(payload)
  const nestedRaw = root.kotDetails
  const nested = Array.isArray(nestedRaw) ? nestedRaw : asRow(nestedRaw)
  const raw = Array.isArray(root.data)
    ? root.data
    : Array.isArray(nestedRaw)
      ? nestedRaw
      : Array.isArray((nested as Record<string, unknown>).data)
        ? (nested as Record<string, unknown>).data
        : []
  const rows = Array.isArray(raw) ? raw.map(asRow) : []
  const seen = new Set<string>()
  return rows.filter((r) => {
    const id = String(r.KotChildID ?? r.kotChildID ?? r.KOTChildID ?? r.dgvKOTChildID ?? r.kot_child_id ?? '')
    if (!id || id === '0') return true
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/**
 * VB DisplayKOT: txtRemarks.Text = dsHoldDetails.Rows(i).Item("Remarks")
 * from KOTMaster. Detail rows also send Remarks as the item Modifier alias,
 * so skip that when it matches the line modifier.
 */
export function kotHeaderRemarks(row: Record<string, unknown>, fallback = ''): string {
  const modifier = String(row.Modifier ?? row.Modifir ?? row.modifier ?? '')
  const keys = [
    'HeaderRemarks',
    'headerRemarks',
    'txtRemarks',
    'KotRemarks',
    'kotRemarks',
    'remarks',
    'Remarks',
  ] as const
  for (const key of keys) {
    const raw = row[key]
    if (raw == null) continue
    const s = String(raw)
    if (!s.trim()) continue
    if (key === 'Remarks' && s === modifier) continue
    return s
  }
  return fallback
}

export function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** gvUserDesignation = CHIEF CASHIER / ADMIN skips AdminLoginFrm. */
export function isChiefCashierOrAdmin() {
  const session = getPosSession()
  const designation = String(session.designation || '').trim().toUpperCase()
  const roleName = String(session.roleName || SessionManager.roleName || '').trim().toUpperCase()
  if (designation === 'CHIEF CASHIER' || designation === 'ADMIN') return true
  if (roleName === 'CHIEF CASHIER' || roleName === 'ADMIN' || roleName === 'OWNER') return true
  return Number(SessionManager.roleId) === 1
}

export function inferAlertTitle(kind: AlertKind) {
  if (kind === 'success') return 'Saved'
  if (kind === 'warning') return 'Attention'
  if (kind === 'question') return 'Please Confirm'
  return 'Information'
}

export function formatKotClock(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  const h24 = d.getHours()
  const h12 = h24 % 12 || 12
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(h12)}:${pad(d.getMinutes())} ${ampm}`
}

export function orderListSupplyLabel(supply: string) {
  const u = String(supply || '').replace(/_/g, ' ').toUpperCase()
  if (u === 'TAKEAWAY' || u === 'TAKE AWAY') return 'PARCEL'
  return u || ''
}

export function kotPrintStatus(raw: unknown) {
  if (raw === true || raw === 1) return 'PRINTED'
  const u = String(raw ?? '').trim().toUpperCase()
  if (u === 'PRINTED' || u === 'T' || u === 'TRUE' || u === '1') return 'PRINTED'
  return 'PENDING'
}

/** CalcTotal — SubTotal = qty*price - disc; tax from per-piece VAT unless a line disc exists. */
export function calcLine(price: number, qty: number, vatPerPc: number, taxRate: number, itemDisc: number) {
  const disc = round2(Math.max(0, itemDisc))
  const subtotal = round2(price * qty - disc)
  const tax =
    disc !== 0
      ? round2(subtotal * (taxRate / 100))
      : vatPerPc > 0
        ? round2(vatPerPc * qty)
        : round2(subtotal * (taxRate / 100))
  const gross = Math.abs(price * qty)
  return {
    disc,
    discPerc: gross > 0 ? round2((disc * 100) / gross) : 0,
    tax,
    total: round2(subtotal + tax),
  }
}

export function lineNetSubtotal(line: TicketLine) {
  return round2(line.price * line.qty - line.disc)
}

/**
 * Mainfrm.CalcTotal — bill discount (lblDisc) sits on the header.
 * Item discounts already sit in each line SubTotal.
 */
export function calcKotTotals(lines: TicketLine[], billDiscount: number, tax1Pct: number, roundOff = 0) {
  const itemCount = lines.length
  const qty = lines.reduce((n, l) => n + l.qty, 0)
  const gross = round2(lines.reduce((n, l) => n + l.price * l.qty, 0))
  const itemDiscount = round2(lines.reduce((n, l) => n + l.disc, 0))
  const lineSubtotal = round2(lines.reduce((n, l) => n + lineNetSubtotal(l), 0))
  const lineTax = round2(lines.reduce((n, l) => n + l.tax, 0))
  const disc = round2(Math.max(0, billDiscount))
  const taxableSubTotal = round2(
    lines.reduce((n, l) => n + (l.taxRate > 0 ? lineNetSubtotal(l) : 0), 0),
  )
  const nonTaxableSubTotal = round2(
    lines.reduce((n, l) => n + (l.taxRate <= 0 ? lineNetSubtotal(l) : 0), 0),
  )
  let tax = lineTax
  let total: number
  if (disc > 0) {
    if (taxableSubTotal > 0) {
      const discountAmt = disc > taxableSubTotal ? taxableSubTotal : disc
      const discountedTaxable = round2(taxableSubTotal - discountAmt)
      tax = round2(discountedTaxable * (tax1Pct / 100))
      total = round2(discountedTaxable + tax + nonTaxableSubTotal + roundOff)
    } else {
      tax = 0
      total = round2(lineSubtotal - disc + roundOff)
    }
  } else {
    total = round2(lineSubtotal + tax + roundOff)
  }
  return {
    itemCount,
    qty,
    gross,
    itemDiscount,
    lineSubtotal,
    billDiscount: disc,
    taxableSubTotal,
    nonTaxableSubTotal,
    tax,
    roundOff,
    total,
  }
}

/** IsItemDiscountAllowedForRow — GroupID > 0 and MainGroup ApplyDiscount <> 0. */
export function itemDiscountAllowed(line: TicketLine) {
  if (line.groupId <= 0) return false
  return line.applyDiscount !== false
}

export function allowedItemDiscountCount(ticket: TicketLine[]) {
  return ticket.reduce((n, l) => n + (itemDiscountAllowed(l) ? 1 : 0), 0)
}

export function notAllowedItemDiscountCount(ticket: TicketLine[]) {
  return ticket.reduce((n, l) => n + (itemDiscountAllowed(l) ? 0 : 1), 0)
}

export function allowedItemDiscountTotal(ticket: TicketLine[]) {
  return round2(ticket.reduce((n, l) => n + (itemDiscountAllowed(l) ? l.disc : 0), 0))
}

/** GetCurrentItemDiscountPercent — allowed gross (qty*price), not net. */
export function currentItemDiscountPercent(ticket: TicketLine[]) {
  let gross = 0
  let disc = 0
  for (const line of ticket) {
    if (!itemDiscountAllowed(line)) continue
    gross += Math.abs(line.qty * line.price)
    disc += line.disc
  }
  if (gross <= 0) return 0
  return round2((disc * 100) / gross)
}

export function taxRatesDiffer(ticket: TicketLine[]) {
  if (!ticket.length) return false
  const first = round2(ticket[0].taxRate)
  return ticket.some((l) => round2(l.taxRate) !== first)
}

export function clearAllItemDiscountRows(ticket: TicketLine[]): TicketLine[] {
  return ticket.map((line) => ({
    ...line,
    ...calcLine(line.price, line.qty, line.taxAmount, line.taxRate, 0),
    discPerc: 0,
  }))
}

/** SplitDiscountAmountToItems — `totalDiscount` is a percent 0–100, not an amount. */
export function splitDiscountAmountToItems(ticket: TicketLine[], totalDiscount: number): TicketLine[] | null {
  if (allowedItemDiscountCount(ticket) <= 0) return null
  let pct = totalDiscount
  if (pct < 0) pct = 0
  if (pct > 100) pct = 100
  return ticket.map((line) => {
    if (itemDiscountAllowed(line)) {
      const lineAmount = Math.abs(line.qty * line.price)
      const rowDiscount = round2((lineAmount * pct) / 100)
      return {
        ...line,
        ...calcLine(line.price, line.qty, line.taxAmount, line.taxRate, rowDiscount),
        discPerc: pct,
      }
    }
    return {
      ...line,
      ...calcLine(line.price, line.qty, line.taxAmount, line.taxRate, 0),
      discPerc: 0,
    }
  })
}

/** ReapplyItemWiseDiscountForRow — keep this row's own Disc%, never copy others. */
export function reapplyLineDiscount(
  line: TicketLine,
  discountType: number,
  nextQty = line.qty,
  nextPrice = line.price,
  vatPerPc = line.taxAmount,
): TicketLine {
  let disc = line.disc
  let discPerc = line.discPerc ?? 0
  if (discountType === 2) {
    if (!itemDiscountAllowed(line)) {
      disc = 0
      discPerc = 0
    } else if (discPerc > 0) {
      disc = round2((Math.abs(nextQty * nextPrice) * discPerc) / 100)
    }
  }
  return {
    ...line,
    qty: nextQty,
    price: nextPrice,
    taxAmount: vatPerPc,
    ...calcLine(nextPrice, nextQty, vatPerPc, line.taxRate, disc),
    discPerc: discPerc > 0 ? discPerc : calcLine(nextPrice, nextQty, vatPerPc, line.taxRate, disc).discPerc,
  }
}

export const QTY_PICKER_ROW_HEIGHT = 32

/** Best-effort icon per category name — cosmetic only, falls back to a generic plate. */
export function categoryIcon(name: string): ComponentType<{ size?: number; strokeWidth?: number }> {
  const n = name.toUpperCase()
  if (/BURGER|SANDWICH|CLUB/.test(n)) return Sandwich
  if (/PIZZA/.test(n)) return Pizza
  if (/CHICKEN/.test(n)) return Drumstick
  if (/BEEF|MUTTON|MEAT/.test(n)) return Beef
  if (/FISH|SEAFOOD|PRAWN/.test(n)) return Fish
  if (/EGG/.test(n)) return Egg
  if (/SALAD/.test(n)) return Salad
  if (/SOUP|BIRIYANI|NOODLE|RICE/.test(n)) return Soup
  if (/BREAKFAST|MORNING/.test(n)) return Sunrise
  if (/CHARCOAL|GRILL|BBQ|TANDOOR/.test(n)) return Flame
  if (/JUICE|BEVERAGE/.test(n)) return GlassWater
  if (/DRINK|SHAKE|SODA/.test(n)) return CupSoda
  if (/DESSERT|SWEET|CAKE|\bICE\b/.test(n)) return Cake
  if (/COFFEE|TEA/.test(n)) return Coffee
  if (/KIDS/.test(n)) return Smile
  if (/SPECIAL|KISMATH|TOP MOVE|STARTER/.test(n)) return Star
  return UtensilsCrossed
}
