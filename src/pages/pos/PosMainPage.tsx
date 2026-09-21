/**
 * Main restaurant POS till after PIN login.
 *
 * Group / subgroup / item clicks follow MoifHMS Mainfrm.vb:
 *   GroupButtonClick → load subgroups into the group strip (if any) + all group items
 *   SubGroupBtnClick → load sub-subgroups (if any) + items for that subgroup
 *   SubSubGroupBtnClick → items for that sub-sub-group
 *   ItemBtnClick → add/merge a ticket line using txtQty
 *   btnQty → if keypad (txtSearch) > 0, copy into txtQty and clear search
 *   btnQtyChange / "Change Qty" → QtyChangefrm, write new qty onto current row
   *   btnPriceChange / "Change Price" → AdminLoginFrm then PriceChangefrm; unit price onto current row
   *   btnDiscount_Click → AdminLoginFrm then Discountfrm (bill vs item); CalcTotal; persist KOT
   *   btnSaveKOT_Click → SaveBilDetailsToHoldTable("BillHold","KotSave")
 *   btnOrderList_Click → OrderListFrm → DisplayKOT (always load as NEW, no combine)
 *
 * Modifir column follows dgvItemList / Modifierfrm:
 *   CellClick on Modifir (header "M") → Kitchen Message dialog
 *   Right-click "Add Modifier" → same dialog
 *   ItemName paints ↳ modifier in green under the item
 *   Ok writes rtxtmodifier back onto the current row's Modifir cell
 */
import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Hash, Home, LogOut, Search, StickyNote, Tag, Trash2, X, Printer, Save, MessageSquare, Percent, FileText, Ban, CircleOff, RotateCcw, MinusCircle, Receipt, MapPinned, Utensils, ShoppingBag, Truck, CreditCard, SlidersHorizontal, Plus, ClipboardList, Users, ShieldCheck, UserPlus, GitMerge, CheckCircle2, AlertTriangle, Info, HelpCircle } from 'lucide-react'
import { SessionManager } from '../../utils/sessionManager'
import { clearStaffSession } from '../../utils/pinLoginSession'
import { getEnrollment } from '../../utils/deviceEnrollment'
import { getPosSession } from '../../utils/posSession'
import { apiService, ApiError } from '../../api/apiService'
import './posMain.css'
import SettlementScreen, { type SettlementBill, type SettlementDone } from './SettlementScreen'
import SalesViewerDialog from './SalesViewerDialog'
import CounterCloseAllDialog from './CounterCloseAllDialog'
import KotJoinDialog from './KotJoinDialog'
import AreaMasterDialog from './AreaMasterDialog'
import TableMasterDialog from './TableMasterDialog'
import FloorDesignDialog from './FloorDesignDialog'
import FloorRuntimeCanvas from './FloorRuntimeCanvas'
import AreaChangeDialog from './AreaChangeDialog'

const NAV = ['New Sale', 'Transactions', 'Credit', 'Reports', 'Entry', 'Admin', 'Settings'] as const
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const

type StripLevel = 'group' | 'subgroup' | 'subsub'
type Cat = { id: number; name: string; code: string }
type SubCat = { id: number; name: string; groupId: number }
type SubSubCat = { id: number; name: string; subGroupId: number }
type ProductTile = {
  id: number
  name: string
  sub?: string
  price: number
  groupId: number
  subgroupId: number
  subsubgroupId: number
  taxRate: number
  taxAmount: number
  productType: string
  barcode: string
}
type TicketLine = {
  key: number
  productId: number
  item: string
  modifiers: string
  qty: number
  price: number
  disc: number
  discPerc: number
  tax: number
  total: number
  taxRate: number
  taxAmount: number
  productType: string
  kotPending: boolean
  kotChildId: number
  groupId: number
  barcode: string
  androidPrint: string
  kotDisplayStatus: string
}
type ModifierPreset = { id: number; name: string; arabic: string }
type AreaRow = {
  id: number
  name: string
  supplyType: string
  kotPrefix: string
  tableCreationType: number
}
type TableRow = { id: number; name: string; areaId: number; seats: number; waiterId: number; tableNo?: number; format?: string }
type OrderRow = {
  kotMasterId: number
  kotNo: string
  kotTime: string
  areaId: number
  areaName: string
  tableName: string
  tableId: number
  chairNo: number
  supplyType: string
  remarks: string
  pax: number
  waiterName: string
  waiterId: number
  customerName: string
  amount: number
}
type OccupiedKot = {
  kotMasterId: number
  tableId: number
  chairNo: number
  kotNo: string
  waiterId: number
  pax: number
  remarks: string
}
type ServiceKind = 'DINE IN' | 'TAKEAWAY' | 'DELIVERY'
type CustomerPick = {
  id: number
  name: string
  mobile: string
  telephone: string
  code: string
}

/** Counter-POS / Select Customer: digits → mobile prefill, otherwise name. */
function prefillFromCustomerSearch(q: string): { name: string; mobile: string } {
  const trimmed = q.trim()
  if (!trimmed) return { name: '', mobile: '' }
  const compact = trimmed.replace(/[\s\-()]/g, '')
  if (/^\+?\d{6,15}$/.test(compact)) return { name: '', mobile: compact }
  return { name: trimmed, mobile: '' }
}

function money(n: number) {
  return n.toFixed(2)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function formatClock(d: Date) {
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date}     ${time}`
}

function asRow(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapGroups(rows: Record<string, unknown>[]): Cat[] {
  const mapped = rows.map((g) => ({
    id: num(g.groupId ?? g.GroupID),
    name: String(g.groupDescription ?? g.GroupDescription ?? g.groupName ?? '').trim(),
    code: String(g.groupCode ?? g.GroupCode ?? '').trim(),
  })).filter((g) => g.id > 0 && g.name)
  const moh = mapped.filter((g) => g.code.toUpperCase().startsWith('MOH-'))
  return moh.length ? moh : mapped
}

function mapSubGroups(rows: Record<string, unknown>[]): SubCat[] {
  return rows.map((g) => ({
    id: num(g.subGroupId ?? g.SubGroupID),
    name: String(g.subGroupDescription ?? g.SubGroupDescription ?? '').trim(),
    groupId: num(g.groupId ?? g.GroupID),
  })).filter((g) => g.id > 0 && g.name && g.groupId > 0)
}

function mapSubSubGroups(rows: Record<string, unknown>[]): SubSubCat[] {
  return rows.map((g) => ({
    id: num(g.subSubGroupId ?? g.SubSubGroupID),
    name: String(g.subSubGroupDescription ?? g.SubSubGroupDescription ?? '').trim(),
    subGroupId: num(g.subGroupId ?? g.SubGroupID),
  })).filter((g) => g.id > 0 && g.name && g.subGroupId > 0)
}

function mapProducts(rows: Record<string, unknown>[]): ProductTile[] {
  return rows.map((p) => {
    const inv = asRow(p.inventory)
    const name = String(p.productName ?? p.ProductName ?? p.shortName ?? '').trim()
    const shortName = String(p.shortName ?? p.ShortDescription ?? '').trim()
    return {
      id: num(p.productId ?? p.ProductID),
      name,
      sub: shortName && shortName !== name ? shortName : undefined,
      price: num(inv.unitPrice ?? p.unitPrice ?? p.UnitPrice),
      groupId: num(p.groupId ?? p.GroupID),
      subgroupId: num(p.subgroupId ?? p.subGroupId ?? p.SubGroupID),
      subsubgroupId: num(p.subsubgroupId ?? p.subSubGroupId ?? p.SubSubGroupID),
      taxRate: num(inv.outputTax1Rate ?? p.tax1Rate ?? p.Tax1Rate),
      taxAmount: num(inv.outputTax1Amount ?? p.tax1Amount ?? p.Tax1Amount),
      productType: String(p.productType ?? p.ProductType ?? '').trim().toUpperCase(),
      barcode: String(p.barcode ?? p.BarCode ?? p.productCode ?? p.ProductCode ?? '').trim(),
    }
  }).filter((p) => p.id > 0 && p.name)
}

function mapModifiers(rows: Record<string, unknown>[]): ModifierPreset[] {
  return rows.map((m) => ({
    id: num(m.modifierId ?? m.ModifierID),
    name: String(m.modifier ?? m.Modifier ?? '').trim(),
    arabic: String(m.modifierArabic ?? m.ModifierArabic ?? '').trim(),
  })).filter((m) => m.name)
}

function normalizeSupply(raw: unknown): ServiceKind {
  const u = String(raw ?? '').replace(/_/g, ' ').toUpperCase().trim()
  if (u === 'DELIVERY') return 'DELIVERY'
  if (u === 'PARCEL' || u === 'TAKEAWAY' || u === 'TAKE AWAY') return 'TAKEAWAY'
  return 'DINE IN'
}

function areaNameKey(name: string) {
  return name.replace(/[_-]/g, ' ').toUpperCase().replace(/\s+/g, ' ').trim()
}

function areaMatchesService(area: AreaRow, svc: ServiceKind) {
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

function mapAreas(rows: Record<string, unknown>[]): AreaRow[] {
  return rows.map((a) => ({
    id: num(a.areaId ?? a.AreaID ?? a.area_id),
    name: String(a.areaName ?? a.AreaName ?? a.area_name ?? '').trim(),
    supplyType: String(a.supplyType ?? a.SupplyType ?? a.supply_type ?? '').trim(),
    kotPrefix: String(a.kotPrefix ?? a.KotPrefix ?? a.kot_prefix ?? '').trim(),
    tableCreationType: num(a.tableCreationType ?? a.TableCreationType ?? a.table_creation_type),
  })).filter((a) => a.id > 0 && a.name)
}

function tablesForAreaId(areaId: number, tableList: TableRow[]) {
  return tableList.filter((t) => t.areaId === areaId || (areaId > 0 && t.areaId === 0))
}

function isFlpArea(area: AreaRow) {
  const supply = String(area.supplyType ?? '').replace(/_/g, ' ').toUpperCase().trim()
  const name = areaNameKey(area.name)
  if (supply === 'DINE IN' || supply === 'DINEIN') return true
  if ((supply === 'PARCEL' || supply === 'TAKEAWAY' || supply === 'TAKE AWAY') && name !== 'TAKE AWAY' && name !== 'TAKEAWAY') {
    return true
  }
  if (supply === 'DELIVERY' && name !== 'DELIVERY') return true
  return false
}

function flpAreaTone(area: AreaRow) {
  const supply = normalizeSupply(area.supplyType)
  if (supply === 'TAKEAWAY') return 'parcel'
  if (supply === 'DELIVERY') return 'delivery'
  return 'dine'
}

/** OrderListFrm.colorsList — same area always maps to the same colour (by AreaID). */
const AREA_PALETTE = [
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

function areaSwatch(areaId: number, areaName = '') {
  const seed =
    areaId > 0
      ? areaId
      : [...String(areaName)].reduce((n, ch) => n + ch.charCodeAt(0), 0)
  const idx = Math.abs(seed) % AREA_PALETTE.length
  return AREA_PALETTE[idx]
}

function pickDefaultTable(area: AreaRow | null, tableList: TableRow[], keepTableId = 0): TableRow | null {
  if (!area) return null
  const forArea = tablesForAreaId(area.id, tableList)
  return forArea.find((t) => t.id === keepTableId) ?? null
}

function mapOrderRows(rows: Record<string, unknown>[]): OrderRow[] {
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

function kotDetailsRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(asRow)
  const root = asRow(payload)
  const nested = asRow(root.kotDetails)
  const raw = root.data ?? nested.data
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
function kotHeaderRemarks(row: Record<string, unknown>, fallback = ''): string {
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

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** gvUserDesignation = CHIEF CASHIER / ADMIN skips AdminLoginFrm. */
function isChiefCashierOrAdmin() {
  const session = getPosSession()
  const designation = String(session.designation || '').trim().toUpperCase()
  const roleName = String(session.roleName || SessionManager.roleName || '').trim().toUpperCase()
  if (designation === 'CHIEF CASHIER' || designation === 'ADMIN') return true
  if (roleName === 'CHIEF CASHIER' || roleName === 'ADMIN' || roleName === 'OWNER') return true
  return Number(SessionManager.roleId) === 1
}

type AdminCreds = { username: string; password: string }
type AdminNext = 'item-remove' | 'bill-confirm' | 'return' | 'item-qty' | 'counter-close-all' | 'price-change' | 'area-change' | 'discount'
type AlertKind = 'info' | 'success' | 'warning' | 'question'
type AlertBox = { kind: AlertKind; title: string; message: string }

function inferAlertKind(msg: string): AlertKind {
  const m = msg.toLowerCase()
  if (/\bsaved\b|success|completed|successfully/.test(m)) return 'success'
  if (
    /fail|unable|error|not accept|not appl|not found|invalid|required|please select|select a |blocked|cannot|can't|not allowed|different|attention/.test(
      m,
    )
  ) {
    return 'warning'
  }
  return 'info'
}

function inferAlertTitle(kind: AlertKind) {
  if (kind === 'success') return 'Saved'
  if (kind === 'warning') return 'Attention'
  if (kind === 'question') return 'Please Confirm'
  return 'Information'
}

function formatKotClock(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function kotPrintStatus(raw: unknown) {
  if (raw === true || raw === 1) return 'PRINTED'
  const u = String(raw ?? '').trim().toUpperCase()
  if (u === 'PRINTED' || u === 'T' || u === 'TRUE' || u === '1') return 'PRINTED'
  return 'PENDING'
}

/** CalcTotal — SubTotal = qty*price - disc; tax from per-piece VAT unless a line disc exists. */
function calcLine(price: number, qty: number, vatPerPc: number, taxRate: number, itemDisc: number) {
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

function lineNetSubtotal(line: TicketLine) {
  return round2(line.price * line.qty - line.disc)
}

/**
 * Mainfrm.CalcTotal — bill discount (lblDisc) sits on the header.
 * Item discounts already sit in each line SubTotal.
 */
function calcKotTotals(lines: TicketLine[], billDiscount: number, tax1Pct: number, roundOff = 0) {
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

function itemDiscountAllowed(line: TicketLine) {
  return line.groupId > 0
}

function allowedItemDiscountCount(ticket: TicketLine[]) {
  return ticket.reduce((n, l) => n + (itemDiscountAllowed(l) ? 1 : 0), 0)
}

function notAllowedItemDiscountCount(ticket: TicketLine[]) {
  return ticket.reduce((n, l) => n + (itemDiscountAllowed(l) ? 0 : 1), 0)
}

function allowedItemDiscountTotal(ticket: TicketLine[]) {
  return round2(ticket.reduce((n, l) => n + (itemDiscountAllowed(l) ? l.disc : 0), 0))
}

/** GetCurrentItemDiscountPercent — allowed gross (qty*price), not net. */
function currentItemDiscountPercent(ticket: TicketLine[]) {
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

function taxRatesDiffer(ticket: TicketLine[]) {
  if (!ticket.length) return false
  const first = ticket[0].taxRate
  return ticket.some((l) => l.taxRate !== first)
}

function clearAllItemDiscountRows(ticket: TicketLine[]): TicketLine[] {
  return ticket.map((line) => ({
    ...line,
    ...calcLine(line.price, line.qty, line.taxAmount, line.taxRate, 0),
    discPerc: 0,
  }))
}

/** SplitDiscountAmountToItems — `totalDiscount` is a percent 0–100, not an amount. */
function splitDiscountAmountToItems(ticket: TicketLine[], totalDiscount: number): TicketLine[] | null {
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
function reapplyLineDiscount(
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

function BtnIcon({
  icon: Icon,
  size = 14,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  size?: number
}) {
  return (
    <span className="pd-btn-ic" aria-hidden>
      <Icon size={size} strokeWidth={2.2} />
    </span>
  )
}

/** SF Symbol-like dining table (top-down, four seats). */
function TableGlyph({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="22" y="3" width="20" height="11" rx="5.5" fill="currentColor" opacity="0.92" />
      <rect x="22" y="50" width="20" height="11" rx="5.5" fill="currentColor" opacity="0.92" />
      <rect x="3" y="22" width="11" height="20" rx="5.5" fill="currentColor" opacity="0.92" />
      <rect x="50" y="22" width="11" height="20" rx="5.5" fill="currentColor" opacity="0.92" />
      <circle cx="32" cy="32" r="16.5" fill="currentColor" />
      <circle cx="32" cy="32" r="11" fill="none" stroke="#fff" strokeWidth="2.4" opacity="0.55" />
      <circle cx="32" cy="32" r="3.2" fill="#fff" opacity="0.7" />
    </svg>
  )
}

/** SF Symbol-like side chair. */
function ChairGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="16" y="6" width="14" height="34" rx="7" fill="currentColor" />
      <rect x="16" y="28" width="34" height="12" rx="6" fill="currentColor" />
      <rect x="16" y="38" width="7" height="20" rx="3.5" fill="currentColor" />
      <rect x="42" y="38" width="7" height="20" rx="3.5" fill="currentColor" />
      <rect x="20" y="31" width="26" height="6" rx="3" fill="#fff" opacity="0.35" />
    </svg>
  )
}

export default function PosMainPage() {
  const navigate = useNavigate()
  const enrollment = getEnrollment()
  const waiter = SessionManager.staffName || 'ADMIN'
  const counter = enrollment?.stationName || 'Counter 01'
  const lineKey = useRef(1)
  const modifierTextRef = useRef<HTMLTextAreaElement | null>(null)

  const [nav, setNav] = useState<(typeof NAV)[number]>('New Sale')
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false)
  const [reportViewersOpen, setReportViewersOpen] = useState(false)
  const [salesViewerOpen, setSalesViewerOpen] = useState(false)
  const [counterCloseOpen, setCounterCloseOpen] = useState(false)
  const [entryMenuOpen, setEntryMenuOpen] = useState(false)
  const [areaMasterOpen, setAreaMasterOpen] = useState(false)
  const [tableMasterOpen, setTableMasterOpen] = useState(false)
  const [floorDesignOpen, setFloorDesignOpen] = useState(false)
  const reportsMenuRef = useRef<HTMLDivElement | null>(null)
  const entryMenuRef = useRef<HTMLDivElement | null>(null)
  const [groups, setGroups] = useState<Cat[]>([])
  const [allSubGroups, setAllSubGroups] = useState<SubCat[]>([])
  const [allSubSubGroups, setAllSubSubGroups] = useState<SubSubCat[]>([])
  const [allProducts, setAllProducts] = useState<ProductTile[]>([])
  const [modifiers, setModifiers] = useState<ModifierPreset[]>([])
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesText, setNotesText] = useState('')
  const [notesLineKey, setNotesLineKey] = useState<number | null>(null)
  const [alertBox, setAlertBox] = useState<AlertBox | null>(null)
  const alertResolveRef = useRef<((ok: boolean) => void) | null>(null)
  const alertOkRef = useRef<HTMLButtonElement | null>(null)
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; key: number } | null>(null)
  const [qtyChangeOpen, setQtyChangeOpen] = useState(false)
  const [qtyChangeKey, setQtyChangeKey] = useState<number | null>(null)
  const [qtyChangeNew, setQtyChangeNew] = useState('')
  const qtyChangeRef = useRef<HTMLInputElement | null>(null)
  const [priceChangeOpen, setPriceChangeOpen] = useState(false)
  const [priceChangeKey, setPriceChangeKey] = useState<number | null>(null)
  const [priceUnit, setPriceUnit] = useState('')
  const [priceWithVat, setPriceWithVat] = useState('')
  const [priceVatPerc, setPriceVatPerc] = useState(0)
  const [priceFocus, setPriceFocus] = useState<'unit' | 'withVat'>('withVat')
  const [priceError, setPriceError] = useState<string | null>(null)
  const priceUnitRef = useRef<HTMLInputElement | null>(null)
  const priceVatRef = useRef<HTMLInputElement | null>(null)
  const [allowZeroPriceOnBill, setAllowZeroPriceOnBill] = useState(0)
  const [defaultTax1, setDefaultTax1] = useState(0)
  const adminLoginRef = useRef<HTMLInputElement | null>(null)
  const adminPasswordRef = useRef<HTMLInputElement | null>(null)
  const customerSearchRef = useRef<HTMLInputElement | null>(null)
  const customerMobileRef = useRef<HTMLInputElement | null>(null)
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const groupStripRef = useRef<HTMLDivElement | null>(null)
  const groupTouch = useRef({ active: false, pointerId: -1, startY: 0, lastY: 0, moved: false })
  const [stripLevel, setStripLevel] = useState<StripLevel>('group')
  const [groupId, setGroupId] = useState<number | null>(null)
  const [subGroupId, setSubGroupId] = useState<number | null>(null)
  const [subSubGroupId, setSubSubGroupId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<TicketLine[]>([])
  const [selectedLine, setSelectedLine] = useState<number | null>(null)
  const [service, setService] = useState<ServiceKind>('DINE IN')
  const [entry, setEntry] = useState('')
  const [padQty, setPadQty] = useState('1')
  const [now, setNow] = useState(() => new Date())
  const [catalogueState, setCatalogueState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [tables, setTables] = useState<TableRow[]>([])
  const [currentKotId, setCurrentKotId] = useState(0)
  const [kotPrefix, setKotPrefix] = useState('')
  const [kotNo, setKotNo] = useState('')
  const [areaId, setAreaId] = useState(0)
  const [tableId, setTableId] = useState(0)
  const [tableName, setTableName] = useState('')
  const [chairNo, setChairNo] = useState(0)
  const [covers, setCovers] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [billDiscount, setBillDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<0 | 2>(0)
  const [discButtons, setDiscButtons] = useState<[number, number, number]>([5, 10, 15])
  const [tax1Name, setTax1Name] = useState('VAT')
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountMode, setDiscountMode] = useState<-1 | 0 | 2>(-1)
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountBase, setDiscountBase] = useState(0)
  const [discountFocus, setDiscountFocus] = useState<'amount' | 'percent'>('amount')
  const [discountKeyLock, setDiscountKeyLock] = useState<'' | 'amount' | 'percent'>('')
  const [discountError, setDiscountError] = useState<string | null>(null)
  const discountAmountRef = useRef<HTMLInputElement | null>(null)
  const discountPercentRef = useRef<HTMLInputElement | null>(null)
  const [customerId, setCustomerId] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [waiterId, setWaiterId] = useState(() => getPosSession().staffId)
  const [clearAfterKotSave, setClearAfterKotSave] = useState(0)
  const [waiterMandatory, setWaiterMandatory] = useState(0)
  const [savingKot, setSavingKot] = useState(false)
  const [loadingKot, setLoadingKot] = useState(false)
  const [orderListOpen, setOrderListOpen] = useState(false)
  const [kotJoinOpen, setKotJoinOpen] = useState(false)
  const [orderListRows, setOrderListRows] = useState<OrderRow[]>([])
  const [orderListState, setOrderListState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [orderListError, setOrderListError] = useState<string | null>(null)
  const [orderListSearch, setOrderListSearch] = useState('')
  const [orderListSupply, setOrderListSupply] = useState<'ALL' | ServiceKind>('ALL')
  const [orderListAreaId, setOrderListAreaId] = useState(0)
  const [areaOpen, setAreaOpen] = useState(false)
  const [areaChangeOpen, setAreaChangeOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentsDraft, setCommentsDraft] = useState('')
  const [itemCancelOpen, setItemCancelOpen] = useState(false)
  const [itemCancelIds, setItemCancelIds] = useState<Record<number, boolean>>({})
  const [itemCancelQtyOpen, setItemCancelQtyOpen] = useState(false)
  const [itemCancelQtyLine, setItemCancelQtyLine] = useState<TicketLine | null>(null)
  const [itemCancelQtyNew, setItemCancelQtyNew] = useState('')
  const [itemCancelCoversOpen, setItemCancelCoversOpen] = useState(false)
  const [itemCancelCoversDraft, setItemCancelCoversDraft] = useState('1')
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminLogin, setAdminLogin] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminFocus, setAdminFocus] = useState<'login' | 'password'>('login')
  const [adminError, setAdminError] = useState<string | null>(null)
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminNext, setAdminNext] = useState<AdminNext | null>(null)
  const [adminCreds, setAdminCreds] = useState<AdminCreds | null>(null)
  const [billConfirmOpen, setBillConfirmOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [returnBusy, setReturnBusy] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerRows, setCustomerRows] = useState<CustomerPick[]>([])
  const [customerState, setCustomerState] = useState<'idle' | 'loading'>('idle')
  const [customerEntryOpen, setCustomerEntryOpen] = useState(false)
  const [customerEntryName, setCustomerEntryName] = useState('')
  const [customerEntryMobile, setCustomerEntryMobile] = useState('')
  const [customerEntryTel, setCustomerEntryTel] = useState('')
  const [customerEntryAddress, setCustomerEntryAddress] = useState('')
  const [customerEntryError, setCustomerEntryError] = useState<string | null>(null)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [isTablePopupSetting, setIsTablePopupSetting] = useState(0)
  const [isTablePopup, setIsTablePopup] = useState(0)
  const [isTablesBasedOnWaiter, setIsTablesBasedOnWaiter] = useState(0)
  const [, setDefaultAreaName] = useState(1)
  const [tablePopupOpen, setTablePopupOpen] = useState(false)
  const [tableFloorOpen, setTableFloorOpen] = useState(false)
  const [floorMap, setFloorMap] = useState<{
    hasFloor: boolean
    border: { x: number; y: number }[]
    shapes: { shapeType: string; posXPercent: number; posYPercent: number; widthPercent: number; heightPercent: number; backColorArgb?: number | null; displayText?: string }[]
    tables: { tableId: number; tableName: string; noOfChairs: number; tableFormat: string; posXPercent: number; posYPercent: number; widthPercent: number; heightPercent: number }[]
  } | null>(null)
  const [tablePopupMode, setTablePopupMode] = useState<'tables' | 'kots'>('tables')
  const [occupiedKots, setOccupiedKots] = useState<OccupiedKot[]>([])
  const [chairPromptOpen, setChairPromptOpen] = useState(false)
  const [kotSelectOpen, setKotSelectOpen] = useState(false)
  const [coversPrompt, setCoversPrompt] = useState<{ table: TableRow } | null>(null)
  const [coversDraft, setCoversDraft] = useState('1')
  const [saveKotOnSettlement, setSaveKotOnSettlement] = useState(0)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settleBill, setSettleBill] = useState<SettlementBill | null>(null)
  const [settleOpening, setSettleOpening] = useState(false)
  const [lastInfo, setLastInfo] = useState<SettlementDone | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!reportsMenuOpen && !entryMenuOpen) return
    function onDocClick(ev: MouseEvent) {
      const t = ev.target as Node
      if (reportsMenuRef.current && !reportsMenuRef.current.contains(t)) {
        setReportsMenuOpen(false)
        setReportViewersOpen(false)
      }
      if (entryMenuRef.current && !entryMenuRef.current.contains(t)) {
        setEntryMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [reportsMenuOpen, entryMenuOpen])

  useEffect(() => {
    if (!lastInfo) return
    const t = window.setTimeout(() => setLastInfo(null), 60_000)
    return () => window.clearTimeout(t)
  }, [lastInfo])

  useEffect(() => {
    if (!alertBox) return
    const t = window.setTimeout(() => alertOkRef.current?.focus(), 0)
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeAlert(e.key === 'Enter')
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [alertBox])

  useEffect(() => {
    if (!adminOpen) return
    setAdminFocus('login')
    const t = window.setTimeout(() => adminLoginRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [adminOpen])

  useEffect(() => {
    if (!notesOpen) return
    const t = window.setTimeout(() => {
      modifierTextRef.current?.focus()
      const el = modifierTextRef.current
      if (el) el.setSelectionRange(el.value.length, el.value.length)
    }, 0)
    return () => window.clearTimeout(t)
  }, [notesOpen])

  useEffect(() => {
    const el = groupStripRef.current
    if (el) el.scrollTop = 0
  }, [stripLevel, groupId, subGroupId])

  useEffect(() => {
    if (!qtyChangeOpen) return
    const t = window.setTimeout(() => qtyChangeRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [qtyChangeOpen])

  useEffect(() => {
    if (!priceChangeOpen) return
    const t = window.setTimeout(() => {
      if (priceFocus === 'unit') priceUnitRef.current?.focus()
      else priceVatRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [priceChangeOpen, priceFocus])

  useEffect(() => {
    if (!discountOpen) return
    const t = window.setTimeout(() => {
      if (discountFocus === 'percent') discountPercentRef.current?.focus()
      else discountAmountRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [discountOpen, discountFocus])

  useEffect(() => {
    if (!rowMenu) return
    const close = () => setRowMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [rowMenu])

  useEffect(() => {
    let alive = true
    setCatalogueState('loading')
    Promise.all([
      apiService.fetchGroups(),
      apiService.fetchProducts({ limit: 2000 }),
      apiService.fetchSubGroups().catch(() => []),
      apiService.fetchSubSubGroups().catch(() => []),
      apiService.fetchModifiers().catch(() => []),
    ])
      .then(([groupRows, productRows, subGroupRows, subSubRows, modifierRows]) => {
        if (!alive) return
        const cats = mapGroups(groupRows)
        const tiles = mapProducts(productRows).filter((p) =>
          cats.length ? cats.some((c) => c.id === p.groupId) : true,
        )
        const groupIds = new Set(cats.map((c) => c.id))
        setGroups(cats)
        setAllSubGroups(mapSubGroups(subGroupRows).filter((s) => groupIds.has(s.groupId)))
        setAllSubSubGroups(mapSubSubGroups(subSubRows))
        setAllProducts(tiles)
        setModifiers(mapModifiers(modifierRows))
        setStripLevel('group')
        setGroupId(null)
        setSubGroupId(null)
        setSubSubGroupId(null)
        setCatalogueState('ready')
      })
      .catch((err) => {
        if (!alive) return
        setCatalogueError(err instanceof Error ? err.message : 'Could not load menu')
        setCatalogueState('error')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([
      apiService.fetchAreas().catch(() => []),
      apiService.fetchTables().catch(() => []),
      apiService.fetchParameters().catch(() => ({})),
    ]).then(([areaRows, tableRows, params]) => {
      if (!alive) return
      const mapped = mapAreas(areaRows)
      const tableMapped = tableRows.map((t) => ({
        id: Number(t.id) || 0,
        name: t.label,
        areaId: Number(t.areaId) || 0,
        seats: t.seats,
        waiterId: Number(t.waiterId) || 0,
        tableNo: Number(t.tableNo) || 0,
        format: String(t.format ?? 'SQUARE'),
      })).filter((t) => t.id > 0)
      setAreas(mapped)
      setTables(tableMapped)
      const p = asRow(params)
      setClearAfterKotSave(num(p.ClearAfterKOTSave ?? p.clearAfterKotSave))
      setSaveKotOnSettlement(num(p.SaveKOTonSettlement ?? p.saveKotOnSettlement))
      setWaiterMandatory(num(p.ISWaiterMandotory ?? p.ISWaiterMandatory ?? p.isWaiterMandatory))
      setAllowZeroPriceOnBill(num(p.AllowZeroPriceOnBill ?? p.allowZeroPriceOnBill ?? p.allow_zero_price_on_bill))
      setDefaultTax1(num(p.Tax1 ?? p.tax1 ?? p.gvTax1Percentage))
      setTax1Name(String(p.Tax1Name ?? p.gvTax1 ?? p.tax1Name ?? 'VAT') || 'VAT')
      setDiscButtons([
        num(p.DiscountButton1 ?? p.discountButton1) || 5,
        num(p.DiscountButton2 ?? p.discountButton2) || 10,
        num(p.DiscountButton3 ?? p.discountButton3) || 15,
      ])
      const popup = num(p.IsTablePopup ?? p.isTablePopup ?? p.is_table_popup)
      const defaultAreaFlag =
        p.DefaultAreaName != null || p.defaultAreaName != null || p.default_area_name != null
          ? num(p.DefaultAreaName ?? p.defaultAreaName ?? p.default_area_name)
          : 1
      setIsTablePopupSetting(popup === 1 ? 1 : 0)
      setIsTablePopup(0)
      setIsTablesBasedOnWaiter(num(p.IsTablesBasedOnWaiter ?? p.isTablesBasedOnWaiter ?? p.is_tables_based_on_waiter))
      setDefaultAreaName(defaultAreaFlag)
      setAreaId(0)
      setTableId(0)
      setTableName('')
      setChairNo(0)
      setCustomerId(0)
      setCustomerName('')
      setCurrentKotId(0)
      setKotNo('')
      setKotPrefix('')
      setTablePopupOpen(false)
      setTableFloorOpen(false)
      if (defaultAreaFlag === 1) {
        const takeAway = mapped.find((a) => {
          const n = areaNameKey(a.name)
          return n === 'TAKE AWAY' || n === 'TAKEAWAY'
        }) ?? mapped.find((a) => normalizeSupply(a.supplyType) === 'TAKEAWAY')
        if (takeAway) applyArea(takeAway, 0, tableMapped)
      }
    }).catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  async function reloadFloorMasters() {
    try {
      const [areaRows, tableRows] = await Promise.all([
        apiService.fetchAreas().catch(() => []),
        apiService.fetchTables().catch(() => []),
      ])
      const mapped = mapAreas(areaRows)
      const tableMapped = tableRows
        .map((t) => ({
          id: Number(t.id) || 0,
          name: t.label,
          areaId: Number(t.areaId) || 0,
          seats: t.seats,
          waiterId: Number(t.waiterId) || 0,
          tableNo: Number(t.tableNo) || 0,
          format: String(t.format ?? 'SQUARE'),
        }))
        .filter((t) => t.id > 0)
      setAreas(mapped)
      setTables(tableMapped)
    } catch {
      /* keep current floor */
    }
  }

  const groupSubs = useMemo(
    () => (groupId == null ? [] : allSubGroups.filter((s) => s.groupId === groupId)),
    [allSubGroups, groupId],
  )
  const subSubs = useMemo(
    () => (subGroupId == null ? [] : allSubSubGroups.filter((s) => s.subGroupId === subGroupId)),
    [allSubSubGroups, subGroupId],
  )

  const stripButtons = useMemo(() => {
    if (stripLevel === 'subsub') return subSubs.map((s) => ({ id: s.id, name: s.name, kind: 'subsub' as const }))
    if (stripLevel === 'subgroup') return groupSubs.map((s) => ({ id: s.id, name: s.name, kind: 'sub' as const }))
    return groups.map((g) => ({ id: g.id, name: g.name, kind: 'group' as const }))
  }, [stripLevel, subSubs, groupSubs, groups])

  const activeStripId =
    stripLevel === 'subsub' ? subSubGroupId : stripLevel === 'subgroup' ? subGroupId : groupId

  const crumb = useMemo(() => {
    const g = groups.find((x) => x.id === groupId)?.name
    const s = groupSubs.find((x) => x.id === subGroupId)?.name
    const ss = subSubs.find((x) => x.id === subSubGroupId)?.name
    return [g, s, ss].filter(Boolean).join(' > ')
  }, [groups, groupSubs, subSubs, groupId, subGroupId, subSubGroupId])

  const products = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allProducts.filter((p) => {
      if (q) return `${p.name} ${p.sub ?? ''} ${p.price}`.toLowerCase().includes(q)
      if (groupId == null) return false
      if (p.groupId !== groupId) return false
      if (subGroupId != null && p.subgroupId !== subGroupId) return false
      if (subSubGroupId != null && p.subsubgroupId !== subSubGroupId) return false
      return true
    })
  }, [allProducts, groupId, subGroupId, subSubGroupId, query])

  const summary = useMemo(
    () => calcKotTotals(lines, billDiscount, defaultTax1, 0),
    [lines, billDiscount, defaultTax1],
  )
  const discPreviewAmt = Number(discountAmount)
  const discPreviewVal = Number.isFinite(discPreviewAmt) ? discPreviewAmt : 0
  const discTaxable = round2(discountBase - discPreviewVal)
  const discTax = round2(discTaxable * (defaultTax1 / 100))
  const discNet = round2(discTaxable + discTax)
  const discTaxLabel = `${tax1Name} @${defaultTax1}%`
  const discModeOn = discountMode === 0 || discountMode === 2
  const discBillAllowed = notAllowedItemDiscountCount(lines) <= 0

  const currentArea = areas.find((a) => a.id === areaId) ?? null
  const flpAreas = useMemo(
    () =>
      areas.filter(isFlpArea).sort((a, b) => {
        const rank = (x: AreaRow) => {
          const s = String(x.supplyType ?? '').toUpperCase()
          if (s.includes('DELIVERY')) return 0
          if (s.includes('DINE')) return 1
          return 2
        }
        return rank(a) - rank(b) || a.name.localeCompare(b.name)
      }),
    [areas],
  )
  const tablesInArea = useMemo(
    () => tables.filter((t) => t.areaId === areaId || (areaId > 0 && t.areaId === 0)),
    [tables, areaId],
  )
  const tablesForArea = useMemo(() => {
    let list = tablesInArea
    if (isTablesBasedOnWaiter === 1) {
      const designation = String(getPosSession().designation || '').trim().toUpperCase()
      if (designation === 'WAITER') {
        const staffId = getPosSession().staffId
        list = list.filter((t) => t.waiterId === staffId)
      }
    }
    return list
  }, [tablesInArea, isTablesBasedOnWaiter])
  const kotLabel = currentKotId > 0 ? `${kotPrefix}${kotNo}` || String(currentKotId) : 'NEW'
  const areaNeedsTable = currentArea != null && currentArea.tableCreationType === 0
  const occupiedByTable = useMemo(() => {
    const map = new Map<number, OccupiedKot[]>()
    for (const row of occupiedKots) {
      if (row.tableId <= 0) continue
      const list = map.get(row.tableId) ?? []
      list.push(row)
      map.set(row.tableId, list)
    }
    return map
  }, [occupiedKots])

  useEffect(() => {
    if (!tableFloorOpen || areaId <= 0) {
      setFloorMap(null)
      return
    }
    let alive = true
    apiService
      .fetchFloorDesign(areaId)
      .then((data) => {
        if (!alive) return
        const border = Array.isArray(data.border)
          ? (data.border as Record<string, unknown>[]).map((p) => ({
              x: num(p.posXPercent ?? p.x),
              y: num(p.posYPercent ?? p.y),
            }))
          : []
        const shapes = Array.isArray(data.shapes)
          ? (data.shapes as Record<string, unknown>[]).map((s) => ({
              shapeType: String(s.shapeType ?? 'ZONE'),
              posXPercent: num(s.posXPercent),
              posYPercent: num(s.posYPercent),
              widthPercent: num(s.widthPercent),
              heightPercent: num(s.heightPercent),
              backColorArgb: s.backColorArgb == null ? null : num(s.backColorArgb),
              displayText: String(s.displayText ?? ''),
            }))
          : []
        const layoutTables = Array.isArray(data.tables)
          ? (data.tables as Record<string, unknown>[]).map((t) => ({
              tableId: num(t.tableId),
              tableName: String(t.tableName ?? ''),
              noOfChairs: num(t.noOfChairs),
              tableFormat: String(t.tableFormat ?? 'SQUARE'),
              posXPercent: num(t.posXPercent),
              posYPercent: num(t.posYPercent),
              widthPercent: num(t.widthPercent) || 6.67,
              heightPercent: num(t.heightPercent) || 8.57,
            }))
          : []
        setFloorMap({
          hasFloor: Boolean(data.hasFloor) && border.length >= 3,
          border,
          shapes,
          tables: layoutTables,
        })
      })
      .catch(() => {
        if (alive) setFloorMap({ hasFloor: false, border: [], shapes: [], tables: [] })
      })
    return () => {
      alive = false
    }
  }, [tableFloorOpen, areaId])

  function pendingQty() {
    const n = Number(padQty)
    if (Number.isFinite(n) && n !== 0) return n
    return 1
  }

  function clearQty() {
    setPadQty('1')
    setEntry('')
  }

  /** btnQty_Click: lock keypad number into txtQty for the next item. */
  function onQtyClick() {
    const n = Number(entry)
    if (Number.isFinite(n) && n > 0) {
      setPadQty(String(n))
      setEntry('')
    }
  }

  function endGroupTouch(pointerId: number) {
    const el = groupStripRef.current
    if (el && el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
    el?.classList.remove('is-dragging')
    groupTouch.current.active = false
  }

  function onGroupStripPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    groupTouch.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      moved: false,
    }
  }

  function onGroupStripPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const t = groupTouch.current
    const el = groupStripRef.current
    if (!t.active || t.pointerId !== e.pointerId || !el) return
    const dy = t.lastY - e.clientY
    if (!t.moved && Math.abs(e.clientY - t.startY) < 8) return
    t.moved = true
    if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId)
    el.scrollTop += dy
    t.lastY = e.clientY
    el.classList.add('is-dragging')
    e.preventDefault()
  }

  function onGroupStripPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (groupTouch.current.pointerId !== e.pointerId) return
    endGroupTouch(e.pointerId)
  }

  function onStripTap(action: () => void) {
    if (groupTouch.current.moved) return
    action()
  }

  function onGroupClick(id: number) {
    dismissTableSelectionUi()
    const subs = allSubGroups.filter((s) => s.groupId === id)
    setGroupId(id)
    setSubGroupId(null)
    setSubSubGroupId(null)
    if (subs.length) {
      setStripLevel('subgroup')
    } else {
      setStripLevel('group')
    }
  }

  function onSubGroupClick(id: number) {
    dismissTableSelectionUi()
    const next = allSubSubGroups.filter((s) => s.subGroupId === id)
    setSubGroupId(id)
    setSubSubGroupId(null)
    if (next.length) setStripLevel('subsub')
    else setStripLevel('subgroup')
  }

  function onSubSubClick(id: number) {
    dismissTableSelectionUi()
    setSubSubGroupId(id)
    setStripLevel('subsub')
  }

  function onBack() {
    dismissTableSelectionUi()
    setStripLevel('group')
    setSubGroupId(null)
    setSubSubGroupId(null)
  }

  function onItemClick(p: ProductTile) {
    const qty = pendingQty()
    if (!Number.isFinite(qty) || qty === 0) {
      clearQty()
      return
    }
    if (p.productType === 'COMBO') {
      toast('Select combo items from the combo screen')
      clearQty()
      return
    }
    if (p.price <= 0) {
      toast('Invalid Price..........')
      clearQty()
      return
    }
    const price = round2(p.price)
    const existing = lines.find(
      (l) =>
        l.productId === p.id &&
        round2(l.price) === price &&
        kotPrintStatus(l.androidPrint) !== 'PRINTED',
    )
    if (existing) {
      const nextQty = existing.qty + qty
      const next = reapplyLineDiscount(existing, discountType, nextQty, existing.price, existing.taxAmount)
      setLines((prev) =>
        prev.map((l) => (l.key === existing.key ? next : l)),
      )
      setSelectedLine(existing.key)
    } else {
      const key = lineKey.current++
      const vatPerPc = p.taxAmount > 0 ? p.taxAmount : round2(price * (p.taxRate / 100))
      setLines((prev) => [
        ...prev,
        {
          key,
          productId: p.id,
          item: p.name,
          modifiers: '',
          qty,
          price,
          taxRate: p.taxRate,
          taxAmount: vatPerPc,
          productType: p.productType,
          kotPending: true,
          kotChildId: 0,
          groupId: p.groupId,
          barcode: p.barcode || '',
          androidPrint: 'PENDING',
          kotDisplayStatus: 'PENDING',
          ...calcLine(price, qty, vatPerPc, p.taxRate, 0),
        },
      ])
      setSelectedLine(key)
    }
    clearQty()
  }

  function onKey(k: string) {
    if (k === 'C') {
      setEntry('')
      return
    }
    if (k === '.' && entry.includes('.')) return
    setEntry((prev) => (prev + k).slice(0, 8))
  }

  function deleteSelected() {
    if (selectedLine == null) return
    const line = lines.find((l) => l.key === selectedLine)
    if (line && !line.kotPending) {
      toast('Use Item Cancel...')
      return
    }
    setLines((prev) => prev.filter((l) => l.key !== selectedLine))
    setSelectedLine(null)
  }

  const notesLine = notesLineKey == null ? null : lines.find((l) => l.key === notesLineKey) ?? null

  function openModifierForm(ticketKey: number) {
    const line = lines.find((l) => l.key === ticketKey)
    if (!line) {
      toast('No Item Found...')
      return
    }
    setRowMenu(null)
    setSelectedLine(ticketKey)
    setNotesLineKey(ticketKey)
    setNotesText(line.modifiers ?? '')
    setNotesOpen(true)
    if (modifiers.length === 0) {
      apiService.fetchModifiers()
        .then((rows) => setModifiers(mapModifiers(rows)))
        .catch(() => {})
    }
  }

  function openModifierForSelection() {
    const key = selectedLine ?? lines[lines.length - 1]?.key
    if (key == null) {
      toast('No Item Found...')
      return
    }
    openModifierForm(key)
  }

  function appendModifier(name: string) {
    const label = name.trim()
    if (!label) return
    setNotesText((prev) => (prev ? `${prev}-${label}` : label))
  }

  function applyModifier() {
    if (notesLineKey == null) {
      setNotesOpen(false)
      return
    }
    setLines((prev) => prev.map((l) => (l.key === notesLineKey ? { ...l, modifiers: notesText } : l)))
    setNotesOpen(false)
  }

  function closeModifierForm() {
    setNotesOpen(false)
  }

  const qtyChangeLine = qtyChangeKey == null ? null : lines.find((l) => l.key === qtyChangeKey) ?? null

  /** btnQtyChange_Click / context "Change Qty" → QtyChangefrm */
  function openQtyChange(ticketKey?: number) {
    setRowMenu(null)
    const key = ticketKey ?? selectedLine
    if (key == null || lines.length === 0) {
      toast('No Item Found...')
      return
    }
    const line = lines.find((l) => l.key === key)
    if (!line) {
      toast('No Item Found...')
      return
    }
    if (!line.kotPending) {
      toast('Change Qty From Item Cancel...')
      return
    }
    if (line.productType === 'COMBO') {
      toast('Change Qty Of Combo item.......')
      return
    }
    setSelectedLine(key)
    setQtyChangeKey(key)
    setQtyChangeNew('')
    setQtyChangeOpen(true)
  }

  function onQtyChangeKey(k: string) {
    if (k === 'C') {
      setQtyChangeNew((prev) => prev.slice(0, -1))
      return
    }
    if (k === '.' && qtyChangeNew.includes('.')) return
    setQtyChangeNew((prev) => (prev + k).slice(0, 8))
  }

  function applyQtyChange() {
    const n = Number(qtyChangeNew)
    if (!(n > 0 && n < 999999)) {
      toast('Qty Price Not Acceptable.........')
      return
    }
    if (qtyChangeKey == null) {
      setQtyChangeOpen(false)
      return
    }
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== qtyChangeKey) return l
        return reapplyLineDiscount(l, discountType, n, l.price, l.taxAmount)
      }),
    )
    setQtyChangeOpen(false)
  }

  function cancelQtyChange() {
    setQtyChangeOpen(false)
  }

  const priceChangeLine = priceChangeKey == null ? null : lines.find((l) => l.key === priceChangeKey) ?? null

  function showPriceChangeDialog(key: number) {
    const line = lines.find((l) => l.key === key)
    if (!line) {
      toast('No Item Found...')
      return
    }
    const vatPerc = line.taxRate > 0 ? line.taxRate : defaultTax1
    const vatAmt = round2(line.price * (vatPerc / 100))
    setSelectedLine(key)
    setPriceChangeKey(key)
    setPriceUnit('')
    setPriceWithVat(money(line.price + vatAmt))
    setPriceVatPerc(vatPerc)
    setPriceFocus('withVat')
    setPriceError(null)
    setPriceChangeOpen(true)
  }

  /** btnPriceChange_Click — admin unless CHIEF CASHIER / ADMIN. Context menu skips admin. */
  function openPriceChange(ticketKey?: number, fromMenu = false) {
    setRowMenu(null)
    const key = ticketKey ?? selectedLine
    if (key == null || lines.length === 0) {
      toast('No Item Found...')
      return
    }
    if (!lines.some((l) => l.key === key)) {
      toast('No Item Found...')
      return
    }
    setPriceChangeKey(key)
    setSelectedLine(key)
    if (!fromMenu && !isChiefCashierOrAdmin()) {
      requestAdmin('price-change')
      return
    }
    showPriceChangeDialog(key)
  }

  function padPriceField(prev: string, k: string) {
    if (k === 'C') return prev.slice(0, -1)
    if (k === '.' && prev.includes('.')) return prev
    if (k === '.' && prev === '') return '0.'
    return `${prev}${k}`.slice(0, 12)
  }

  function syncFromUnit(raw: string) {
    setPriceUnit(raw)
    const p = Number(raw)
    if (!Number.isFinite(p)) return
    const vat = p * (priceVatPerc / 100)
    setPriceWithVat(money(p + vat))
  }

  function syncFromWithVat(raw: string) {
    setPriceWithVat(raw)
    const w = Number(raw)
    if (!Number.isFinite(w) || w <= 0) return
    const p = priceVatPerc > 0 ? (100 / (100 + priceVatPerc)) * w : w
    setPriceUnit(money(p))
  }

  function onPricePadKey(k: string) {
    if (priceFocus === 'unit') syncFromUnit(padPriceField(priceUnit, k))
    else syncFromWithVat(padPriceField(priceWithVat, k))
  }

  function applyPriceChange() {
    const newPrice = Number(priceUnit)
    if (newPrice > 0 && newPrice < 999999) {
      commitPriceChange(newPrice)
      return
    }
    if (newPrice === 0 && allowZeroPriceOnBill === 1) {
      commitPriceChange(0)
      return
    }
    setPriceError('Zero Price Not Acceptable.........')
  }

  function commitPriceChange(newPrice: number) {
    if (priceChangeKey == null) {
      setPriceChangeOpen(false)
      return
    }
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== priceChangeKey) return l
        const vatPerPc = round2(newPrice * ((l.taxRate || 0) / 100))
        return reapplyLineDiscount(l, discountType, l.qty, newPrice, vatPerPc)
      }),
    )
    setPriceChangeOpen(false)
    setPriceError(null)
  }

  function cancelPriceChange() {
    setPriceChangeOpen(false)
    setPriceError(null)
  }

  function savedKotLines() {
    return lines.filter((l) => !l.kotPending && l.kotChildId > 0)
  }

  function closeAdminDialog() {
    setAdminOpen(false)
    setAdminBusy(false)
    setAdminError(null)
    setAdminPassword('')
    setAdminFocus('login')
    setAdminNext(null)
  }

  function focusAdminField(field: 'login' | 'password') {
    setAdminFocus(field)
    const el = field === 'login' ? adminLoginRef.current : adminPasswordRef.current
    window.setTimeout(() => el?.focus(), 0)
  }

  /** AdminLoginFrm.num / btnClear — keypad writes into the focused box. */
  function onAdminPadKey(k: string) {
    if (adminBusy) return
    const apply = (prev: string) => {
      if (k === 'C') return prev.slice(0, -1)
      return (prev + k).slice(0, 40)
    }
    if (adminFocus === 'password') setAdminPassword(apply)
    else setAdminLogin(apply)
  }

  function onAdminLoginKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!adminLogin.trim()) {
      setAdminError('Enter Login Name...')
      return
    }
    focusAdminField('password')
  }

  function onAdminPasswordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void submitAdminLogin()
  }

  function requestAdmin(next: AdminNext, force = false) {
    if (!force && isChiefCashierOrAdmin()) {
      setAdminCreds(null)
      if (next === 'item-remove') void runItemRemove(null)
      else if (next === 'bill-confirm') setBillConfirmOpen(true)
      else if (next === 'return') void runReturn()
      else if (next === 'item-qty') void runItemQtyChange(null)
      else if (next === 'counter-close-all') setCounterCloseOpen(true)
      else if (next === 'price-change') showPriceChangeDialog(priceChangeKey ?? selectedLine ?? -1)
      else if (next === 'area-change') setAreaChangeOpen(true)
      else if (next === 'discount') openDiscountDialog()
      return
    }
    setAdminNext(next)
    setAdminLogin('')
    setAdminPassword('')
    setAdminFocus('login')
    setAdminError(null)
    setAdminOpen(true)
  }

  /** btnItemCancel_Click — CurrentKOTID required, then ItemRemovefrm. */
  function onItemCancelClick() {
    if (currentKotId <= 0) {
      toast('Please Select A KOT.......')
      return
    }
    const saved = savedKotLines()
    if (!saved.length) {
      toast('Please Select A KOT.......')
      return
    }
    const next: Record<number, boolean> = {}
    for (const line of saved) next[line.kotChildId] = false
    setItemCancelIds(next)
    setItemCancelQtyOpen(false)
    setItemCancelQtyLine(null)
    setItemCancelQtyNew('')
    setItemCancelCoversOpen(false)
    setItemCancelCoversDraft(String(covers > 0 ? covers : 1))
    setItemCancelOpen(true)
  }

  /** btnBillCancel_Click — admin first, then confirm. */
  function onBillCancelClick() {
    if (currentKotId <= 0) {
      toast('Select A KOT........')
      clearQty()
      return
    }
    requestAdmin('bill-confirm')
  }

  /** btnReturn_Click — admin first, then LoadSalesData(bill) or negate txtQty. */
  function onReturnClick() {
    if (returnBusy) return
    requestAdmin('return')
  }

  async function runReturn() {
    const billNo = Number(entry)
    if (Number.isFinite(billNo) && billNo !== 0) {
      await loadSalesData(billNo)
      setEntry('')
      return
    }
    const q = Number(padQty)
    const base = Number.isFinite(q) && q !== 0 ? q : 1
    setPadQty(String(base * -1))
  }

  /** LoadSalesData — bill lines as negative qty, CurrentKOTID = 0. */
  async function loadSalesData(billNo: number) {
    setReturnBusy(true)
    try {
      const payload = await apiService.fetchSaleByBill(billNo)
      const items = Array.isArray(payload.items) ? payload.items : []
      if (!items.length) {
        toast(`Bill No : ${billNo} Not found..............`)
        return
      }
      applyReturnBill(payload, items)
    } catch (err) {
      toast(errMessage(err, `Bill No : ${billNo} Not found..............`))
    } finally {
      setReturnBusy(false)
    }
  }

  function applyReturnBill(payload: Record<string, unknown>, items: Record<string, unknown>[]) {
    const nextLines: TicketLine[] = items.map((row) => {
      const origQty = num(row.qty ?? row.Qty)
      const qty = round2(-1 * origQty)
      const price = num(row.unitPrice ?? row.UnitPrice)
      const disc = num(row.discount ?? row.Discount ?? row.itemDisc ?? row.ItemDisc)
      const taxLine = num(row.tax1AmountC ?? row.Tax1AmountC)
      const taxRate = num(row.tax1RateC ?? row.Tax1RateC)
      const productId = num(row.productId ?? row.ProductID)
      const tile = allProducts.find((x) => x.id === productId)
      const absQty = Math.abs(origQty) || 1
      const vatPerPc =
        absQty > 0 && taxLine !== 0 ? round2(Math.abs(taxLine) / absQty) : tile?.taxAmount || 0
      const calced = calcLine(price, qty, vatPerPc, taxRate || tile?.taxRate || 0, disc)
      return {
        key: lineKey.current++,
        productId,
        item: String(row.shortDescription ?? row.ShortDescription ?? tile?.name ?? 'Item'),
        modifiers: String(row.modifier ?? row.Modifier ?? ''),
        qty,
        price,
        disc: calced.disc,
        discPerc: calced.discPerc,
        tax: calced.tax,
        total: calced.total,
        taxRate: taxRate || tile?.taxRate || 0,
        taxAmount: vatPerPc,
        productType: String(tile?.productType ?? '').trim().toUpperCase(),
        kotPending: true,
        kotChildId: 0,
        groupId: num(row.groupId ?? row.GroupID) || tile?.groupId || 0,
        barcode: String(row.barcode ?? row.BarCode ?? tile?.barcode ?? ''),
        androidPrint: 'PENDING',
        kotDisplayStatus: 'PENDING',
      }
    })
    setLines((prev) => [...prev, ...nextLines])
    setSelectedLine(nextLines[nextLines.length - 1]?.key ?? null)
    setCurrentKotId(0)
    setKotPrefix('')
    setKotNo('')
    const nextAreaId = num(payload.areaId ?? payload.AreaID)
    if (nextAreaId > 0) {
      setAreaId(nextAreaId)
      const area = areas.find((a) => a.id === nextAreaId)
      if (area) setService(normalizeSupply(area.supplyType))
    }
    const nextTableId = num(payload.tableId ?? payload.TableID)
    setTableId(nextTableId)
    setTableName(
      String(payload.tableName ?? payload.TableName ?? '')
        || tables.find((t) => t.id === nextTableId)?.name
        || '',
    )
    setChairNo(1)
    setCovers(Math.max(1, num(payload.noOfCustomers ?? payload.NofCustomer) || 1))
    setRemarks(String(payload.remarks ?? payload.Remarks ?? ''))
    setCustomerId(num(payload.customerId ?? payload.CustomerID))
    setCustomerName(String(payload.customerName ?? payload.CustomerName ?? ''))
    const loadedWaiter = num(payload.waiterId ?? payload.WaiterID)
    setWaiterId(loadedWaiter > 0 ? loadedWaiter : getPosSession().staffId)
  }


  async function submitAdminLogin() {
    const username = adminLogin.trim()
    const password = adminPassword
    if (!username) {
      setAdminError('Enter Login Name...')
      focusAdminField('login')
      return
    }
    if (!password) {
      setAdminError('Enter Password...')
      focusAdminField('password')
      return
    }
    setAdminBusy(true)
    setAdminError(null)
    try {
      const result = await apiService.verifyAdmin(username, password)
      if (result.ok === false || Number(result.IsAdmin) === 0) {
        setAdminError(String(result.message || 'Password Failed...'))
        setAdminPassword('')
        focusAdminField('password')
        return
      }
      const creds = { username, password }
      const next = adminNext
      setAdminCreds(creds)
      setAdminOpen(false)
      setAdminPassword('')
      setAdminNext(null)
      if (next === 'item-remove') await runItemRemove(creds)
      else if (next === 'bill-confirm') setBillConfirmOpen(true)
      else if (next === 'return') await runReturn()
      else if (next === 'item-qty') await runItemQtyChange(creds)
      else if (next === 'counter-close-all') setCounterCloseOpen(true)
      else if (next === 'price-change') showPriceChangeDialog(priceChangeKey ?? selectedLine ?? -1)
      else if (next === 'area-change') setAreaChangeOpen(true)
      else if (next === 'discount') openDiscountDialog()
    } catch (err) {
      setAdminError(errMessage(err, 'Password Failed...'))
      setAdminPassword('')
      focusAdminField('password')
    } finally {
      setAdminBusy(false)
    }
  }

  /** ItemRemovefrm.btnremove_Click */
  function onItemRemoveClick() {
    requestAdmin('item-remove')
  }

  function closeItemCancel() {
    setItemCancelOpen(false)
    setItemCancelQtyOpen(false)
    setItemCancelQtyLine(null)
    setItemCancelQtyNew('')
    setItemCancelCoversOpen(false)
  }

  function applyKotAfterItemCancel(details: unknown, closeDialog: boolean) {
    if (details) applyKotDetails(details, allProducts, false)
    const rows = kotDetailsRows(details)
    const next: Record<number, boolean> = {}
    for (const row of rows) {
      const id = num(row.KotChildID ?? row.kotChildID ?? row.KOTChildID ?? row.dgvKOTChildID)
      if (id > 0) next[id] = false
    }
    setItemCancelIds(next)
    setItemCancelQtyOpen(false)
    setItemCancelQtyLine(null)
    if (closeDialog || !rows.length) closeItemCancel()
  }

  async function runItemRemove(creds: AdminCreds | null) {
    if (currentKotId <= 0) {
      toast('Please Select A KOT.......')
      return
    }
    const saved = savedKotLines()
    if (saved.length <= 1) {
      toast('Only one item Remains in KOT.You have to make BILL CANCEL.......')
      return
    }
    const selectedIds = saved.filter((l) => itemCancelIds[l.kotChildId]).map((l) => l.kotChildId)
    if (!selectedIds.length) {
      toast('Select an Item. . .')
      return
    }
    if (selectedIds.length >= saved.length) {
      toast('All Items Cannot Remove..Make Cancel Bill. . .')
      return
    }
    setCancelBusy(true)
    try {
      const result = await apiService.cancelKotItems(currentKotId, selectedIds, {
        username: creds?.username,
        password: creds?.password,
      })
      if (result.discountReset) toast('Discount Reset....... ')
      const details = result.kotDetails
      if (details) applyKotAfterItemCancel(details, false)
      else {
        const fresh = await apiService.fetchKotDetails(String(currentKotId))
        applyKotAfterItemCancel(fresh, false)
      }
      setAdminCreds(null)
    } catch (err) {
      toast(errMessage(err, 'Unable To Cancel Item'))
    } finally {
      setCancelBusy(false)
      clearQty()
    }
  }

  /** dgvItemList Qty column → pnlQtyChange */
  function openItemCancelQty(line: TicketLine) {
    if (cancelBusy) return
    if (line.productType === 'COMBO') {
      toast('Change Qty Of Combo item.......')
      return
    }
    setItemCancelQtyLine(line)
    setItemCancelQtyNew('')
    setItemCancelQtyOpen(true)
  }

  function onItemCancelQtyKey(k: string) {
    if (k === 'C') {
      setItemCancelQtyNew((prev) => prev.slice(0, -1))
      return
    }
    if (k === '.' && itemCancelQtyNew.includes('.')) return
    setItemCancelQtyNew((prev) => (prev + k).slice(0, 8))
  }

  function onItemCancelQtyDone() {
    const n = Number(itemCancelQtyNew)
    if (!(n > 0)) {
      toast('Invalid Qty. . .')
      return
    }
    requestAdmin('item-qty')
  }

  async function runItemQtyChange(creds: AdminCreds | null) {
    if (currentKotId <= 0 || !itemCancelQtyLine) {
      toast('Please Select A KOT.......')
      return
    }
    const n = Number(itemCancelQtyNew)
    if (!(n > 0)) {
      toast('Invalid Qty. . .')
      return
    }
    setCancelBusy(true)
    try {
      const result = await apiService.updateKotItemQty(
        currentKotId,
        itemCancelQtyLine.kotChildId,
        n,
        { username: creds?.username, password: creds?.password },
      )
      const details = result.kotDetails
      if (details) applyKotAfterItemCancel(details, true)
      else {
        const fresh = await apiService.fetchKotDetails(String(currentKotId))
        applyKotAfterItemCancel(fresh, true)
      }
      setAdminCreds(null)
    } catch (err) {
      toast(errMessage(err, 'Unable To Change Qty'))
    } finally {
      setCancelBusy(false)
      clearQty()
    }
  }

  async function saveItemCancelCovers() {
    if (currentKotId <= 0) {
      toast('Select a KOT first.')
      return
    }
    const n = Math.trunc(Number(itemCancelCoversDraft))
    if (!(n > 0)) return
    if (n === covers) {
      setItemCancelCoversOpen(false)
      return
    }
    setCancelBusy(true)
    try {
      await apiService.updateKotCovers(currentKotId, n)
      setCovers(n)
      setItemCancelCoversOpen(false)
    } catch (err) {
      toast(errMessage(err, 'Unable To Update Covers'))
    } finally {
      setCancelBusy(false)
    }
  }

  async function runBillCancel(creds: AdminCreds | null) {
    if (currentKotId <= 0) {
      toast('Select A KOT........')
      setBillConfirmOpen(false)
      return
    }
    const areaForRefresh = areaId
    setCancelBusy(true)
    try {
      const result = await apiService.cancelKot(currentKotId, {
        username: creds?.username,
        password: creds?.password,
      })
      toast(String(result.msg || 'KOT Cancelled...............'))
      setBillConfirmOpen(false)
      setAdminCreds(null)
      clearData()
      if (areaForRefresh > 0) await loadOccupied(areaForRefresh)
    } catch (err) {
      toast(errMessage(err, 'Unable To Cancel KOT'))
    } finally {
      setCancelBusy(false)
      clearQty()
    }
  }

  function pickAreaForService(svc: ServiceKind, preferredId = 0) {
    const match = areas.filter((a) => areaMatchesService(a, svc))
    if (preferredId > 0 && match.some((a) => a.id === preferredId)) {
      return match.find((a) => a.id === preferredId) ?? null
    }
    if (svc === 'TAKEAWAY') {
      const takeAway = match.find((a) => {
        const n = areaNameKey(a.name)
        return n === 'TAKE AWAY' || n === 'TAKEAWAY'
      })
      if (takeAway) return takeAway
    }
    if (svc === 'DELIVERY') {
      const delivery = match.find((a) => areaNameKey(a.name) === 'DELIVERY')
      if (delivery) return delivery
    }
    if (svc === 'DINE IN') {
      const dine = match.find((a) => {
        const n = areaNameKey(a.name)
        return n === 'DINE IN' || normalizeSupply(a.supplyType) === 'DINE IN'
      })
      if (dine) return dine
    }
    return match[0] ?? null
  }

  function applyArea(next: AreaRow | null, keepTableId = 0, tableList = tables) {
    if (!next) {
      setAreaId(0)
      setKotPrefix('')
      setTableId(0)
      setTableName('')
      setChairNo(0)
      return
    }
    setAreaId(next.id)
    setKotPrefix(next.kotPrefix)
    setService(normalizeSupply(next.supplyType))
    const picked = pickDefaultTable(next, tableList, keepTableId)
    if (picked) {
      setTableId(picked.id)
      setTableName(picked.name)
    } else {
      setTableId(0)
      setTableName('')
      setChairNo(0)
    }
  }

  /** ResetOrderWaiterField — keep the logged-in waiter on this POS. */
  function resetOrderWaiterField() {
    setWaiterId(getPosSession().staffId)
  }

  function resetOpenKotTicket() {
    if (currentKotId <= 0) return
    setLines([])
    setSelectedLine(null)
    setCurrentKotId(0)
    setKotNo('')
    setKotPrefix('')
    setCustomerId(0)
    setCustomerName('')
    setCovers(1)
    setRemarks('')
    setBillDiscount(0)
    setDiscountType(0)
    setDiscountOpen(false)
    resetOrderWaiterField()
  }

  async function loadOccupied(forAreaId: number, deliveryAllAreas = false) {
    if (forAreaId <= 0 && !deliveryAllAreas) {
      setOccupiedKots([])
      return [] as OccupiedKot[]
    }
    try {
      const rows = await apiService.fetchOrderList(
        deliveryAllAreas
          ? { supplyType: 'DELIVERY' }
          : { areaId: forAreaId },
      )
      const mapped = mapOrderRows(rows)
        .map((r) => ({
          kotMasterId: r.kotMasterId,
          tableId: r.tableId,
          chairNo: r.chairNo,
          kotNo: r.kotNo,
          waiterId: r.waiterId,
          pax: r.pax,
          remarks: r.remarks,
        }))
        .sort((a, b) => a.tableId - b.tableId || a.chairNo - b.chairNo || a.kotMasterId - b.kotMasterId)
      setOccupiedKots(mapped)
      return mapped
    } catch {
      setOccupiedKots([])
      return [] as OccupiedKot[]
    }
  }

  function isCanonicalTakeAway(area: AreaRow) {
    const n = areaNameKey(area.name)
    return n === 'TAKE AWAY' || n === 'TAKEAWAY'
  }

  /**
   * AreaClickToPopulationTable — dine-in chairs vs takeaway/delivery KOT tiles.
   * Company IsTablePopup (isTablePopupSetting) chooses Floor Map vs table grid.
   * Runtime isTablePopup is origin of THIS pick only (1 = floor, 0 = grid) and is reset here.
   */
  async function areaClickToPopulationTable(area: AreaRow, deliveryList = false) {
    setIsTablePopup(0)
    setTableId(0)
    setTableName('')
    setChairNo(0)
    setKotNo('')
    setRemarks('')
    setKotPrefix(area.kotPrefix)
    resetOpenKotTicket()
    setTablePopupOpen(false)
    setTableFloorOpen(false)
    setChairPromptOpen(false)
    setKotSelectOpen(false)
    setCoversPrompt(null)
    try {
      const occ = await loadOccupied(area.id, deliveryList)
      if (area.tableCreationType === 0) {
        setTablePopupMode('tables')
        if (isTablePopupSetting === 1) setTableFloorOpen(true)
        else setTablePopupOpen(true)
      } else {
        setOccupiedKots(occ)
        setTablePopupMode('kots')
        setTablePopupOpen(true)
      }
    } catch (err) {
      toast(errMessage(err, 'Table not Found. . .'))
    }
    clearQty()
  }

  /** AreaButtonClick — flpArea tiles. TAKE AWAY is not in flpArea in VB. */
  function areaButtonClick(area: AreaRow) {
    if (isCanonicalTakeAway(area)) {
      takeAwayClick()
      return
    }
    if (normalizeSupply(area.supplyType) === 'DELIVERY') {
      deliveryClick(area)
      return
    }
    applyArea(area, 0)
    void areaClickToPopulationTable(area)
  }

  /** TakeAwayClick — table/chair = 0, hide popup, keep NEW items. */
  function takeAwayClick() {
    const match = pickAreaForService('TAKEAWAY')
    if (!match) {
      toast('TAKEAWAY Area Not Found........')
      return
    }
    applyArea(match, 0)
    setRemarks('')
    hideTablePopup(true)
    resetOpenKotTicket()
    clearQty()
  }

  /** btnDelivery_Click / Delivery() — table 0, hide popup. */
  function deliveryClick(forced?: AreaRow) {
    const match = forced ?? pickAreaForService('DELIVERY')
    if (!match) {
      toast('DELIVERY Area Not Found........')
      return
    }
    applyArea(match, 0)
    setRemarks('')
    hideTablePopup(true)
    resetOpenKotTicket()
    openCustomerSelect()
    clearQty()
  }

  function onServiceClick(next: ServiceKind) {
    if (next === 'TAKEAWAY') {
      takeAwayClick()
      return
    }
    if (next === 'DELIVERY') {
      deliveryClick()
      return
    }
    const dine = pickAreaForService('DINE IN')
    if (!dine) {
      setService('DINE IN')
      toast('DINE IN Area Not Found........')
      return
    }
    areaButtonClick(dine)
  }

  function hideTablePopup(resetOrigin = false) {
    setTablePopupOpen(false)
    setTableFloorOpen(false)
    setChairPromptOpen(false)
    setKotSelectOpen(false)
    setCoversPrompt(null)
    if (resetOrigin) setIsTablePopup(0)
  }

  function dismissTableSelectionUi() {
    hideTablePopup(true)
  }

  function assignFreeChairOrFail(freeChair: number) {
    if (freeChair > 0) {
      setChairNo(freeChair)
      hideTablePopup()
      return
    }
    setTableId(0)
    setTableName('')
    setChairNo(0)
    setIsTablePopup(0)
    toast('No Free Chair Avilable int This Table')
  }

  /** TableFloorRuntimeFrm Table_Click — access + vacant pax, then TableBtnClick. */
  async function floorTableClick(table: TableRow) {
    const occ = occupiedByTable.get(table.id) ?? []
    const activeWaiter = occ[0]?.waiterId ?? 0
    const loggedWaiter = getPosSession().staffId
    if (occ.length > 0 && activeWaiter > 0 && loggedWaiter > 0 && activeWaiter !== loggedWaiter) {
      toast('This table has an active KOT under another waiter.')
      return
    }
    if (occ.length === 0) {
      setCoversDraft('1')
      setCoversPrompt({ table })
      return
    }
    setIsTablePopup(1)
    setTableFloorOpen(false)
    await finishTableBtnClick(table, true)
  }

  async function confirmCovers() {
    const table = coversPrompt?.table
    if (!table) return
    const n = Number(coversDraft)
    if (!Number.isFinite(n) || n < 1) {
      toast('No. of persons is required.')
      return
    }
    setCovers(Math.max(1, Math.trunc(n)))
    setCoversPrompt(null)
    setIsTablePopup(1)
    setTableFloorOpen(false)
    await finishTableBtnClick(table, true)
  }

  /** TableBtnClick — dine-in table grid / Area Change (never floor extras). */
  async function tableBtnClick(table: TableRow) {
    setIsTablePopup(0)
    await finishTableBtnClick(table, false)
  }

  async function finishTableBtnClick(table: TableRow, fromFloor = false) {
    const ticketHasItems = currentKotId > 0 ? false : lines.length > 0
    resetOpenKotTicket()
    setTableId(table.id)
    setTableName(table.name)
    setChairNo(0)
    setKotSelectOpen(false)
    const occ = occupiedByTable.get(table.id) ?? []
    const seats = Math.max(0, Math.trunc(table.seats))
    const firstOccupied = occ.find((k) => k.chairNo > 0)?.chairNo ?? (occ[0]?.chairNo || 0)
    const chairSlots = seats > 0 ? seats : Math.max(occ.length, 1)
    const freeChair = Array.from({ length: chairSlots }, (_, i) => i + 1).find((n) => !occ.some((k) => k.chairNo === n)) ?? 0

    if (firstOccupied <= 0) {
      setChairNo(1)
      setChairPromptOpen(false)
      hideTablePopup()
      clearQty()
      return
    }

    // Existing order on this table: show chairs. Floor (IsTablePopup=1) shows chairs only,
    // not the full table grid again. Grid mode keeps tables and adds chairs underneath.
    if (fromFloor) {
      setTablePopupOpen(true)
      setTablePopupMode('tables')
    }
    setChairPromptOpen(true)

    if (ticketHasItems && occ.length > 0) {
      const first = occ[0]
      const ok = await ask(`Do You Want To Add Selected Item With KOT ${first.kotNo}`)
      if (ok) {
        if (occ.length === 1) {
          await takeOrder(first.kotMasterId, true)
          hideTablePopup()
        } else {
          setChairPromptOpen(true)
          setKotSelectOpen(true)
        }
      } else {
        assignFreeChairOrFail(freeChair)
      }
      clearQty()
      return
    }

    const chair = firstOccupied || 1
    setChairNo(chair)
    setChairPromptOpen(true)
    const kot = occ.find((k) => k.chairNo === chair) ?? occ[0]
    if (kot) await takeOrder(kot.kotMasterId, false)
    clearQty()
  }

  async function pickKotToCombine(kot: OccupiedKot | null, freeChair: number) {
    if (!kot) {
      assignFreeChairOrFail(freeChair)
      setKotSelectOpen(false)
      clearQty()
      return
    }
    setChairNo(kot.chairNo || 1)
    await takeOrder(kot.kotMasterId, true)
    hideTablePopup()
    clearQty()
  }

  /** ChairbtnClick — hide overlay only when the ticket is still NEW (CurrentKOTID=0). */
  async function chairBtnClick(chair: number, table: TableRow) {
    const ticketHasItems = currentKotId > 0 ? false : lines.length > 0
    resetOpenKotTicket()
    setChairNo(chair)
    const occ = occupiedByTable.get(table.id) ?? []
    const kot = occ.find((k) => k.chairNo === chair)
    let loadedKot = false
    if (ticketHasItems && kot) {
      const ok = await ask(`Do You Want To Add Selected Item With KOT ${kot.kotNo}`)
      if (ok) {
        await takeOrder(kot.kotMasterId, true)
        loadedKot = true
      } else {
        setTableId(0)
        setTableName('')
        setChairNo(0)
        setIsTablePopup(0)
      }
    } else if (kot) {
      await takeOrder(kot.kotMasterId, false)
      loadedKot = true
    }
    if (!loadedKot) hideTablePopup()
    clearQty()
  }

  /** KI tile — takeaway/delivery existing KOT */
  async function kotTileClick(kot: OccupiedKot) {
    setIsTablePopup(0)
    await takeOrder(kot.kotMasterId, false)
    hideTablePopup()
  }

  /** ClearData — after save when gvClearAfterKOTSave=1, or New KOT. */
  function clearData() {
    setLines([])
    setSelectedLine(null)
    setCurrentKotId(0)
    setKotNo('')
    setRemarks('')
    setBillDiscount(0)
    setDiscountType(0)
    setDiscountOpen(false)
    setCustomerId(0)
    setCustomerName('')
    setCovers(1)
    setTableId(0)
    setTableName('')
    setChairNo(0)
    setWaiterId(getPosSession().staffId)
    setIsTablePopup(0)
    const match = pickAreaForService(service)
    applyArea(match)
    clearQty()
  }

  function closeAlert(ok = false) {
    const resolve = alertResolveRef.current
    alertResolveRef.current = null
    setAlertBox(null)
    resolve?.(ok)
  }

  function showAlert(box: AlertBox): Promise<boolean> {
    if (alertResolveRef.current) {
      alertResolveRef.current(false)
      alertResolveRef.current = null
    }
    return new Promise((resolve) => {
      alertResolveRef.current = resolve
      setAlertBox(box)
    })
  }

  function toast(msg: string) {
    const kind = inferAlertKind(msg)
    void showAlert({ kind, title: inferAlertTitle(kind), message: msg })
  }

  function ask(message: string) {
    return showAlert({ kind: 'question', title: inferAlertTitle('question'), message })
  }

  /** DisplayKOT — AppendItems=0 replaces the grid; =1 keeps NEW lines then adds KOT lines. */
  function applyKotDetails(
    payload: unknown,
    productTiles: ProductTile[],
    append = false,
    listedRemarks = '',
  ) {
    const rows = kotDetailsRows(payload)
    if (!rows.length) {
      toast('NO Item for KOT')
      return false
    }
    const first = rows[0]
    const nextLines: TicketLine[] = rows.map((row) => {
      const qty = num(row.Qty ?? row.qty) || 1
      const price = num(row.UnitPrice ?? row.unitPrice)
      const disc = num(row.ItemDisc ?? row.ItemDiscount ?? row.itemDiscount)
      const taxLine = num(row.Tax1AmountC ?? row.tax1AmountC ?? row.TaxAmount)
      const taxRate = num(row.Tax1RateC ?? row.tax1RateC ?? row.TaxPerc)
      const productId = num(row.ProductID ?? row.productID)
      const tile = productTiles.find((x) => x.id === productId)
      const vatPerPc =
        num(row.dgvVatAmtPcs) ||
        (qty > 0 ? round2(taxLine / qty) : 0) ||
        tile?.taxAmount ||
        0
      const calced = calcLine(price, qty, vatPerPc, taxRate || tile?.taxRate || 0, disc)
      return {
        key: lineKey.current++,
        productId,
        item: String(row.ShortDescription ?? row.ItemName ?? row.itemName ?? tile?.name ?? 'Item'),
        modifiers: String(row.Modifier ?? row.Modifir ?? row.modifier ?? ''),
        qty,
        price,
        disc: calced.disc,
        discPerc: calced.discPerc,
        tax: calced.tax,
        total: calced.total,
        taxRate: taxRate || tile?.taxRate || 0,
        taxAmount: vatPerPc,
        productType: String(row.ItemType ?? row.productType ?? tile?.productType ?? '').trim().toUpperCase(),
        kotPending: false,
        kotChildId: num(
          row.KotChildID ?? row.kotChildID ?? row.KOTChildID ?? row.dgvKOTChildID ?? row.kot_child_id,
        ),
        groupId: num(row.GroupID ?? row.groupID ?? row.dgvGrpID) || tile?.groupId || 0,
        barcode: String(row.BarCode ?? row.Barcode ?? tile?.barcode ?? ''),
        androidPrint: kotPrintStatus(row.AndroidPrint ?? row.Androidprint ?? row.android_printed),
        kotDisplayStatus: String(row.KOTDisplayStatus ?? row.kotDisplayStatus ?? 'PENDING'),
      }
    })
    if (append) {
      setLines((prev) => [...prev, ...nextLines])
    } else {
      setLines(nextLines)
    }
    setSelectedLine(nextLines[nextLines.length - 1]?.key ?? null)
    setCurrentKotId(num(first.KotMasterID ?? first.kotMasterID))
    setKotPrefix(String(first.KotPrefix ?? first.KOTPrefix ?? ''))
    setKotNo(String(first.KotNumber ?? first.KOTNumber ?? first.kotNumber ?? ''))
    const nextAreaId = num(first.AreaID ?? first.areaID)
    setAreaId(nextAreaId)
    const area = areas.find((a) => a.id === nextAreaId)
    const supply = normalizeSupply(first.SupplyType ?? first.supplyType ?? area?.supplyType)
    setService(supply)
    const nextTableId = num(first.TableID ?? first.tableID)
    setTableId(nextTableId)
    setTableName(
      String(first.TableName ?? first.tableName ?? '')
        || tables.find((t) => t.id === nextTableId)?.name
        || '',
    )
    setChairNo(num(first.ChairNo ?? first.chairNo))
    setCovers(Math.max(1, num(first.NofCustomer ?? first.nofCustomer) || 1))
    setRemarks(kotHeaderRemarks(first, listedRemarks))
    const loadedBillDisc = num(first.BillDiscount ?? first.billDiscount)
    const loadedType = num(first.DiscountType ?? first.discountType)
    const hasItemDisc = nextLines.some((l) => l.disc > 0)
    if (loadedType === 2 || (loadedBillDisc <= 0 && hasItemDisc)) setDiscountType(2)
    else setDiscountType(0)
    setBillDiscount(loadedType === 2 ? 0 : loadedBillDisc)
    setCustomerId(num(first.CustomerID ?? first.customerID))
    setCustomerName(String(first.CustomerName ?? first.customerName ?? ''))
    const loadedWaiter = num(first.WaiterID ?? first.waiterID)
    setWaiterId(loadedWaiter > 0 ? loadedWaiter : getPosSession().staffId)
    return nextLines
  }

  function buildKotItems(ticket: TicketLine[]) {
    return ticket.map((line) => {
      const sub = round2(line.price * line.qty - line.disc)
      return {
        ProductID: line.productId,
        ItemName: line.item,
        ShortDescription: line.item,
        Qty: line.qty,
        UnitPrice: line.price,
        SubTotal: sub,
        TaxPerc: line.taxRate,
        Tax1RateC: line.taxRate,
        TaxAmount: line.tax,
        Tax1AmountC: line.tax,
        ItemDisc: line.disc,
        ItemDiscount: line.disc,
        LineTotal: line.total,
        dgvGrpID: line.groupId,
        GroupID: line.groupId,
        Modifir: line.modifiers,
        Modifier: line.modifiers,
        AndroidPrint: line.androidPrint || 'PENDING',
        KOTDisplayStatus: line.kotDisplayStatus || 'PENDING',
        dgvKOTChildID: line.kotChildId > 0 ? line.kotChildId : 0,
        KotChildID: line.kotChildId > 0 ? line.kotChildId : 0,
        kotChildId: line.kotChildId > 0 ? line.kotChildId : 0,
        BarCode: line.barcode,
        PackQty: 1,
        UnitCost: 0,
      }
    })
  }

  function buildSettleItems(ticket: TicketLine[]) {
    return ticket.map((line) => {
      const sub = round2(line.price * line.qty - line.disc)
      return {
        productId: line.productId,
        ProductID: line.productId,
        qty: line.qty,
        Qty: line.qty,
        unitPrice: line.price,
        UnitPrice: line.price,
        unitCost: 0,
        packQty: 1,
        PackQty: 1,
        discount: line.disc,
        ItemDisc: line.disc,
        subTotalC: sub,
        SubTotalC: sub,
        tax1AmountC: line.tax,
        Tax1AmountC: line.tax,
        tax1RateC: line.taxRate,
        Tax1RateC: line.taxRate,
        lineTotal: line.total,
        LineTotal: line.total,
        shortDescription: line.item,
        ShortDescription: line.item,
        itemName: line.item,
        groupId: line.groupId,
        GroupID: line.groupId,
        kotChildID: line.kotChildId,
        KotChildID: line.kotChildId,
        modifier: line.modifiers,
        Modifier: line.modifiers,
      }
    })
  }

  /**
   * btnSaveKOT_Click → SaveBilDetailsToHoldTable("BillHold","KotSave")
   * Validations match Mainfrm.vb one-for-one. Printing is deferred.
   */
  async function saveKotInternal(opts?: {
    forSettlement?: boolean
    forDiscount?: boolean
    ticket?: TicketLine[]
    billDisc?: number
    discType?: 0 | 2
  }): Promise<{
    kotId: number
    lines: TicketLine[]
    kotLabel: string
  } | null> {
    if (savingKot && !opts?.forSettlement && !opts?.forDiscount) return null
    const ticket = opts?.ticket ?? lines
    const discType = opts?.discType ?? discountType
    const discAmt = opts?.billDisc ?? billDiscount
    const totals = calcKotTotals(ticket, discAmt, defaultTax1, 0)
    if (ticket.length === 0) {
      toast('Enter Atleast One Item details...........')
      return null
    }
    const resolvedArea = pickAreaForService(service, areaId) ?? (areaId > 0 ? currentArea : null)
    if (!resolvedArea) {
      toast('Please Select An Area...........')
      setAreaOpen(true)
      return null
    }
    const supply = normalizeSupply(resolvedArea.supplyType) || service
    const needsTable = resolvedArea.tableCreationType === 0
    if (resolvedArea.id !== areaId) {
      applyArea(resolvedArea, needsTable ? tableId : 0)
    }
    if (supply === 'DELIVERY' && customerId < 1) {
      toast('Select a Customer...........')
      openCustomerSelect()
      return null
    }
    if (supply === 'DINE IN' && waiterMandatory === 1 && waiterId <= 0) {
      toast('Select a Waiter. . . .')
      return null
    }
    let saveTableId = needsTable ? tableId : 0
    let saveChairNo = needsTable ? (chairNo > 0 ? chairNo : 1) : 0
    if (needsTable && saveTableId <= 0) {
      toast('Please Select A Table...........')
      void areaClickToPopulationTable(resolvedArea)
      return null
    }
    if (needsTable && saveChairNo < 0) {
      toast('Please Select A Chair...........')
      void areaClickToPopulationTable(resolvedArea)
      return null
    }

    const session = getPosSession()
    setSavingKot(true)
    try {
      const result = await apiService.saveKot({
        StationID: session.stationId,
        stationId: session.stationId,
        mfAreaId: resolvedArea.id,
        AreaID: resolvedArea.id,
        mfTableID: saveTableId,
        TableID: saveTableId,
        mfChairNo: saveChairNo,
        mfCustomerID: customerId,
        CustomerID: customerId,
        mfWaiterID: waiterId,
        WaiterID: waiterId,
        ISWaiterMandatory: waiterMandatory,
        gvCounterNo: String(session.counterNo),
        gvUserName: session.staffName,
        gvCashierID: session.staffId,
        txtDiscount: totals.billDiscount,
        BillDiscount: totals.billDiscount,
        DiscountType: discType,
        gvTax1Percentage: defaultTax1,
        Tax1RateM: defaultTax1,
        lblSubTotalAmt: totals.lineSubtotal,
        lblTax1Total: totals.tax,
        lblRound: totals.roundOff,
        lblBillTotal: totals.total,
        txtNoofCustomer: covers,
        txtRemarks: remarks,
        Remarks: remarks,
        remarks,
        HeaderRemarks: remarks,
        mfKotPrefix: resolvedArea.kotPrefix || kotPrefix,
        CurrentKOTID: currentKotId > 0 ? currentKotId : 0,
        IsTablePopup: isTablePopup,
        isTablePopup,
        btnname: opts?.forSettlement ? 'Settlement' : opts?.forDiscount ? 'Discount' : 'KotSave',
        Items: buildKotItems(ticket),
      })
      const kotId = num(result.CurrentKOTID ?? result.jobId)
      if (kotId > 0) setCurrentKotId(kotId)
      let details = result.kotDetails
      if (!kotDetailsRows(details).length && kotId > 0) {
        details = await apiService.fetchKotDetails(String(kotId))
      }
      const savedNo = `${String(result.KotPrefix ?? kotPrefix)}${String(result.KotNumber ?? kotNo)}`
      if (opts?.forDiscount) toast('Discount Saved....... ')
      else if (!opts?.forSettlement) toast(`Kot ${savedNo} Saved. . . `)
      let savedLines: TicketLine[] = ticket
      if (clearAfterKotSave === 1 && !opts?.forSettlement && !opts?.forDiscount) {
        clearData()
      } else if (details) {
        const applied = applyKotDetails(details, allProducts, false)
        if (applied) savedLines = applied
      }
      if (kotId < 1) {
        toast('Unable To Save')
        return null
      }
      return { kotId, lines: savedLines, kotLabel: savedNo }
    } catch (err) {
      toast(errMessage(err, 'Unable To Save'))
      return null
    } finally {
      setSavingKot(false)
      if (!opts?.forSettlement) clearQty()
    }
  }

  async function onSaveKot() {
    if (savingKot) return
    await saveKotInternal()
  }

  /** btnDiscount_Click — admin, same tax %, then Discountfrm. */
  function onDiscountClick() {
    if (currentKotId <= 0) {
      toast('Select A Bill......')
      return
    }
    requestAdmin('discount')
  }

  function openDiscountDialog() {
    if (currentKotId <= 0 || lines.length === 0) {
      toast('Select A Bill......')
      return
    }
    if (taxRatesDiffer(lines)) {
      toast('Tax Rate is Different..    Discount Not Applicable')
      return
    }
    const currentType = discountType
    if (currentType === 2 && allowedItemDiscountCount(lines) <= 0) {
      toast('Discount is not allowed for any item in this bill.')
      return
    }
    const totals = calcKotTotals(lines, billDiscount, defaultTax1, 0)
    const oldDiscount = currentType === 2 ? allowedItemDiscountTotal(lines) : round2(Math.max(0, billDiscount))
    const subTotal = currentType === 2 ? round2(totals.lineSubtotal + oldDiscount) : totals.lineSubtotal
    const mode: -1 | 0 | 2 = oldDiscount > 0 ? currentType : -1
    setDiscountBase(subTotal)
    setDiscountMode(mode)
    setDiscountAmount(oldDiscount > 0 || mode !== -1 ? money(oldDiscount) : '')
    setDiscountPercent(mode === 2 ? money(currentItemDiscountPercent(lines)) : mode === 0 && subTotal > 0 ? money(round2((oldDiscount * 100) / subTotal)) : '')
    setDiscountFocus(mode === 2 ? 'percent' : 'amount')
    setDiscountKeyLock('')
    setDiscountError(null)
    setDiscountOpen(true)
  }

  function closeDiscountDialog() {
    setDiscountOpen(false)
    setDiscountError(null)
    setDiscountKeyLock('')
  }

  function selectDiscountMode(mode: 0 | 2) {
    if (mode === 0) {
      const blocked = notAllowedItemDiscountCount(lines)
      if (blocked > 0) {
        toast(
          `Bill discount is not allowed because ${blocked} item(s) are marked as non-discountable in this bill. Please use item-wise discount.`,
        )
        return
      }
      setDiscountMode(0)
      setDiscountFocus('amount')
      return
    }
    setDiscountMode(2)
    setDiscountFocus('percent')
  }

  function onDiscountAmountChange(raw: string) {
    if (discountMode === -1 || discountMode === 2) return
    if (discountKeyLock === 'percent') return
    const next = raw.replace(/[^\d.]/g, '').slice(0, 12)
    setDiscountKeyLock('amount')
    setDiscountAmount(next)
    const amt = next === '' || next === '.' ? 0 : Number(next)
    if (!Number.isFinite(amt)) {
      setDiscountKeyLock('')
      return
    }
    setDiscountPercent(discountBase > 0 ? money(round2((amt * 100) / discountBase)) : money(0))
    if (discountBase - amt < 0) {
      toast('Discount Amount Not Acceptable.........')
      setDiscountError('Discount Amount Not Acceptable.........')
      setDiscountAmount('')
      setDiscountPercent('')
    } else {
      setDiscountError(null)
    }
    setDiscountKeyLock('')
  }

  function onDiscountPercentChange(raw: string) {
    if (discountMode === -1) return
    if (discountKeyLock === 'amount') return
    const next = raw.replace(/[^\d.]/g, '').slice(0, 12)
    setDiscountKeyLock('percent')
    setDiscountPercent(next)
    const pct = next === '' || next === '.' ? 0 : Number(next)
    if (!Number.isFinite(pct)) {
      setDiscountKeyLock('')
      return
    }
    const amt = round2((discountBase * pct) / 100)
    setDiscountAmount(money(amt))
    if (discountBase - amt < 0) {
      toast('Discount Amount Not Acceptable.........')
      setDiscountError('Discount Amount Not Acceptable.........')
      setDiscountAmount('')
      setDiscountPercent('')
    } else {
      setDiscountError(null)
    }
    setDiscountKeyLock('')
  }

  function onDiscountPadKey(k: string) {
    const cur = discountFocus === 'amount' ? discountAmount : discountPercent
    if (k === 'C') {
      const next = cur.slice(0, -1)
      if (discountFocus === 'amount') onDiscountAmountChange(next)
      else onDiscountPercentChange(next)
      return
    }
    if (k === '.' && cur.includes('.')) return
    const next = (cur + k).slice(0, 12)
    if (discountFocus === 'amount') onDiscountAmountChange(next)
    else onDiscountPercentChange(next)
  }

  async function applyDiscountDone() {
    if (discountMode !== 0 && discountMode !== 2) {
      toast('Please select discount mode first.')
      return
    }
    const previousDiscountType = discountType
    const nextType = discountMode
    const newAmount = Number(discountAmount)
    const newPercent = Number(discountPercent)
    const newDiscount = nextType === 2
      ? (Number.isFinite(newPercent) ? newPercent : 0)
      : (Number.isFinite(newAmount) ? newAmount : 0)
    if (nextType === 0) {
      const blocked = notAllowedItemDiscountCount(lines)
      if (blocked > 0) {
        toast(
          `Bill discount is not allowed because ${blocked} item(s) are marked as non-discountable in this bill. Please use item-wise discount.`,
        )
        return
      }
    }
    let nextLines = lines
    if (previousDiscountType === 2 && nextType === 0) {
      if (allowedItemDiscountTotal(lines) > 0) {
        const ok = await ask(
          'Item-wise discount already applied. Switching to bill discount will remove all item discounts. Continue?',
        )
        if (!ok) return
        nextLines = clearAllItemDiscountRows(lines)
      }
    } else if (previousDiscountType === 0 && nextType === 2) {
      if (billDiscount > 0) {
        const ok = await ask(
          'Bill discount already applied. Switching to item-wise discount will remove bill discount. Continue?',
        )
        if (!ok) return
      }
    }
    let nextBill = 0
    if (nextType === 2) {
      const split = splitDiscountAmountToItems(nextLines, Number.isFinite(newDiscount) ? newDiscount : 0)
      if (!split) {
        toast('Discount is not allowed for any item in this bill.')
        return
      }
      nextLines = split
      nextBill = 0
    } else {
      nextBill = round2(Math.max(0, Number.isFinite(newDiscount) ? newDiscount : 0))
    }
    setLines(nextLines)
    setBillDiscount(nextBill)
    setDiscountType(nextType)
    setDiscountOpen(false)
    setDiscountError(null)
    await saveKotInternal({
      forDiscount: true,
      ticket: nextLines,
      billDisc: nextBill,
      discType: nextType,
    })
  }

  /** btnSettlement_Click — require a saved KOT unless SaveKOTonSettlement=1. */
  async function onSettlementClick() {
    if (settleOpening || settleOpen || savingKot) return
    if (lines.length === 0) {
      toast('Enter Atleast One Item details...........')
      return
    }
    const pending = lines.some((l) => l.kotPending)
    if (saveKotOnSettlement === 0) {
      if (currentKotId <= 0 || pending) {
        toast('Save KOT Before Settlement...')
        return
      }
    }
    setSettleOpening(true)
    try {
      let kotId = currentKotId
      let ticket = lines
      let label = currentKotId > 0 ? `${kotPrefix}${kotNo}` || String(currentKotId) : 'NEW'
      if (saveKotOnSettlement === 1 || pending || kotId <= 0) {
        const saved = await saveKotInternal({ forSettlement: true })
        if (!saved) return
        kotId = saved.kotId
        ticket = saved.lines
        label = saved.kotLabel
      }
      const totals = calcKotTotals(ticket, billDiscount, defaultTax1, 0)
      const keypadPaid = Number(entry)
      setSettleBill({
        kotId,
        kotLabel: label,
        net: totals.total,
        subtotal: totals.lineSubtotal,
        discount: totals.billDiscount,
        tax: totals.tax,
        taxable: round2(Math.max(0, totals.lineSubtotal - totals.billDiscount)),
        customerId,
        waiterId,
        tableId,
        areaId,
        covers,
        remarks,
        items: buildSettleItems(ticket),
        prefillPaid: Number.isFinite(keypadPaid) && keypadPaid > 0 ? round2(keypadPaid) : 0,
      })
      setSettleOpen(true)
      setEntry('')
    } finally {
      setSettleOpening(false)
    }
  }

  function closeSettlement() {
    if (settleOpening) return
    setSettleOpen(false)
    setSettleBill(null)
  }

  function onSettlementCompleted(info: SettlementDone) {
    setSettleOpen(false)
    setSettleBill(null)
    setLastInfo(info)
    toast('Transaction Completed. . . ')
    const areaForRefresh = areaId
    clearData()
    clearQty()
    if (areaForRefresh > 0) void loadOccupied(areaForRefresh)
  }

  function onSettlementAlreadySettled() {
    setSettleOpen(false)
    setSettleBill(null)
    toast('This KOT is already settled / invoiced from another counter...')
    const areaForRefresh = areaId
    clearData()
    clearQty()
    if (areaForRefresh > 0) void loadOccupied(areaForRefresh)
  }

  async function loadOrderList(
    supply: 'ALL' | ServiceKind = orderListSupply,
    search = orderListSearch,
    filterAreaId = orderListAreaId,
  ) {
    setOrderListState('loading')
    setOrderListError(null)
    try {
      const rows = await apiService.fetchOrderList({
        search: search.trim() || undefined,
        supplyType: supply === 'ALL' ? undefined : supply === 'TAKEAWAY' ? 'PARCEL' : supply,
        areaId: filterAreaId > 0 ? filterAreaId : undefined,
      })
      setOrderListRows(mapOrderRows(rows))
      setOrderListState('idle')
    } catch (err) {
      setOrderListError(errMessage(err, 'Could not load order list'))
      setOrderListState('error')
    }
  }

  /** btnOrderList_Click — always load as NEW (no combine). */
  function onOrderListClick() {
    setOrderListSearch('')
    setOrderListSupply('ALL')
    setOrderListAreaId(0)
    setOrderListOpen(true)
    void loadOrderList('ALL', '', 0)
  }

  /** Mainfrm.Button1_Click — KotJoinFrm.ShowDialog */
  function onKotJoinClick() {
    setKotJoinOpen(true)
  }

  function onKotJoined(targetKotId: number, sourceKotIds: number[]) {
    if (currentKotId > 0 && sourceKotIds.includes(currentKotId)) clearData()
    else if (currentKotId > 0 && currentKotId === targetKotId) void takeOrder(targetKotId, false)
    if (areaId > 0) void loadOccupied(areaId)
  }

  function onKotSplit(info: { sourceKotId: number; newKotId: number; sourceEmptyAfterSplit: boolean }) {
    if (currentKotId > 0 && currentKotId === info.sourceKotId) {
      if (info.sourceEmptyAfterSplit) clearData()
      else void takeOrder(info.sourceKotId, false)
    }
    if (areaId > 0) void loadOccupied(areaId)
  }

  /** TableFloorRuntimeFrmAreaChange after UpdateKotTable. */
  function onAreaChanged(info: {
    kotMasterId: number
    fromAreaId: number
    fromTableId: number
    toAreaId: number
    toTableId: number
    toTableName: string
    toAreaName: string
  }) {
    if (currentKotId > 0 && currentKotId === info.kotMasterId) {
      const destArea = areas.find((a) => a.id === info.toAreaId)
      if (destArea) {
        setAreaId(destArea.id)
        setService(normalizeSupply(destArea.supplyType))
      } else {
        setAreaId(info.toAreaId)
      }
      setTableId(info.toTableId)
      setTableName(info.toTableName)
    }
    const refreshArea = currentKotId > 0 && currentKotId === info.kotMasterId ? info.toAreaId : areaId
    if (refreshArea > 0) void loadOccupied(refreshArea)
  }

  function onOrderListSupply(s: 'ALL' | ServiceKind) {
    setOrderListSupply(s)
    setOrderListAreaId(0)
    void loadOrderList(s, orderListSearch, 0)
  }

  function onOrderListArea(areaId: number) {
    const next = orderListAreaId === areaId ? 0 : areaId
    setOrderListAreaId(next)
    setOrderListSupply('ALL')
    void loadOrderList('ALL', orderListSearch, next)
  }

  /** DisplayKOT — Order List and table load. AppendItems=0 replaces; =1 keeps NEW lines. */
  async function takeOrder(kotMasterId: number, append = false) {
    if (kotMasterId <= 0 || loadingKot) return
    setLoadingKot(true)
    try {
      const details = await apiService.fetchKotDetails(String(kotMasterId))
      const listedRemarks =
        orderListRows.find((r) => r.kotMasterId === kotMasterId)?.remarks
        || occupiedKots.find((k) => k.kotMasterId === kotMasterId)?.remarks
        || ''
      const ok = applyKotDetails(details, allProducts, append, listedRemarks)
      if (!ok) return
      setOrderListOpen(false)
    } catch (err) {
      toast(`Error loading KOT: ${errMessage(err, 'failed')}`)
    } finally {
      setLoadingKot(false)
      clearQty()
    }
  }

  async function loadCustomers(search = customerSearch) {
    setCustomerState('loading')
    try {
      const rows = await apiService.fetchCustomers({ limit: 80, search: search.trim() || undefined })
      setCustomerRows(
        rows.map((c) => ({
          id: num(c.customerId ?? c.CustomerID),
          name: String(c.customerName ?? c.CustomerName ?? '').trim(),
          mobile: String(c.mobileNo ?? c.MobileNo ?? '').trim(),
          telephone: String(c.telephone ?? c.Telephone ?? '').trim(),
          code: String(c.customerCode ?? c.CustomerCode ?? '').trim(),
        })).filter((c) => c.id > 0 && c.name),
      )
    } catch {
      setCustomerRows([])
    } finally {
      setCustomerState('idle')
    }
  }

  function openCustomerSelect() {
    setCustomerSearch('')
    setCustomerOpen(true)
    void loadCustomers('')
    window.setTimeout(() => customerSearchRef.current?.focus(), 50)
  }

  function onCustomerQueryChange(val: string) {
    setCustomerSearch(val)
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current)
    customerSearchTimer.current = setTimeout(() => void loadCustomers(val), 280)
  }

  function pickCustomer(c: CustomerPick) {
    setCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerOpen(false)
    setCustomerEntryOpen(false)
  }

  function openNewCustomer() {
    const prefill = prefillFromCustomerSearch(customerSearch)
    setCustomerEntryName(prefill.name)
    setCustomerEntryMobile(prefill.mobile)
    setCustomerEntryTel('')
    setCustomerEntryAddress('')
    setCustomerEntryError(null)
    setCustomerEntryOpen(true)
    window.setTimeout(() => {
      if (prefill.mobile) customerMobileRef.current?.focus()
    }, 50)
  }

  async function saveNewCustomer() {
    const name = customerEntryName.trim()
    const mobile = customerEntryMobile.trim().replace(/[\s\-()]/g, '')
    const telephone = customerEntryTel.trim().replace(/[\s\-()]/g, '')
    if (!name) {
      setCustomerEntryError('Customer name is required')
      return
    }
    setCustomerSaving(true)
    setCustomerEntryError(null)
    try {
      const created = await apiService.createCustomer({
        customerName: name,
        mobileNo: mobile || undefined,
        telephone: telephone || undefined,
        address: customerEntryAddress.trim() || undefined,
        autoCode: true,
        newBarcode: true,
      })
      const id = num(created.customerId ?? created.CustomerID ?? created.id)
      pickCustomer({
        id: id > 0 ? id : 0,
        name: String(created.customerName ?? created.CustomerName ?? name).trim() || name,
        mobile: String(created.mobileNo ?? created.MobileNo ?? mobile).trim(),
        telephone: String(created.telephone ?? created.Telephone ?? telephone).trim(),
        code: String(created.customerCode ?? created.CustomerCode ?? '').trim(),
      })
      toast('Customer saved')
    } catch (err) {
      setCustomerEntryError(errMessage(err, 'Failed to save customer'))
    } finally {
      setCustomerSaving(false)
    }
  }

  const emptyHint =
    query.trim()
      ? 'No matching items'
      : groupId == null
        ? 'Select a group'
        : 'No items in this category'

  return (
    <div className="pos-main">
      <header className="pd-header">
        <div className="pd-logo">
          MOIF<span>DEYNO PRO</span>
        </div>
        <nav className="pd-nav">
          {NAV.map((item) =>
            item === 'Reports' ? (
              <div key={item} className="pd-nav-wrap" ref={reportsMenuRef}>
                <button
                  type="button"
                  className={`pd-nav-btn${nav === 'Reports' || reportsMenuOpen ? ' is-active' : ''}`}
                  onClick={() => {
                    setNav('Reports')
                    setEntryMenuOpen(false)
                    setReportsMenuOpen((open) => {
                      if (open) setReportViewersOpen(false)
                      return !open
                    })
                  }}
                >
                  Reports
                </button>
                {reportsMenuOpen ? (
                  <div className="pd-nav-menu" role="menu">
                    <button
                      type="button"
                      className={`pd-nav-parent${reportViewersOpen ? ' is-open' : ''}`}
                      role="menuitem"
                      onClick={() => setReportViewersOpen((open) => !open)}
                    >
                      Report Viewers
                      <ChevronRight size={14} />
                    </button>
                    {reportViewersOpen ? (
                      <div className="pd-nav-submenu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setSalesViewerOpen(true)
                            setReportsMenuOpen(false)
                            setReportViewersOpen(false)
                          }}
                        >
                          Sales Viewer
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setReportsMenuOpen(false)
                        setReportViewersOpen(false)
                        requestAdmin('counter-close-all', true)
                      }}
                    >
                      Counter Close ALL
                    </button>
                  </div>
                ) : null}
              </div>
            ) : item === 'Entry' ? (
              <div key={item} className="pd-nav-wrap" ref={entryMenuRef}>
                <button
                  type="button"
                  className={`pd-nav-btn${nav === 'Entry' || entryMenuOpen ? ' is-active' : ''}`}
                  onClick={() => {
                    setNav('Entry')
                    setReportsMenuOpen(false)
                    setReportViewersOpen(false)
                    setEntryMenuOpen((open) => !open)
                  }}
                >
                  Entry
                </button>
                {entryMenuOpen ? (
                  <div className="pd-nav-menu" role="menu">
                    <p className="pd-nav-menu-label">Masters</p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEntryMenuOpen(false)
                        setAreaMasterOpen(true)
                      }}
                    >
                      Area Entry
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEntryMenuOpen(false)
                        setTableMasterOpen(true)
                      }}
                    >
                      Table Entry
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEntryMenuOpen(false)
                        setFloorDesignOpen(true)
                      }}
                    >
                      Floor Design
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                key={item}
                type="button"
                className={`pd-nav-btn${item === nav ? ' is-active' : ''}`}
                onClick={() => {
                  setNav(item)
                  setReportsMenuOpen(false)
                  setReportViewersOpen(false)
                  setEntryMenuOpen(false)
                }}
              >
                {item}
              </button>
            ),
          )}
        </nav>
        <div className="pd-header-right">
          <div className="pd-user">
            <strong>{waiter.toUpperCase()}</strong>
            <small>{counter}</small>
          </div>
          <button
            type="button"
            className="pd-power"
            title="Logout"
            onClick={() => {
              clearStaffSession()
              navigate('/')
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="pd-main">
        <section className="pd-panel">
          <div className="pd-order-head">
            <h1>{currentKotId > 0 ? 'OPEN KOT' : 'NEW ORDER'}</h1>
            <div className="pd-meta">
              <span>
                ORDER <b>#{kotLabel}</b>
              </span>
              <span>
                <b>{currentArea?.name || service}</b>
              </span>
              <button
                type="button"
                className="pd-meta-btn"
                onClick={() => {
                  if (currentArea) void areaClickToPopulationTable(currentArea)
                  else setAreaOpen(true)
                }}
              >
                TABLE <b>{tableName || (tableId > 0 ? String(tableId) : '—')}</b>
                {chairNo > 0 ? <b>{` / CH ${chairNo}`}</b> : null}
              </button>
              <button
                type="button"
                className="pd-meta-btn"
                onClick={() => setCovers((n) => (n >= 12 ? 1 : n + 1))}
                title="Number of persons"
              >
                <b>{covers}</b> COVERS
              </button>
              <button
                type="button"
                className="pd-meta-btn"
                onClick={() => openCustomerSelect()}
              >
                <b>{customerName || 'CASH CUSTOMER'}</b>
              </button>
            </div>
          </div>

          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th className="col-no">#</th>
                  <th className="col-item">Item</th>
                  <th className="col-mod">M</th>
                  <th className="col-qty num">Qty</th>
                  <th className="col-money num">Price</th>
                  <th className="col-money num">Disc</th>
                  <th className="col-money num">Tax</th>
                  <th className="col-money num">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr className="pd-empty-row">
                    <td colSpan={8}>Tap an item to add it to the ticket</td>
                  </tr>
                ) : (
                  lines.map((line, i) => (
                    <tr
                      key={line.key}
                      className={selectedLine === line.key ? 'is-selected' : undefined}
                      onClick={() => setSelectedLine(line.key)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setSelectedLine(line.key)
                        setRowMenu({ x: e.clientX, y: e.clientY, key: line.key })
                      }}
                    >
                      <td className="col-no">{i + 1}</td>
                      <td className="col-item">
                        <span className="pd-item-name">{line.item}</span>
                        {line.modifiers ? (
                          <span className="pd-item-mod">↳ {line.modifiers}</span>
                        ) : null}
                      </td>
                      <td className="col-mod">
                        <button
                          type="button"
                          className="pd-modifir"
                          title="Add Modifier"
                          onClick={(e) => {
                            e.stopPropagation()
                            openModifierForm(line.key)
                          }}
                        >
                          M
                        </button>
                      </td>
                      <td
                        className={`col-qty num pd-qty-cell${line.qty < 0 ? ' is-return' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openQtyChange(line.key)
                        }}
                      >
                        {line.qty}
                      </td>
                      <td className="col-money num">{money(line.price)}</td>
                      <td className="col-money num">{money(line.disc)}</td>
                      <td className="col-money num">{money(line.tax)}</td>
                      <td className="col-money num">{money(line.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pd-foot">
            <div className="pd-service">
              {([
                { id: 'DINE IN' as const, icon: Utensils },
                { id: 'TAKEAWAY' as const, icon: ShoppingBag },
                { id: 'DELIVERY' as const, icon: Truck },
              ]).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`pd-service-btn${service === s.id ? ' is-active' : ''}`}
                  onClick={() => onServiceClick(s.id)}
                >
                  <BtnIcon icon={s.icon} />
                  {s.id}
                </button>
              ))}
            </div>

            <div className="pd-summary">
              <span className="pd-counts" style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
                Items {summary.itemCount} · Qty {summary.qty}
              </span>
              <span className="label">Subtotal</span>
              <span className="val">{money(summary.lineSubtotal)}</span>
              <span className="label">Discount</span>
              <span className="val">{money(discountType === 2 ? summary.itemDiscount : summary.billDiscount)}</span>
              <span className="label">Tax</span>
              <span className="val">{money(summary.tax)}</span>
              <span className="total-label">TOTAL</span>
              <span className="total-val">{money(summary.total)}</span>
            </div>

            <div className="pd-quick">
              <button type="button" className="pd-chip is-danger" onClick={deleteSelected}>
                <BtnIcon icon={Trash2} /> Delete
              </button>
              <button type="button" className="pd-chip is-brand" onClick={clearData}>
                <BtnIcon icon={Plus} /> New KOT
              </button>
              <button type="button" className="pd-chip is-brand" onClick={() => openQtyChange()}>
                <BtnIcon icon={SlidersHorizontal} /> Change Qty
              </button>
              <button type="button" className="pd-chip is-amber" onClick={() => openPriceChange()}>
                <BtnIcon icon={Tag} /> Change Price
              </button>
              <button type="button" className="pd-chip is-amber">
                <BtnIcon icon={Percent} /> Line Discount
              </button>
              <button type="button" className="pd-chip is-blue" onClick={openModifierForSelection}>
                <BtnIcon icon={StickyNote} /> Notes
              </button>
            </div>
          </div>
        </section>

        <aside className="pd-panel pd-group-col">
          <button type="button" className="pd-cat pd-top-move">
            TOP MOVE
          </button>
          <div
            ref={groupStripRef}
            className="pd-cats"
            onPointerDown={onGroupStripPointerDown}
            onPointerMove={onGroupStripPointerMove}
            onPointerUp={onGroupStripPointerUp}
            onPointerCancel={onGroupStripPointerUp}
          >
            {stripButtons.map((c) => (
              <button
                key={`${c.kind}-${c.id}`}
                type="button"
                className={`pd-cat${c.kind !== 'group' ? ' is-sub' : ''}${activeStripId === c.id ? ' is-active' : ''}`}
                onClick={() =>
                  onStripTap(() => {
                    if (c.kind === 'group') onGroupClick(c.id)
                    else if (c.kind === 'sub') onSubGroupClick(c.id)
                    else onSubSubClick(c.id)
                  })
                }
              >
                {c.name}
              </button>
            ))}
          </div>
          {stripLevel !== 'group' ? (
            <button type="button" className="pd-cat pd-back" onClick={onBack}>
              <ChevronLeft size={14} /> Back
            </button>
          ) : null}
        </aside>

        <section className="pd-panel pd-right">
          {flpAreas.length ? (
            <div className="pd-flp-area">
              {flpAreas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`pd-area-btn is-${flpAreaTone(a)}${areaId === a.id ? ' is-on' : ''}`}
                  onClick={() => areaButtonClick(a)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          ) : null}
          <label className="pd-search">
            <Search size={14} color="var(--text-3)" />
            <input
              value={query}
              onChange={(e) => {
                const next = e.target.value
                setQuery(next)
                if (next.trim()) dismissTableSelectionUi()
              }}
              onFocus={() => dismissTableSelectionUi()}
              placeholder="Search item / barcode"
            />
            {query ? (
              <button
                type="button"
                className="pd-search-clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <X size={12} />
              </button>
            ) : null}
          </label>

          {crumb ? <div className="pd-crumb">{crumb}</div> : null}

          {tablePopupOpen ? (
            <div className="pd-table-popup">
              <div className="pd-table-popup-bar">
                <strong>
                  {isTablePopup === 1 && tableName
                    ? `Chairs · ${tableName}`
                    : currentArea?.name || 'Tables'}
                </strong>
                <button type="button" className="pd-table-home" onClick={dismissTableSelectionUi}>
                  <Home size={14} /> Home
                </button>
              </div>
              {tablePopupMode === 'kots' ? (
                <div className="pd-table-grid">
                  {occupiedKots.length === 0 ? (
                    <p className="pd-cat-msg">No open KOTs in this area</p>
                  ) : (
                    occupiedKots.map((k) => (
                      <button
                        key={k.kotMasterId}
                        type="button"
                        className={`pd-seat pd-seat-order${normalizeSupply(currentArea?.supplyType) === 'DELIVERY' ? ' is-delivery' : ''}`}
                        onClick={() => void kotTileClick(k)}
                      >
                        <span className="pd-seat-glyph" aria-hidden>
                          {normalizeSupply(currentArea?.supplyType) === 'DELIVERY' ? (
                            <Truck size={28} strokeWidth={1.8} />
                          ) : (
                            <ShoppingBag size={28} strokeWidth={1.8} />
                          )}
                        </span>
                        <span className="pd-seat-name">{k.kotNo}</span>
                        {k.pax > 0 ? <small className="pd-seat-pill">{k.pax} pax</small> : null}
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <>
                  {isTablePopup !== 1 ? (
                  <div className="pd-table-grid">
                    {tablesForArea.map((t) => {
                      const occ = occupiedByTable.get(t.id) ?? []
                      const occupied = occ.length > 0
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`pd-seat pd-seat-table${occupied ? ' is-busy' : ' is-free'}${tableId === t.id ? ' is-on' : ''}`}
                          onClick={() => void tableBtnClick(t)}
                        >
                          {occupied && occ[0].pax > 0 ? <em className="pd-tbl-pax">{occ[0].pax}</em> : null}
                          <span className="pd-seat-glyph" aria-hidden>
                            <TableGlyph />
                          </span>
                          <span className="pd-seat-name">{t.name}</span>
                          {occupied ? (
                            <small className="pd-seat-pill">{occ[0].kotNo}</small>
                          ) : (
                            <small className="pd-seat-status">Free</small>
                          )}
                        </button>
                      )
                    })}
                    {tablesForArea.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
                  </div>
                  ) : null}
                  {chairPromptOpen && tableId > 0 && (occupiedByTable.get(tableId) ?? []).length > 0 ? (
                    <div className="pd-chair-grid">
                      {kotSelectOpen ? <p className="pd-ol-label">Select KOT chair</p> : null}
                      {Array.from({ length: Math.max(1, tablesForArea.find((t) => t.id === tableId)?.seats || 4) }, (_, i) => i + 1).map((n) => {
                        const occ = (occupiedByTable.get(tableId) ?? []).find((k) => k.chairNo === n)
                        return (
                          <button
                            key={n}
                            type="button"
                            className={`pd-seat pd-seat-chair${occ ? ' is-busy' : ' is-free'}${chairNo === n ? ' is-on' : ''}`}
                            onClick={() => {
                              const t = tablesForArea.find((x) => x.id === tableId)
                              if (!t) return
                              if (kotSelectOpen) {
                                const freeChair = Array.from(
                                  { length: Math.max(1, t.seats || 4) },
                                  (_, i) => i + 1,
                                ).find((c) => !(occupiedByTable.get(tableId) ?? []).some((k) => k.chairNo === c)) ?? 0
                                void pickKotToCombine(occ ?? null, occ ? 0 : n || freeChair)
                                return
                              }
                              void chairBtnClick(n, t)
                            }}
                          >
                            <span className="pd-seat-glyph" aria-hidden>
                              <ChairGlyph />
                            </span>
                            <span className="pd-seat-name">CH {n}</span>
                            {occ ? <small className="pd-seat-pill">{occ.kotNo}</small> : <small className="pd-seat-status">Free</small>}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
          <div className="pd-products">
            {catalogueState === 'loading' ? (
              <p className="pd-cat-msg">Loading menu…</p>
            ) : catalogueState === 'error' ? (
              <p className="pd-cat-msg">{catalogueError}</p>
            ) : products.length === 0 ? (
              <p className="pd-cat-msg">{emptyHint}</p>
            ) : (
              products.map((p) => (
                <button key={p.id} type="button" className="pd-product" onClick={() => onItemClick(p)}>
                  <span className="pd-product-name">
                    {p.name}
                    {p.sub && p.sub !== p.name ? <span className="pd-product-sub">{p.sub}</span> : null}
                  </span>
                  <span className="pd-product-price">AED {money(p.price)}</span>
                </button>
              ))
            )}
          </div>
          )}

          <div className="pd-actions">
            <div className="pd-groups">
              <div className="pd-group">
                <div className="pd-group-title">ORDER</div>
                <div className="pd-group-btns">
                  <button type="button" className="pd-act" onClick={onOrderListClick}>
                    <BtnIcon icon={ClipboardList} /> <span>Order List</span>
                  </button>
                  <button type="button" className="pd-act" onClick={onKotJoinClick}>
                    <BtnIcon icon={GitMerge} /> <span>KOT Join</span>
                  </button>
                  <button type="button" className="pd-act">
                    <BtnIcon icon={Printer} /> <span>Reprint KOT</span>
                  </button>
                  <button
                    type="button"
                    className="pd-act"
                    onClick={() => void onSaveKot()}
                    disabled={savingKot}
                  >
                    <BtnIcon icon={Save} /> <span>{savingKot ? 'Saving…' : 'Save KOT'}</span>
                  </button>
                  <button
                    type="button"
                    className={`pd-act${remarks.trim() ? ' is-on' : ''}`}
                    title={remarks.trim() || 'Comments'}
                    onClick={() => {
                      setCommentsDraft(remarks)
                      setCommentsOpen(true)
                    }}
                  >
                    <BtnIcon icon={MessageSquare} /> <span>Comments</span>
                  </button>
                </div>
              </div>
              <div className="pd-group">
                <div className="pd-group-title">BILL</div>
                <div className="pd-group-btns">
                  <button type="button" className="pd-act is-amber" onClick={onDiscountClick}>
                    <BtnIcon icon={Percent} /> <span>Discount</span>
                  </button>
                  <button type="button" className="pd-act is-blue">
                    <BtnIcon icon={Printer} /> <span>Print Bill</span>
                  </button>
                  <button type="button" className="pd-act is-blue">
                    <BtnIcon icon={FileText} /> <span>Dummy Bill</span>
                  </button>
                  <button
                    type="button"
                    className="pd-act is-danger"
                    onClick={onBillCancelClick}
                    disabled={cancelBusy}
                  >
                    <BtnIcon icon={Ban} /> <span>Cancel Bill</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pd-entry">
              <span className={`pd-entry-qty${Number(padQty) < 0 ? ' is-return' : ''}`}>QTY {padQty}</span>
              <span>{entry || '0'}</span>
            </div>

            <div className="pd-keypad-wrap">
              <div className="pd-keys">
                {KEYS.map((k) => (
                  <button key={k} type="button" className="pd-key" onClick={() => onKey(k)}>
                    {k}
                  </button>
                ))}
              </div>
              <div className="pd-side-acts">
                <button
                  type="button"
                  className={`pd-act${padQty !== '1' ? ' is-qty' : ''}`}
                  onClick={onQtyClick}
                >
                  <BtnIcon icon={Hash} />
                  <span>Qty{padQty !== '1' ? ` ${padQty}` : ''}</span>
                </button>
                <button type="button" className="pd-act">
                  <BtnIcon icon={CircleOff} /> <span>No Sale</span>
                </button>
                <button
                  type="button"
                  className={`pd-act is-amber${Number(padQty) < 0 ? ' is-qty' : ''}`}
                  onClick={onReturnClick}
                  disabled={returnBusy}
                >
                  <BtnIcon icon={RotateCcw} /> <span>Return</span>
                </button>
                <button
                  type="button"
                  className="pd-act is-danger"
                  onClick={onItemCancelClick}
                  disabled={cancelBusy}
                >
                  <BtnIcon icon={MinusCircle} /> <span>Item Cancel</span>
                </button>
                <button type="button" className="pd-act is-blue">
                  <BtnIcon icon={Receipt} /> <span>Receipts</span>
                </button>
                <button type="button" className="pd-act" onClick={() => requestAdmin('area-change')}>
                  <BtnIcon icon={MapPinned} /> <span>Area Change</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              className="pd-pay"
              onClick={() => void onSettlementClick()}
              disabled={settleOpening || savingKot}
            >
              <BtnIcon icon={CreditCard} size={16} />
              PAY <em>AED {money(summary.total)}</em>
            </button>
          </div>
        </section>
      </div>

      <footer className="pd-status">
        <span>
          Counter 01&nbsp;&nbsp;&nbsp;{waiter.toUpperCase()} : {waiter.toUpperCase()}
        </span>
        <span>{formatClock(now)}</span>
      </footer>

      {alertBox ? (
        <div
          className={`pd-alert-overlay pd-alert-${alertBox.kind}`}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && alertBox.kind !== 'question') closeAlert(true)
          }}
        >
          <div className="pd-alert" role="alertdialog" aria-modal="true" aria-labelledby="pd-alert-title">
            <div className="pd-alert-icon" aria-hidden>
              {alertBox.kind === 'success' ? (
                <CheckCircle2 size={34} strokeWidth={2.2} />
              ) : alertBox.kind === 'warning' ? (
                <AlertTriangle size={34} strokeWidth={2.2} />
              ) : alertBox.kind === 'question' ? (
                <HelpCircle size={34} strokeWidth={2.2} />
              ) : (
                <Info size={34} strokeWidth={2.2} />
              )}
            </div>
            <p className="pd-alert-kicker">{alertBox.title}</p>
            <h2 id="pd-alert-title" className="pd-alert-msg">
              {alertBox.message}
            </h2>
            <div className="pd-alert-actions">
              {alertBox.kind === 'question' ? (
                <>
                  <button
                    ref={alertOkRef}
                    type="button"
                    className="pd-alert-btn is-yes"
                    onClick={() => closeAlert(true)}
                  >
                    Yes
                  </button>
                  <button type="button" className="pd-alert-btn is-no" onClick={() => closeAlert(false)}>
                    No
                  </button>
                </>
              ) : (
                <button
                  ref={alertOkRef}
                  type="button"
                  className="pd-alert-btn is-ok"
                  onClick={() => closeAlert(true)}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {lastInfo ? (
        <div className="pd-last-info">
          Last {money(lastInfo.net)} · Paid {money(lastInfo.paid)} · Change {money(lastInfo.change)}
          {lastInfo.billNo ? ` · Bill ${lastInfo.billNo}` : ''}
        </div>
      ) : null}

      {rowMenu ? (
        <div
          className="pd-row-menu"
          style={{ left: rowMenu.x, top: rowMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openModifierForm(rowMenu.key)}
          >
            Add Modifier
          </button>
          <button
            type="button"
            onClick={() => openQtyChange(rowMenu.key)}
          >
            Change Qty
          </button>
          <button
            type="button"
            onClick={() => openPriceChange(rowMenu.key, true)}
          >
            Price Change
          </button>
        </div>
      ) : null}

      {notesOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModifierForm()
          }}
        >
          <div
            className="pd-mod-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-mod-title"
          >
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <StickyNote size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Kitchen Message</p>
                  <h2 id="pd-mod-title" className="pd-mod-item-name">
                    {notesLine?.item || '- - -'}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeModifierForm} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-mod-top">
              <div className="pd-mod-top-row">
                <button type="button" className="pd-mod-clear" onClick={() => setNotesText('')}>
                  Clear
                </button>
              </div>
              <textarea
                ref={modifierTextRef}
                className="pd-mod-text"
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={1}
              />
            </div>
            <div className="pd-mod-chips">
              {modifiers.length === 0 ? (
                <p className="pd-cat-msg">No modifiers on this branch</p>
              ) : (
                modifiers.map((m, i) => (
                  <button
                    key={`${m.id}-${m.name}-${i}`}
                    type="button"
                    className="pd-mod-chip"
                    onClick={() => appendModifier(m.name)}
                  >
                    {m.name}
                  </button>
                ))
              )}
            </div>
            <div className="pd-mod-foot">
              <button
                type="button"
                className="pd-mod-foot-btn"
                onClick={() => modifierTextRef.current?.focus()}
              >
                KeyBoard
              </button>
              <span className="pd-mod-foot-spacer" />
              <button type="button" className="pd-mod-foot-btn is-ok" onClick={applyModifier}>
                Ok
              </button>
              <button type="button" className="pd-mod-foot-btn is-close" onClick={closeModifierForm}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {qtyChangeOpen && qtyChangeLine ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelQtyChange()
          }}
        >
          <div className="pd-qty-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-qty-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Hash size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Quantity Change</p>
                  <h2 id="pd-qty-title" className="pd-mod-item-name">
                    {qtyChangeLine.item}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={cancelQtyChange} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields">
                <div className="pd-qty-row">
                  <span>Current Qty</span>
                  <strong>{qtyChangeLine.qty}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>New Qty</span>
                  <input
                    ref={qtyChangeRef}
                    className="pd-qty-input"
                    value={qtyChangeNew}
                    onChange={(e) => setQtyChangeNew(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyQtyChange()
                      if (e.key === 'Escape') cancelQtyChange()
                    }}
                    inputMode="decimal"
                    placeholder="Enter qty…"
                  />
                </div>
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {KEYS.map((k) => (
                    <button key={k} type="button" className="pd-key" onClick={() => onQtyChangeKey(k)}>
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={applyQtyChange}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={cancelQtyChange}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {priceChangeOpen && priceChangeLine ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelPriceChange()
          }}
        >
          <div className="pd-price-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-price-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Tag size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Price Change..</p>
                  <h2 id="pd-price-title" className="pd-mod-item-name">
                    {priceChangeLine.item}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={cancelPriceChange} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-price-body">
              <div className="pd-price-fields">
                <div className="pd-qty-row">
                  <span>BarCode</span>
                  <strong>{priceChangeLine.barcode || '—'}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>Current Price</span>
                  <strong>{money(priceChangeLine.price)}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>New Price</span>
                  <input
                    ref={priceUnitRef}
                    className={`pd-qty-input${priceFocus === 'unit' ? ' is-focus' : ''}`}
                    value={priceUnit}
                    onFocus={() => setPriceFocus('unit')}
                    onChange={(e) => {
                      setPriceFocus('unit')
                      syncFromUnit(e.target.value.replace(/[^\d.]/g, '').slice(0, 12))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyPriceChange()
                      if (e.key === 'Escape') cancelPriceChange()
                    }}
                    inputMode="decimal"
                  />
                </div>
                <div className="pd-price-vat-row">
                  <div className="pd-qty-row">
                    <span>VAT %</span>
                    <strong>{money(priceVatPerc)}</strong>
                  </div>
                  <div className="pd-qty-row">
                    <span>VAT Amount</span>
                    <strong>
                      {money(
                        priceUnit !== '' && Number.isFinite(Number(priceUnit))
                          ? round2(Number(priceUnit) * (priceVatPerc / 100))
                          : round2(priceChangeLine.price * (priceVatPerc / 100)),
                      )}
                    </strong>
                  </div>
                </div>
                <div className="pd-qty-row">
                  <span>Price With VAT</span>
                  <input
                    ref={priceVatRef}
                    className={`pd-qty-input${priceFocus === 'withVat' ? ' is-focus' : ''}`}
                    value={priceWithVat}
                    onFocus={() => setPriceFocus('withVat')}
                    onChange={(e) => {
                      setPriceFocus('withVat')
                      syncFromWithVat(e.target.value.replace(/[^\d.]/g, '').slice(0, 12))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyPriceChange()
                      if (e.key === 'Escape') cancelPriceChange()
                    }}
                    inputMode="decimal"
                  />
                </div>
                {priceError ? <p className="pd-price-err">{priceError}</p> : null}
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {KEYS.map((k) => (
                    <button key={k} type="button" className="pd-key" onClick={() => onPricePadKey(k)}>
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={applyPriceChange}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={cancelPriceChange}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {discountOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDiscountDialog()
          }}
        >
          <div className="pd-price-dialog pd-disc-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-disc-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Percent size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Discount</p>
                  <h2 id="pd-disc-title" className="pd-mod-item-name">
                    {discModeOn ? (discountMode === 2 ? 'On Item' : 'On Bill') : 'Select Discount Mode First'}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeDiscountDialog} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-price-body">
              <div className="pd-price-fields">
                <div className="pd-disc-modes">
                  <button
                    type="button"
                    className={`pd-disc-mode${discountMode === 2 ? ' is-on' : ''}`}
                    onClick={() => selectDiscountMode(2)}
                  >
                    Discount On Item
                  </button>
                  <button
                    type="button"
                    className={`pd-disc-mode${discountMode === 0 ? ' is-on' : ''}${!discBillAllowed ? ' is-blocked' : ''}`}
                    onClick={() => selectDiscountMode(0)}
                  >
                    Discount On Bill
                  </button>
                </div>
                <div className="pd-qty-row">
                  <span>Sub Total</span>
                  <strong>{money(discountBase)}</strong>
                </div>
                {discountMode !== 2 ? (
                  <div className="pd-qty-row">
                    <span>{discModeOn ? 'Discount Amount' : 'Select Discount Mode First'}</span>
                    <input
                      ref={discountAmountRef}
                      className={`pd-qty-input${discountFocus === 'amount' ? ' is-focus' : ''}`}
                      value={discountAmount}
                      readOnly={!discModeOn}
                      disabled={!discModeOn}
                      onFocus={() => {
                        if (discModeOn && discountMode === 0) setDiscountFocus('amount')
                      }}
                      onChange={(e) => onDiscountAmountChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void applyDiscountDone()
                        if (e.key === 'Escape') closeDiscountDialog()
                      }}
                      inputMode="decimal"
                    />
                  </div>
                ) : null}
                <div className="pd-qty-row">
                  <span>{discountMode === 2 ? 'Item Disc %' : 'Disc Percentage'}</span>
                  <input
                    ref={discountPercentRef}
                    className={`pd-qty-input${discountFocus === 'percent' ? ' is-focus' : ''}`}
                    value={discountPercent}
                    disabled={!discModeOn}
                    onFocus={() => {
                      if (discModeOn) setDiscountFocus('percent')
                    }}
                    onChange={(e) => onDiscountPercentChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void applyDiscountDone()
                      if (e.key === 'Escape') closeDiscountDialog()
                    }}
                    inputMode="decimal"
                  />
                </div>
                <div className="pd-disc-quick">
                  {discButtons.map((pct, i) => (
                    <button
                      key={`dsc-${i}-${pct}`}
                      type="button"
                      className="pd-disc-pct"
                      disabled={!discModeOn}
                      onClick={() => onDiscountPercentChange(String(pct))}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                {discountMode !== 2 ? (
                  <>
                    <div className="pd-qty-row">
                      <span>Taxable</span>
                      <strong>{money(discTaxable)}</strong>
                    </div>
                    <div className="pd-qty-row">
                      <span>{discTaxLabel}</span>
                      <strong>{money(discTax)}</strong>
                    </div>
                    <div className="pd-qty-row">
                      <span>Net Amount</span>
                      <strong>{money(discNet)}</strong>
                    </div>
                  </>
                ) : null}
                {discountError ? <p className="pd-price-err">{discountError}</p> : null}
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="pd-key"
                      disabled={!discModeOn}
                      onClick={() => onDiscountPadKey(k)}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button
                    type="button"
                    className="pd-qty-done"
                    disabled={!discModeOn || savingKot}
                    onClick={() => void applyDiscountDone()}
                  >
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={closeDiscountDialog}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {commentsOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setRemarks(commentsDraft)
              setCommentsOpen(false)
            }
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <MessageSquare size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">KOT Remarks</p>
                  <h2 className="pd-mod-item-name">Comments</h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => {
                  setRemarks(commentsDraft)
                  setCommentsOpen(false)
                }}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <textarea
                className="pd-mod-text pd-ol-remarks"
                value={commentsDraft}
                onChange={(e) => {
                  const next = e.target.value.slice(0, 250)
                  setCommentsDraft(next)
                  setRemarks(next)
                }}
                rows={4}
                placeholder="Remarks…"
                autoFocus
              />
            </div>
            <div className="pd-mod-foot">
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                onClick={() => {
                  setRemarks(commentsDraft)
                  setCommentsOpen(false)
                }}
              >
                Ok
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-close"
                onClick={() => {
                  setRemarks(commentsDraft)
                  setCommentsOpen(false)
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {itemCancelOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelBusy) closeItemCancel()
          }}
        >
          <div className="pd-ol-dialog pd-ol-wide pd-ic-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-ic-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <MinusCircle size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Item Remove</p>
                  <h2 id="pd-ic-title" className="pd-mod-item-name">
                    KOT {kotLabel}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={closeItemCancel}
                disabled={cancelBusy}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <p className="pd-ic-hint">Tap Qty to change quantity. Tick Remove, then Remove. You cannot remove the last item.</p>
              <div className="pd-ic-table-wrap">
                <table className="pd-grid pd-ic-grid">
                  <thead>
                    <tr>
                      <th>SL</th>
                      <th>KOT</th>
                      <th>Item Name</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                      <th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedKotLines().map((line, i) => {
                      const marked = Boolean(itemCancelIds[line.kotChildId])
                      return (
                        <tr key={line.kotChildId} className={marked ? 'is-marked' : ''}>
                          <td>{i + 1}</td>
                          <td>{kotLabel}</td>
                          <td>
                            <span className="pd-item-name">{line.item}</span>
                            {line.modifiers ? <span className="pd-item-mod">↳ {line.modifiers}</span> : null}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pd-ic-qty-btn"
                              disabled={cancelBusy}
                              onClick={() => openItemCancelQty(line)}
                            >
                              {line.qty}
                            </button>
                          </td>
                          <td className="num">{money(line.price)}</td>
                          <td className="num">{money(line.price * line.qty)}</td>
                          <td>
                            <button
                              type="button"
                              className={`pd-ic-check${marked ? ' is-on' : ''}`}
                              disabled={cancelBusy}
                              aria-pressed={marked}
                              onClick={() =>
                                setItemCancelIds((prev) => ({
                                  ...prev,
                                  [line.kotChildId]: !prev[line.kotChildId],
                                }))
                              }
                            >
                              {marked ? '✔' : ''}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="pd-mod-foot">
              <button
                type="button"
                className="pd-mod-foot-btn pd-ic-covers"
                disabled={cancelBusy}
                onClick={() => {
                  setItemCancelCoversDraft(String(covers > 0 ? covers : 1))
                  setItemCancelCoversOpen(true)
                }}
              >
                <BtnIcon icon={Users} />
                <span>{covers} covers</span>
              </button>
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                onClick={onItemRemoveClick}
                disabled={cancelBusy}
              >
                {cancelBusy ? 'Saving…' : 'Remove'}
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-close"
                onClick={closeItemCancel}
                disabled={cancelBusy}
              >
                Close
              </button>
            </div>

            {itemCancelQtyOpen && itemCancelQtyLine ? (
              <div className="pd-ic-qty-panel" role="dialog" aria-labelledby="pd-ic-qty-title">
                <p id="pd-ic-qty-title" className="pd-ic-qty-name">{itemCancelQtyLine.item}</p>
                <div className="pd-qty-body">
                  <div className="pd-qty-fields">
                    <div className="pd-qty-row">
                      <span>Current Qty</span>
                      <strong>{itemCancelQtyLine.qty}</strong>
                    </div>
                    <div className="pd-qty-row">
                      <span>New Qty</span>
                      <input
                        className="pd-qty-input"
                        value={itemCancelQtyNew}
                        onChange={(e) =>
                          setItemCancelQtyNew(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onItemCancelQtyDone()
                          if (e.key === 'Escape') setItemCancelQtyOpen(false)
                        }}
                        inputMode="decimal"
                        autoFocus
                        placeholder="Enter qty…"
                      />
                    </div>
                  </div>
                  <div className="pd-qty-pad">
                    <div className="pd-qty-keys">
                      {KEYS.map((k) => (
                        <button key={k} type="button" className="pd-key" onClick={() => onItemCancelQtyKey(k)}>
                          {k}
                        </button>
                      ))}
                    </div>
                    <div className="pd-qty-actions">
                      <button type="button" className="pd-qty-done" onClick={onItemCancelQtyDone} disabled={cancelBusy}>
                        Done
                      </button>
                      <button
                        type="button"
                        className="pd-qty-cancel"
                        onClick={() => {
                          setItemCancelQtyOpen(false)
                          setItemCancelQtyNew('')
                        }}
                        disabled={cancelBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {itemCancelCoversOpen ? (
              <div className="pd-ic-qty-panel pd-ic-covers-panel" role="dialog" aria-labelledby="pd-ic-pax-title">
                <p id="pd-ic-pax-title" className="pd-ic-qty-name">Enter No. of Persons</p>
                <p className="pd-covers-value">{itemCancelCoversDraft || '0'}</p>
                <div className="pd-covers-keys">
                  {KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="pd-key"
                      onClick={() => {
                        if (k === 'C') {
                          setItemCancelCoversDraft((prev) => prev.slice(0, -1))
                          return
                        }
                        if (k === '.') return
                        setItemCancelCoversDraft((prev) => (prev === '0' ? k : (prev + k).slice(0, 3)))
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={() => void saveItemCancelCovers()} disabled={cancelBusy}>
                    Ok
                  </button>
                  <button
                    type="button"
                    className="pd-qty-cancel"
                    onClick={() => setItemCancelCoversOpen(false)}
                    disabled={cancelBusy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {adminOpen ? (
        <div
          className="pd-mod-overlay pd-admin-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !adminBusy) closeAdminDialog()
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true" aria-labelledby="pd-admin-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <ShieldCheck size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Admin Login</p>
                  <h2 id="pd-admin-title" className="pd-mod-item-name">
                    ADMIN / CHIEF CASHIER
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeAdminDialog} disabled={adminBusy} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <form
              className="pd-ol-body pd-admin-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submitAdminLogin()
              }}
            >
              <label className={`pd-admin-field${adminFocus === 'login' ? ' is-on' : ''}`}>
                <span>Login</span>
                <input
                  ref={adminLoginRef}
                  value={adminLogin}
                  onChange={(e) => setAdminLogin(e.target.value)}
                  onFocus={() => setAdminFocus('login')}
                  onKeyDown={onAdminLoginKeyDown}
                  disabled={adminBusy}
                  autoComplete="username"
                  enterKeyHint="next"
                />
              </label>
              <label className={`pd-admin-field${adminFocus === 'password' ? ' is-on' : ''}`}>
                <span>Password</span>
                <input
                  ref={adminPasswordRef}
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onFocus={() => setAdminFocus('password')}
                  onKeyDown={onAdminPasswordKeyDown}
                  disabled={adminBusy}
                  autoComplete="current-password"
                  enterKeyHint="done"
                />
              </label>
              {adminError ? <p className="pd-admin-err">{adminError}</p> : null}
              <div className="pd-admin-keys">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="pd-key"
                    disabled={adminBusy}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAdminPadKey(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="pd-mod-foot pd-admin-foot">
                <span className="pd-mod-foot-spacer" />
                <button type="submit" className="pd-mod-foot-btn is-ok" disabled={adminBusy}>
                  {adminBusy ? 'Checking…' : 'Login'}
                </button>
                <button type="button" className="pd-mod-foot-btn is-close" onClick={closeAdminDialog} disabled={adminBusy}>
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {billConfirmOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelBusy) setBillConfirmOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Ban size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">KOT Cancel</p>
                  <h2 className="pd-mod-item-name">KOT {kotLabel}</h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => setBillConfirmOpen(false)}
                disabled={cancelBusy}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <p className="pd-confirm-msg">Are You Sure to Cancel KOT........</p>
            </div>
            <div className="pd-mod-foot">
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                onClick={() => void runBillCancel(adminCreds)}
                disabled={cancelBusy}
              >
                {cancelBusy ? 'Cancelling…' : 'Yes'}
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-close"
                onClick={() => setBillConfirmOpen(false)}
                disabled={cancelBusy}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tableFloorOpen ? (
        <div
          className="pd-mod-overlay pd-ol-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissTableSelectionUi()
          }}
        >
          <div className="pd-floor-dialog pd-ol-screen" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Utensils size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Table Layout</p>
                  <h2 className="pd-mod-item-name">{currentArea?.name || 'Tables'}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={dismissTableSelectionUi} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className={`pd-floor-canvas${floorMap?.hasFloor ? ' is-map' : ''}`}>
              {floorMap == null ? (
                <p className="pd-floor-note">Loading floor…</p>
              ) : floorMap.hasFloor ? (
                <FloorRuntimeCanvas
                  border={floorMap.border}
                  shapes={floorMap.shapes}
                  tables={floorMap.tables.map((t) => {
                      const occ = occupiedByTable.get(t.tableId) ?? []
                      return {
                        ...t,
                        occupied: occ.length > 0,
                        pax: occ[0]?.pax,
                        kotNo: occ[0]?.kotNo,
                      }
                    })}
                  onTableClick={(id) => {
                    const t = tablesInArea.find((x) => x.id === id) ?? tablesForArea.find((x) => x.id === id)
                    if (t) void floorTableClick(t)
                  }}
                />
              ) : (
                <>
              <p className="pd-floor-note">No floor map defined for this Area. Showing default table layout.</p>
              <div className="pd-table-grid is-floor">
                {tablesInArea.map((t) => {
                  const occ = occupiedByTable.get(t.id) ?? []
                  const occupied = occ.length > 0
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`pd-seat pd-seat-table is-live${occupied ? ' is-busy' : ' is-free'}`}
                      onClick={() => void floorTableClick(t)}
                    >
                      <span className="pd-seat-name">{t.name}</span>
                      {occupied ? (
                        <span className="pd-fd-tags">
                          {occ[0].kotNo ? <b className="pd-fd-kot">{occ[0].kotNo}</b> : null}
                          <b className="pd-fd-pax">{occ[0].pax || 0} pax</b>
                        </span>
                      ) : (
                        <small className="pd-seat-status">Free</small>
                      )}
                    </button>
                  )
                })}
                {tablesInArea.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {coversPrompt ? (
        <div className="pd-mod-overlay" role="presentation">
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Users size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">No. of Persons</p>
                  <h2 className="pd-mod-item-name">{coversPrompt.table.name}</h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => {
                  setCoversPrompt(null)
                  toast('No. of persons is required.')
                }}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <p className="pd-covers-value">{coversDraft || '0'}</p>
              <div className="pd-covers-keys">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', 'OK'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`pd-key${k === 'OK' ? ' is-ok' : ''}`}
                    onClick={() => {
                      if (k === 'C') setCoversDraft('')
                      else if (k === 'OK') void confirmCovers()
                      else setCoversDraft((prev) => `${prev === '0' ? '' : prev}${k}`.slice(0, 3))
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {areaOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAreaOpen(false)
          }}
        >
          <div className="pd-ol-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <MapPinned size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Area / Table</p>
                  <h2 className="pd-mod-item-name">{currentArea?.name || 'Select an area'}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setAreaOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <div className="pd-ol-filters">
                {(['DINE IN', 'TAKEAWAY', 'DELIVERY'] as ServiceKind[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pd-ol-filter${service === s ? ' is-on' : ''}`}
                    onClick={() => onServiceClick(s)}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  className="pd-ol-filter"
                  onClick={() => openCustomerSelect()}
                >
                  <Users size={12} /> Customer
                </button>
              </div>
              <p className="pd-ol-label">Areas</p>
              <div className="pd-ol-chips">
                {areas.filter((a) => areaMatchesService(a, service)).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`pd-ol-chip${areaId === a.id ? ' is-on' : ''}`}
                    onClick={() => {
                      setAreaOpen(false)
                      areaButtonClick(a)
                    }}
                  >
                    {a.name}
                  </button>
                ))}
                {areas.filter((a) => areaMatchesService(a, service)).length === 0 ? (
                  <p className="pd-cat-msg">No area for {service}</p>
                ) : null}
              </div>
              {areaNeedsTable ? (
                <>
                  <p className="pd-ol-label">Tables</p>
                  <div className="pd-ol-chips">
                    {tablesForArea.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`pd-ol-chip${tableId === t.id ? ' is-on' : ''}`}
                        onClick={() => {
                          setAreaOpen(false)
                          void tableBtnClick(t)
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                    {tablesForArea.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
                  </div>
                </>
              ) : (
                <p className="pd-cat-msg">Table not required for this area</p>
              )}
            </div>
            <div className="pd-mod-foot">
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                onClick={() => {
                  if (areaId <= 0) {
                    const match = pickAreaForService(service)
                    if (match) applyArea(match, match.tableCreationType === 0 ? tableId : 0)
                  }
                  setAreaOpen(false)
                }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {customerOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !customerEntryOpen) setCustomerOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Users size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Customer</p>
                  <h2 className="pd-mod-item-name">{customerName || 'Select a customer'}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setCustomerOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <div className="pd-cust-toolbar">
                <label className="pd-search pd-cust-search">
                  <Search size={14} color="var(--text-3)" />
                  <input
                    ref={customerSearchRef}
                    value={customerSearch}
                    onChange={(e) => onCustomerQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void loadCustomers(e.currentTarget.value)
                    }}
                    placeholder="Name, tel, or mobile…"
                  />
                  {customerSearch ? (
                    <button
                      type="button"
                      className="pd-search-clear"
                      aria-label="Clear search"
                      onClick={() => onCustomerQueryChange('')}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </label>
                <button type="button" className="pd-cust-new" onClick={openNewCustomer}>
                  <UserPlus size={14} /> New
                </button>
              </div>
              <div className="pd-ol-list">
                {customerState === 'loading' ? <p className="pd-cat-msg">Searching…</p> : null}
                {customerState !== 'loading' && customerRows.length === 0 ? (
                  <div className="pd-cust-empty">
                    <p>No customers found</p>
                    <button type="button" className="pd-cust-new is-block" onClick={openNewCustomer}>
                      <UserPlus size={14} /> New Customer
                    </button>
                  </div>
                ) : null}
                {customerRows.map((c) => {
                  const sub = [c.mobile, c.telephone, c.code].filter(Boolean).join(' · ')
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`pd-ol-row${customerId === c.id ? ' is-on' : ''}`}
                      onClick={() => pickCustomer(c)}
                    >
                      <strong>{c.name}</strong>
                      <span>{sub || '—'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {customerEntryOpen ? (
        <div
          className="pd-mod-overlay pd-admin-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !customerSaving) setCustomerEntryOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true" aria-labelledby="pd-cust-entry-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <UserPlus size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">New Customer</p>
                  <h2 id="pd-cust-entry-title" className="pd-mod-item-name">
                    Customer Entry
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => setCustomerEntryOpen(false)}
                disabled={customerSaving}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <form
              className="pd-ol-body pd-admin-form"
              onSubmit={(e) => {
                e.preventDefault()
                void saveNewCustomer()
              }}
            >
              <label className="pd-admin-field">
                <span>Customer Name</span>
                <input
                  autoFocus={!customerEntryMobile}
                  value={customerEntryName}
                  onChange={(e) => setCustomerEntryName(e.target.value)}
                  disabled={customerSaving}
                />
              </label>
              <label className="pd-admin-field">
                <span>Mobile Number</span>
                <input
                  ref={customerMobileRef}
                  value={customerEntryMobile}
                  onChange={(e) => setCustomerEntryMobile(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
                  inputMode="tel"
                  disabled={customerSaving}
                />
              </label>
              <label className="pd-admin-field">
                <span>Telephone</span>
                <input
                  value={customerEntryTel}
                  onChange={(e) => setCustomerEntryTel(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
                  inputMode="tel"
                  disabled={customerSaving}
                />
              </label>
              <label className="pd-admin-field">
                <span>Address</span>
                <input
                  value={customerEntryAddress}
                  onChange={(e) => setCustomerEntryAddress(e.target.value.slice(0, 300))}
                  disabled={customerSaving}
                />
              </label>
              {customerEntryError ? <p className="pd-admin-err">{customerEntryError}</p> : null}
              <div className="pd-mod-foot pd-admin-foot">
                <span className="pd-mod-foot-spacer" />
                <button type="submit" className="pd-mod-foot-btn is-ok" disabled={customerSaving}>
                  {customerSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="pd-mod-foot-btn is-close"
                  onClick={() => setCustomerEntryOpen(false)}
                  disabled={customerSaving}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {orderListOpen ? (
        <div
          className="pd-mod-overlay pd-ol-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOrderListOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-screen" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <ClipboardList size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Saved KOTs</p>
                  <h2 className="pd-mod-item-name">Order List</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setOrderListOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <div className="pd-ol-filters">
                {(['ALL', 'DINE IN', 'TAKEAWAY', 'DELIVERY'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pd-ol-filter${orderListSupply === s && orderListAreaId === 0 ? ' is-on' : ''}`}
                    onClick={() => onOrderListSupply(s)}
                  >
                    {s === 'ALL' ? 'All Orders' : s}
                  </button>
                ))}
              </div>
              {areas.length ? (
                <div className="pd-ol-indicate" aria-label="Area colours">
                  {areas.map((a) => {
                    const color = areaSwatch(a.id, a.name)
                    const on = orderListAreaId === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`pd-ol-area${on ? ' is-on' : ''}`}
                        style={{ background: color }}
                        onClick={() => onOrderListArea(a.id)}
                      >
                        {a.name}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <label className="pd-search">
                <Search size={14} color="var(--text-3)" />
                <input
                  value={orderListSearch}
                  onChange={(e) => setOrderListSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadOrderList(orderListSupply, e.currentTarget.value, orderListAreaId)
                  }}
                  placeholder="KOT number"
                />
                {orderListSearch ? (
                  <button
                    type="button"
                    className="pd-search-clear"
                    aria-label="Clear search"
                    onClick={() => {
                      setOrderListSearch('')
                      void loadOrderList(orderListSupply, '', orderListAreaId)
                    }}
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </label>
              <div className="pd-ol-cards">
                {orderListState === 'loading' ? <p className="pd-cat-msg">Loading orders…</p> : null}
                {orderListState === 'error' ? <p className="pd-cat-msg">{orderListError}</p> : null}
                {orderListState === 'idle' && orderListRows.length === 0 ? (
                  <p className="pd-cat-msg">No open KOTs</p>
                ) : null}
                {orderListRows.map((row) => {
                  const color = areaSwatch(row.areaId, row.areaName)
                  return (
                    <button
                      key={row.kotMasterId}
                      type="button"
                      className="pd-ol-card"
                      style={{ background: color }}
                      disabled={loadingKot}
                      onClick={() => void takeOrder(row.kotMasterId, false)}
                    >
                      <span className="pd-ol-card-area">
                        {row.supplyType} · {row.areaName || 'Area'}
                      </span>
                      <span className="pd-ol-card-time">{formatKotClock(row.kotTime)}</span>
                      <span className="pd-ol-card-table">
                        Table: {row.tableName || 'N/A'}
                        {row.chairNo > 0 ? ` - Chair: ${row.chairNo}` : ''}
                      </span>
                      <span className="pd-ol-card-pax">PAX: {row.pax || 0}</span>
                      <span className="pd-ol-card-waiter">{row.waiterName || waiter}</span>
                      {row.remarks ? <span className="pd-ol-card-note">{row.remarks}</span> : null}
                      <span className="pd-ol-card-amt">AED {money(row.amount)}</span>
                      <span className="pd-ol-card-kot">KOT No: {row.kotNo}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {settleOpen && settleBill ? (
        <SettlementScreen
          bill={settleBill}
          onClose={closeSettlement}
          onCompleted={onSettlementCompleted}
          onAlreadySettled={onSettlementAlreadySettled}
        />
      ) : null}

      {salesViewerOpen ? (
        <SalesViewerDialog
          areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          onClose={() => setSalesViewerOpen(false)}
        />
      ) : null}

      {counterCloseOpen ? (
        <CounterCloseAllDialog onClose={() => setCounterCloseOpen(false)} />
      ) : null}

      {kotJoinOpen ? (
        <KotJoinDialog
          areas={areas}
          tables={tables}
          waiter={waiter}
          onClose={() => setKotJoinOpen(false)}
          onJoined={onKotJoined}
          onSplit={onKotSplit}
        />
      ) : null}

      {areaMasterOpen ? (
        <AreaMasterDialog
          onClose={() => setAreaMasterOpen(false)}
          onSaved={() => {
            void reloadFloorMasters()
          }}
        />
      ) : null}

      {tableMasterOpen ? (
        <TableMasterDialog
          areas={areas}
          onClose={() => setTableMasterOpen(false)}
          onSaved={() => {
            void reloadFloorMasters()
          }}
        />
      ) : null}

      {floorDesignOpen ? (
        <FloorDesignDialog
          onClose={() => setFloorDesignOpen(false)}
        />
      ) : null}

      {areaChangeOpen ? (
        <AreaChangeDialog
          areas={areas}
          tables={tables}
          onClose={() => setAreaChangeOpen(false)}
          onTransferred={onAreaChanged}
        />
      ) : null}
    </div>
  )
}
