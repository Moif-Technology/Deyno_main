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
 *   btnSaveKOT_Click → SaveBilDetailsToHoldTable("BillHold","KotSave")
 *   btnOrderList_Click → OrderListFrm → DisplayKOT (always load as NEW, no combine)
 *
 * Modifir column follows dgvItemList / Modifierfrm:
 *   CellClick on Modifir (header "M") → Kitchen Message dialog
 *   Right-click "Add Modifier" → same dialog
 *   ItemName paints ↳ modifier in green under the item
 *   Ok writes rtxtmodifier back onto the current row's Modifir cell
 */
import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, Hash, Home, LogOut, Search, Tag, Trash2, X, Printer, Save, MessageSquare, Percent, FileText, Ban, CircleOff, RotateCcw, MinusCircle, Receipt, MapPinned, Utensils, ShoppingBag, Truck, CreditCard, SlidersHorizontal, Plus, ClipboardList, Users, User, ScanBarcode, Sandwich, Soup, Coffee, Flame, Cake, CupSoda, GlassWater, Star, Fish, Salad, Pizza, Drumstick, Beef, Egg, UtensilsCrossed, Smile, Sunrise, MoreHorizontal, Zap, Banknote, Wallet, Smartphone, Globe, Gift, SplitSquareHorizontal, Ellipsis, QrCode, ArrowLeft, CircleCheck, Merge } from 'lucide-react'
import { SessionManager } from '../../utils/sessionManager'
import { clearStaffSession } from '../../utils/pinLoginSession'
import { getEnrollment } from '../../utils/deviceEnrollment'
import { getPosSession } from '../../utils/posSession'
import { apiService, ApiError } from '../../api/apiService'
import { TableCard, TableGlyph } from '../../components/common/TableCard'
import { Toast, type ToastKind } from '../../components/common/Toast'
import './posMain.css'

const NAV = ['New Sale', 'Edit', 'Transactions', 'Credit', 'Reports', 'Admin', 'Settings'] as const
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const

type SplitMethod = 'cash' | 'card' | 'qr'

interface SplitPayment {
  method: SplitMethod
  paid: number
  tip: number
}

const SPLIT_METHODS: { id: SplitMethod; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard },
  { id: 'qr', label: 'QR Payment', icon: QrCode },
]

const PAY_OPTIONS = [
  { id: 'split', label: 'Split Pay', icon: SplitSquareHorizontal },
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Credit Card', icon: CreditCard },
  { id: 'credit', label: 'Credit', icon: Wallet },
  { id: 'mpay', label: 'M-Pay', icon: Smartphone },
  { id: 'online', label: 'Online', icon: Globe },
  { id: 'complimentary', label: 'Complimentary', icon: Gift },
  { id: 'other', label: 'Other Payments', icon: Ellipsis },
] as const

/** A nav dropdown item is either a plain leaf, a leaf that shows a chevron
 * but has no known submenu yet (so no flyout box), or a real flyout parent —
 * whose children can themselves be any of these, for multi-level flyouts. */
type NavMenuEntry = string | { label: string; arrow: true } | { label: string; children: readonly NavMenuEntry[] }

const NAV_MENUS: Partial<Record<(typeof NAV)[number], readonly NavMenuEntry[]>> = {
  'New Sale': [
    'Area Entry',
    'Table Entry',
    'Main Group Entry',
    'Group Entry',
    'Sub Group Entry',
    'Product Entry',
    'Kitchen Message',
    'Combo',
    'Recipe Entry',
    'Barcode Print Utility',
    'Notes Entry',
    'Online Source Entry',
    'Payment Mode Entry',
    'Mess Master Entry',
    'Add On',
    { label: 'Table Booking', children: ['Booking', 'Booking List'] },
    'Floor Design',
  ],
  Edit: [
    'Area Edit',
    'Table Edit',
    'Group Edit',
    'SubGroup Edit',
    'Product Edit',
    'Combo Edit',
    'Recipe List',
    'Mess List',
  ],
  Transactions: [
    'Stock Adjustment',
    'Stock Adjust List',
    { label: 'Production', children: ['Entry', 'List'] },
    'Opening Stock Entry',
    'Stock report',
    'Movement Report',
    {
      label: 'Product Transfer/Receive',
      children: ['Product Request', 'Product receipt', 'Product Transfer', 'Transfer List', 'Receipt List'],
    },
    { label: 'Upload/Download', children: ['Upload To Main Server', 'Download New Item From main server'] },
    { label: 'Purchase', children: ['SupplierList', 'Purchase entry', 'Purchase List', 'Purchase Return', 'Purchase ReturnList'] },
    'Damage Entry',
    'Damage List',
    'Cash/Cash Out',
  ],
  Credit: [
    'Advance Payment',
    'Credit payment Receipt',
    'PaymentList',
    'Os Balance List',
    'ReceiptList',
    'Advance Viewer',
    'Mess Bill Viewer',
  ],
  Reports: [
    'Bill Reprint',
    'Counter Close',
    {
      label: 'Reports Receipt Printer',
      children: [
        'Area Wise report',
        'Group Wise',
        'Item Wise',
        'Item Void Report',
        'Cancel Bill Details',
        'Cancel Bill Summary',
        'CounterClose Reports',
        'Sales BillWise',
        'DayWise',
      ],
    },
    {
      label: 'Reports A4',
      children: [
        'Sales Viewer',
        'Pending Order List',
        'CounterWise',
        'CounterWise Timewise',
        { label: 'Itemwise', children: ['Summary', 'Details'] },
        'Groupwise Summary',
        'Areawise',
        'Waiterwise',
        'Salesman Wise',
        { label: 'Customer Analysis', children: ['Detailed', 'Summary'] },
        'Income Expense',
        'CounterClose Details',
        'Item Void',
        'Production Report',
        'Graph Report',
        {
          label: 'Tax Report',
          children: ['Tax Report', 'Vat Sale', 'Vat Purchase', 'Vat Summary', 'Sales Vat Detailed', 'Sales Vat Summary'],
        },
        'Bill Wise Detailed',
        'Purchase Sales Report',
        'Areawise ItemWise',
        'Itemwise Viewer',
        'Del. Boy commission',
        { label: 'Product Movement', children: ['Fast Move', 'Slow Move'] },
      ],
    },
  ],
}

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
}
type TicketLine = {
  key: number
  productId: number
  item: string
  modifiers: string
  qty: number
  price: number
  disc: number
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
type AreaRow = {
  id: number
  name: string
  supplyType: string
  kotPrefix: string
  tableCreationType: number
}
type TableRow = { id: number; name: string; areaId: number; seats: number; waiterId: number }
type OrderRow = {
  kotMasterId: number
  kotNo: string
  kotTime: string
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
}
type ServiceKind = 'DINE IN' | 'TAKEAWAY' | 'DELIVERY'

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
    }
  }).filter((p) => p.id > 0 && p.name)
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

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
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
/** Shared by the live `summary` memo and any save that needs to total an
 * explicit lines array that hasn't landed in state yet (e.g. mid-move). */
function computeSummary(ls: TicketLine[]) {
  const qty = ls.reduce((n, l) => n + l.qty, 0)
  const subtotal = round2(ls.reduce((n, l) => n + l.price * l.qty, 0))
  const discount = round2(ls.reduce((n, l) => n + l.disc, 0))
  const tax = round2(ls.reduce((n, l) => n + l.tax, 0))
  return {
    itemCount: ls.length,
    qty,
    subtotal,
    discount,
    taxable: round2(subtotal - discount),
    tax,
    total: round2(subtotal - discount + tax),
  }
}

function calcLine(price: number, qty: number, vatPerPc: number, taxRate: number, itemDisc: number) {
  const disc = round2(Math.max(0, itemDisc))
  const subtotal = round2(price * qty - disc)
  const tax =
    disc !== 0
      ? round2(subtotal * (taxRate / 100))
      : vatPerPc > 0
        ? round2(vatPerPc * qty)
        : round2(subtotal * (taxRate / 100))
  return {
    disc,
    tax,
    total: round2(subtotal + tax),
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

/** Shared 7-8-9 / 4-5-6 / 1-2-3 / C-0-. keypad — reused by the main entry pad
 * and every qty/price/discount change dialog. */
function NumberKeypad({
  className = 'pd-keys',
  onKey,
}: {
  className?: string
  onKey: (k: string) => void
}) {
  return (
    <div className={className}>
      {KEYS.map((k) => (
        <button key={k} type="button" className="pd-key" onClick={() => onKey(k)}>
          {k}
        </button>
      ))}
    </div>
  )
}

const QTY_PICKER_ROW_HEIGHT = 32

/** Vertical scroll-wheel style picker (drag or mouse-wheel to change the
 * value) — sits alongside the keypad so the same value can be typed too. */
function QtyScrollPicker({
  value,
  onChange,
  min = 1,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
}) {
  const dragRef = useRef<{ pointerId: number; startY: number; startValue: number } | null>(null)
  const isDraggingRef = useRef(false)
  const prevValueRef = useRef(value)
  const [trackY, setTrackY] = useState(0)
  const [animate, setAnimate] = useState(false)

  // Any value change that didn't come from an in-progress drag (wheel, click,
  // typing on the keypad) rolls the strip in from the row it came from
  // instead of just swapping the numbers in place.
  useEffect(() => {
    if (prevValueRef.current !== value && !isDraggingRef.current) {
      const from = (prevValueRef.current - value) * QTY_PICKER_ROW_HEIGHT
      setAnimate(false)
      setTrackY(from)
      const raf = requestAnimationFrame(() => {
        setAnimate(true)
        setTrackY(0)
      })
      prevValueRef.current = value
      return () => cancelAnimationFrame(raf)
    }
    prevValueRef.current = value
  }, [value])

  function commit(n: number) {
    if (n !== value) onChange(Math.max(min, n))
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    commit(value + (e.deltaY > 0 ? 1 : -1))
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    isDraggingRef.current = true
    setAnimate(false)
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, startValue: value }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const rawPx = drag.startY - e.clientY
    const steps = Math.round(rawPx / QTY_PICKER_ROW_HEIGHT)
    setTrackY(-(rawPx - steps * QTY_PICKER_ROW_HEIGHT))
    commit(drag.startValue + steps)
  }

  function onPointerUp() {
    dragRef.current = null
    isDraggingRef.current = false
    setAnimate(true)
    setTrackY(0)
  }

  return (
    <div
      className="pd-qty-picker"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="pd-qty-picker-highlight" aria-hidden />
      <div
        className={`pd-qty-picker-track${animate ? ' is-settling' : ''}`}
        style={{ transform: `translateY(${trackY}px)` }}
      >
        {[-2, -1, 0, 1, 2].map((offset) => {
          const n = value + offset
          const isCurrent = offset === 0
          return (
            <button
              key={offset}
              type="button"
              className={`pd-qty-picker-row${isCurrent ? ' is-current' : ''} pd-qty-picker-row-d${Math.abs(offset)}`}
              style={n < min ? { visibility: 'hidden' } : undefined}
              tabIndex={-1}
              onClick={() => commit(n)}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Renders a nav dropdown's items, recursing into flyouts for entries that
 * carry `children` (which may themselves have further flyouts). */
function NavMenuList({ entries, onPick }: { entries: readonly NavMenuEntry[]; onPick: (label: string) => void }) {
  return (
    <>
      {entries.map((entry) => {
        if (typeof entry === 'string') {
          return (
            <button key={entry} type="button" className="pd-nav-menu-item" onClick={() => onPick(entry)}>
              {entry}
            </button>
          )
        }
        if ('arrow' in entry) {
          return (
            <button key={entry.label} type="button" className="pd-nav-menu-item" onClick={() => onPick(entry.label)}>
              <span>{entry.label}</span>
              <ChevronRight size={13} className="pd-nav-menu-arrow" />
            </button>
          )
        }
        return (
          <div key={entry.label} className="pd-nav-menu-item pd-nav-menu-parent">
            <span>{entry.label}</span>
            <ChevronRight size={13} className="pd-nav-menu-arrow" />
            <div className="pd-nav-submenu">
              <NavMenuList entries={entry.children} onPick={onPick} />
            </div>
          </div>
        )
      })}
    </>
  )
}

/** SF Symbol-like dining table (top-down, four seats). */
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

/** Best-effort icon per category name — cosmetic only, falls back to a generic plate. */
function categoryIcon(name: string): ComponentType<{ size?: number; strokeWidth?: number }> {
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

export default function PosMainPage() {
  const navigate = useNavigate()
  const enrollment = getEnrollment()
  const waiter = SessionManager.staffName || 'ADMIN'
  const counter = enrollment?.stationName || 'Counter 01'
  const lineKey = useRef(1)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const [nav, setNav] = useState<(typeof NAV)[number]>('New Sale')
  const [groups, setGroups] = useState<Cat[]>([])
  const [allSubGroups, setAllSubGroups] = useState<SubCat[]>([])
  const [allSubSubGroups, setAllSubSubGroups] = useState<SubSubCat[]>([])
  const [allProducts, setAllProducts] = useState<ProductTile[]>([])
  const [notesHint, setNotesHint] = useState<string | null>(null)
  const [notesKind, setNotesKind] = useState<ToastKind>('error')
  const [openNavMenu, setOpenNavMenu] = useState<(typeof NAV)[number] | null>(null)
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; key: number } | null>(null)
  const [qtyChangeOpen, setQtyChangeOpen] = useState(false)
  const [qtyChangeKey, setQtyChangeKey] = useState<number | null>(null)
  const [qtyChangeNew, setQtyChangeNew] = useState('')
  const qtyChangeRef = useRef<HTMLInputElement | null>(null)
  const [priceChangeOpen, setPriceChangeOpen] = useState(false)
  const [priceChangeKey, setPriceChangeKey] = useState<number | null>(null)
  const [priceChangeNew, setPriceChangeNew] = useState('')
  const priceChangeRef = useRef<HTMLInputElement | null>(null)
  const [discChangeOpen, setDiscChangeOpen] = useState(false)
  const [discChangeKey, setDiscChangeKey] = useState<number | null>(null)
  const [discChangeNew, setDiscChangeNew] = useState('')
  const discChangeRef = useRef<HTMLInputElement | null>(null)
  const [movePicker, setMovePicker] = useState<{ key: number } | null>(null)
  const [moving, setMoving] = useState(false)
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
  const [customerId, setCustomerId] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [waiterId, setWaiterId] = useState(() => getPosSession().staffId)
  const [clearAfterKotSave, setClearAfterKotSave] = useState(0)
  const [waiterMandatory, setWaiterMandatory] = useState(0)
  const [savingKot, setSavingKot] = useState(false)
  const [loadingKot, setLoadingKot] = useState(false)
  const [orderListOpen, setOrderListOpen] = useState(false)
  const [orderListRows, setOrderListRows] = useState<OrderRow[]>([])
  const [orderListState, setOrderListState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [orderListError, setOrderListError] = useState<string | null>(null)
  const [orderListSearch, setOrderListSearch] = useState('')
  const [orderListSupply, setOrderListSupply] = useState<'ALL' | ServiceKind>('ALL')
  const [areaOpen, setAreaOpen] = useState(false)
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  // Split Payment — method → (optional tip) → amount entry, looping back to
  // method selection until the bill is fully covered.
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitStep, setSplitStep] = useState<'method' | 'tip' | 'entry' | 'done'>('method')
  const [splitMethod, setSplitMethod] = useState<SplitMethod | null>(null)
  const [splitTip, setSplitTip] = useState<'none' | 'with' | null>(null)
  const [splitPaidInput, setSplitPaidInput] = useState('')
  const [splitTipInput, setSplitTipInput] = useState('')
  const [splitActiveField, setSplitActiveField] = useState<'paid' | 'tip'>('paid')
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([])
  // TODO: wire to a real "tips enabled" setting once one exists.
  const splitTipEnabled = true

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentsDraft, setCommentsDraft] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerRows, setCustomerRows] = useState<{ id: number; name: string; mobile: string }[]>([])
  const [customerState, setCustomerState] = useState<'idle' | 'loading'>('idle')
  const [isTablePopup, setIsTablePopup] = useState(0)
  const [isTablesBasedOnWaiter, setIsTablesBasedOnWaiter] = useState(0)
  const [tablePopupOpen, setTablePopupOpen] = useState(false)
  const [tableFloorOpen, setTableFloorOpen] = useState(false)
  const [tablePopupMode, setTablePopupMode] = useState<'tables' | 'kots'>('tables')
  const [occupiedKots, setOccupiedKots] = useState<OccupiedKot[]>([])
  const [chairPromptOpen, setChairPromptOpen] = useState(false)
  const [kotSelectOpen, setKotSelectOpen] = useState(false)
  const [coversPrompt, setCoversPrompt] = useState<{ table: TableRow } | null>(null)
  const [coversDraft, setCoversDraft] = useState('1')

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!notesHint) return
    const t = window.setTimeout(() => setNotesHint(null), 1800)
    return () => window.clearTimeout(t)
  }, [notesHint])

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
    const t = window.setTimeout(() => priceChangeRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [priceChangeOpen])

  useEffect(() => {
    if (!discChangeOpen) return
    const t = window.setTimeout(() => discChangeRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [discChangeOpen])

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
    if (!openNavMenu) return
    const close = () => setOpenNavMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openNavMenu])

  useEffect(() => {
    if (!moreActionsOpen) return
    const close = () => setMoreActionsOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [moreActionsOpen])

  useEffect(() => {
    let alive = true
    setCatalogueState('loading')
    Promise.all([
      apiService.fetchGroups(),
      apiService.fetchProducts({ limit: 2000 }),
      apiService.fetchSubGroups().catch(() => []),
      apiService.fetchSubSubGroups().catch(() => []),
    ])
      .then(([groupRows, productRows, subGroupRows, subSubRows]) => {
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
        seats: Number(t.seats) || 0,
        waiterId: Number(t.waiterId) || 0,
      })).filter((t) => t.id > 0)
      setAreas(mapped)
      setTables(tableMapped)
      const p = asRow(params)
      setClearAfterKotSave(num(p.ClearAfterKOTSave ?? p.clearAfterKotSave))
      setWaiterMandatory(num(p.ISWaiterMandotory ?? p.ISWaiterMandatory ?? p.isWaiterMandatory))
      const popup = num(p.IsTablePopup ?? p.isTablePopup)
      const defaultAreaFlag =
        p.DefaultAreaName != null || p.defaultAreaName != null || p.default_area_name != null
          ? num(p.DefaultAreaName ?? p.defaultAreaName ?? p.default_area_name)
          : 1
      setIsTablePopup(popup)
      setIsTablesBasedOnWaiter(num(p.IsTablesBasedOnWaiter ?? p.isTablesBasedOnWaiter))
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

  const summary = useMemo(() => computeSummary(lines), [lines])

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
  const tablesForArea = useMemo(() => {
    let list = tables.filter((t) => t.areaId === areaId || (areaId > 0 && t.areaId === 0))
    if (isTablesBasedOnWaiter === 1) {
      const staffId = getPosSession().staffId
      list = list.filter((t) => t.waiterId === staffId)
    }
    return list
  }, [tables, areaId, isTablesBasedOnWaiter])
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

  function pendingQty() {
    const n = Number(padQty)
    return Number.isFinite(n) && n > 0 ? n : 1
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
    const next = allSubSubGroups.filter((s) => s.subGroupId === id)
    setSubGroupId(id)
    setSubSubGroupId(null)
    if (next.length) setStripLevel('subsub')
    else setStripLevel('subgroup')
  }

  function onSubSubClick(id: number) {
    setSubSubGroupId(id)
    setStripLevel('subsub')
  }

  function onBack() {
    setStripLevel('group')
    setSubGroupId(null)
    setSubSubGroupId(null)
  }

  function onItemClick(p: ProductTile) {
    const qty = pendingQty()
    if (!(qty > 0)) {
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
      const next = calcLine(existing.price, nextQty, existing.taxAmount, existing.taxRate, 0)
      setLines((prev) =>
        prev.map((l) => (l.key === existing.key ? { ...l, qty: nextQty, ...next } : l)),
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
          barcode: '',
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

  /** Per-row delete (the trash icon on each line) — only lines that haven't
   * fired to the kitchen yet can be removed outright. */
  function deleteLine(key: number) {
    const line = lines.find((l) => l.key === key)
    if (!line) return
    if (!line.kotPending) {
      toast('Use Item Cancel...')
      return
    }
    setLines((prev) => prev.filter((l) => l.key !== key))
    setSelectedLine((prev) => (prev === key ? null : prev))
  }

  /** Opens the radial row menu centred on (x, y), clamped so its buttons never
   * render off-screen near a viewport edge. */
  function openRowMenuAt(x: number, y: number, key: number) {
    const margin = 90
    const cx = Math.min(Math.max(x, margin), window.innerWidth - margin)
    const cy = Math.min(Math.max(y, margin), window.innerHeight - margin)
    setRowMenu({ x: cx, y: cy, key })
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
        const disc = round2((l.disc / (l.qty || 1)) * n)
        return { ...l, qty: n, ...calcLine(l.price, n, l.taxAmount, l.taxRate, disc) }
      }),
    )
    setQtyChangeOpen(false)
  }

  function cancelQtyChange() {
    setQtyChangeOpen(false)
  }

  const priceChangeLine = priceChangeKey == null ? null : lines.find((l) => l.key === priceChangeKey) ?? null

  function openPriceChange(ticketKey?: number) {
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
      toast('Change Price From Item Cancel...')
      return
    }
    if (line.productType === 'COMBO') {
      toast('Change Price Of Combo item.......')
      return
    }
    setSelectedLine(key)
    setPriceChangeKey(key)
    setPriceChangeNew('')
    setPriceChangeOpen(true)
  }

  function onPriceChangeKey(k: string) {
    if (k === 'C') {
      setPriceChangeNew((prev) => prev.slice(0, -1))
      return
    }
    if (k === '.' && priceChangeNew.includes('.')) return
    setPriceChangeNew((prev) => (prev + k).slice(0, 10))
  }

  function applyPriceChange() {
    const n = Number(priceChangeNew)
    if (!(n >= 0 && n < 9999999)) {
      toast('Qty Price Not Acceptable.........')
      return
    }
    if (priceChangeKey == null) {
      setPriceChangeOpen(false)
      return
    }
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== priceChangeKey) return l
        return { ...l, price: n, ...calcLine(n, l.qty, l.taxAmount, l.taxRate, l.disc) }
      }),
    )
    setPriceChangeOpen(false)
  }

  function cancelPriceChange() {
    setPriceChangeOpen(false)
  }

  const discChangeLine = discChangeKey == null ? null : lines.find((l) => l.key === discChangeKey) ?? null

  function openLineDiscount(ticketKey?: number) {
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
      toast('Change Discount From Item Cancel...')
      return
    }
    if (line.productType === 'COMBO') {
      toast('Change Discount Of Combo item.......')
      return
    }
    setSelectedLine(key)
    setDiscChangeKey(key)
    setDiscChangeNew('')
    setDiscChangeOpen(true)
  }

  function onDiscChangeKey(k: string) {
    if (k === 'C') {
      setDiscChangeNew((prev) => prev.slice(0, -1))
      return
    }
    if (k === '.' && discChangeNew.includes('.')) return
    setDiscChangeNew((prev) => (prev + k).slice(0, 10))
  }

  function applyLineDiscount() {
    const n = Number(discChangeNew)
    const line = lines.find((l) => l.key === discChangeKey)
    if (!line || !(n >= 0) || n > round2(line.price * line.qty)) {
      toast('Qty Price Not Acceptable.........')
      return
    }
    if (discChangeKey == null) {
      setDiscChangeOpen(false)
      return
    }
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== discChangeKey) return l
        return { ...l, ...calcLine(l.price, l.qty, l.taxAmount, l.taxRate, n) }
      }),
    )
    setDiscChangeOpen(false)
  }

  function cancelLineDiscount() {
    setDiscChangeOpen(false)
  }

  /** Move a line onto a different open KOT. Guarded to lines that haven't fired
   * to the kitchen yet, and to tickets with more than one line — an empty saved
   * KOT after removal is undefined behaviour on the backend, so that edge case
   * is refused rather than guessed at. */
  function openMovePicker(ticketKey?: number) {
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
      toast('Move From Item Cancel...')
      return
    }
    if (line.productType === 'COMBO') {
      toast('Cannot Move Combo item.......')
      return
    }
    if (lines.length <= 1) {
      toast('Cannot move the only item — cancel or void this ticket instead.')
      return
    }
    setSelectedLine(key)
    setMovePicker({ key })
    setOrderListSearch('')
    setOrderListSupply('ALL')
    void loadOrderList('ALL', '')
  }

  /**
   * Full cross-KOT transfer: save the current ticket without the line, load the
   * destination ticket, append the line there and save it, then reload the
   * original ticket so the till lands back where the user started. Each step
   * awaits the last — nothing here reads `lines`/`currentKotId` state right after
   * setting it, since that state hasn't landed yet; `onSaveKot`/`takeOrder` return
   * what they just did instead.
   */
  async function moveLineToKot(target: OrderRow) {
    const key = movePicker?.key
    if (key == null) return
    const line = lines.find((l) => l.key === key)
    if (!line) {
      setMovePicker(null)
      return
    }
    if (target.kotMasterId === currentKotId && currentKotId > 0) {
      toast('Item is already on this order.')
      return
    }
    const remaining = lines.filter((l) => l.key !== key)
    if (remaining.length === 0) {
      toast('Cannot move the only item — cancel or void this ticket instead.')
      setMovePicker(null)
      return
    }
    setMoving(true)
    try {
      const savedOriginalId = await onSaveKot(remaining)
      if (savedOriginalId == null) {
        toast('Could not save this order before moving the item — nothing was moved.')
        return
      }
      const targetLines = await takeOrder(target.kotMasterId, false)
      if (!targetLines) {
        toast(`Could not open ${target.kotNo} — item stayed on this order.`)
        await takeOrder(savedOriginalId, false)
        return
      }
      const movedLine: TicketLine = { ...line, key: lineKey.current++, kotPending: true }
      const appended = [...targetLines, movedLine]
      const savedTargetId = await onSaveKot(appended)
      if (savedTargetId == null) {
        toast(`Could not save the item onto ${target.kotNo}. Reopening your original order — please retry the move.`)
        await takeOrder(savedOriginalId, false)
        return
      }
      toast(`Moved ${line.item} to ${target.kotNo}.`, 'success')
      setMovePicker(null)
      await takeOrder(savedOriginalId, false)
    } finally {
      setMoving(false)
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
    setWaiterId(getPosSession().staffId)
  }

  async function loadOccupied(forAreaId: number) {
    if (forAreaId <= 0) {
      setOccupiedKots([])
      return [] as OccupiedKot[]
    }
    try {
      const rows = await apiService.fetchOrderList({ areaId: forAreaId })
      const mapped = mapOrderRows(rows).map((r) => ({
        kotMasterId: r.kotMasterId,
        tableId: r.tableId,
        chairNo: r.chairNo,
        kotNo: r.kotNo,
        waiterId: r.waiterId,
        pax: r.pax,
      }))
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

  /** AreaClickToPopulationTable */
  async function areaClickToPopulationTable(area: AreaRow) {
    setTableId(0)
    setTableName('')
    setChairNo(0)
    setRemarks('')
    setKotPrefix(area.kotPrefix)
    resetOpenKotTicket()
    setTablePopupOpen(false)
    setTableFloorOpen(false)
    setChairPromptOpen(false)
    setKotSelectOpen(false)
    setCoversPrompt(null)
    const occ = await loadOccupied(area.id)
    if (area.tableCreationType === 0) {
      setTablePopupMode('tables')
      setTableFloorOpen(true)
    } else {
      setOccupiedKots(occ)
      setTablePopupMode('kots')
      setTablePopupOpen(true)
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
    hideTablePopup()
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
    hideTablePopup()
    resetOpenKotTicket()
    setCustomerOpen(true)
    void loadCustomers()
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
      // No area is tagged as DINE IN in this setup — still open the table
      // layout modal (empty) instead of silently failing with just a toast.
      setService('DINE IN')
      setAreaId(0)
      setTableId(0)
      setTableName('')
      setChairNo(0)
      setTablePopupOpen(false)
      setChairPromptOpen(false)
      setKotSelectOpen(false)
      setCoversPrompt(null)
      setTablePopupMode('tables')
      setTableFloorOpen(true)
      toast('No DINE IN area is configured yet — set one up in Admin.')
      return
    }
    areaButtonClick(dine)
  }

  function hideTablePopup() {
    setTablePopupOpen(false)
    setTableFloorOpen(false)
    setChairPromptOpen(false)
    setKotSelectOpen(false)
    setCoversPrompt(null)
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
    toast('No Free Chair Avilable int This Table')
  }

  /** TableFloorRuntimeFrm Table_Click */
  async function floorTableClick(table: TableRow) {
    const occ = occupiedByTable.get(table.id) ?? []
    const activeWaiter = occ[0]?.waiterId ?? 0
    const loggedWaiter = getPosSession().staffId
    if (occ.length > 0 && activeWaiter > 0 && loggedWaiter > 0 && activeWaiter !== loggedWaiter) {
      toast('This table has an active KOT under another waiter.')
      return
    }
    if (occ.length === 0) {
      setCoversDraft(String(covers > 0 ? covers : 1))
      setCoversPrompt({ table })
      return
    }
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
    setCovers(Math.trunc(n))
    setCoversPrompt(null)
    setTableFloorOpen(false)
    await finishTableBtnClick(table, true)
  }

  /** TableBtnClick — dine-in table (TB…) */
  async function tableBtnClick(table: TableRow, fromFloor = false) {
    if (fromFloor && isTablePopup === 1) {
      await floorTableClick(table)
      return
    }
    await finishTableBtnClick(table, fromFloor)
  }

  async function finishTableBtnClick(table: TableRow, fromFloor = false) {
    const ticketHasItems = currentKotId > 0 ? false : lines.length > 0
    resetOpenKotTicket()
    setTableId(table.id)
    setTableName(table.name)
    setChairNo(0)
    setKotSelectOpen(false)
    const occ = occupiedByTable.get(table.id) ?? []
    const seats = table.seats > 0 ? table.seats : 4
    const firstOccupied = occ.find((k) => k.chairNo > 0)?.chairNo ?? (occ[0]?.chairNo || 0)
    const freeChair = Array.from({ length: seats }, (_, i) => i + 1).find((n) => !occ.some((k) => k.chairNo === n)) ?? 0

    if (firstOccupied <= 0) {
      setChairNo(1)
      hideTablePopup()
      clearQty()
      return
    }

    if (fromFloor) {
      setTablePopupOpen(true)
      setTablePopupMode('tables')
    }

    if (ticketHasItems && occ.length > 0) {
      const first = occ[0]
      const ok = window.confirm(`Do You Want To Add Selected Item With KOT ${first.kotNo}`)
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
      const ok = window.confirm(`Do You Want To Add Selected Item With KOT ${kot.kotNo}`)
      if (ok) {
        await takeOrder(kot.kotMasterId, true)
        loadedKot = true
      } else {
        setTableId(0)
        setTableName('')
        setChairNo(0)
      }
    } else if (kot) {
      await takeOrder(kot.kotMasterId, false)
      loadedKot = true
    }
    if (!loadedKot) hideTablePopup()
    clearQty()
  }

  /** Tapping a chair dot directly on a table card — picks that table + chair
   * in one step instead of the table-then-chair two-screen flow. */
  async function dotChairClick(table: TableRow, chair: number) {
    setTableId(table.id)
    setTableName(table.name)
    await chairBtnClick(chair, table)
  }

  /** KI tile — takeaway/delivery existing KOT */
  async function kotTileClick(kot: OccupiedKot) {
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
    setCustomerId(0)
    setCustomerName('')
    setCovers(1)
    setTableId(0)
    setTableName('')
    setChairNo(0)
    setWaiterId(getPosSession().staffId)
    const match = pickAreaForService(service)
    applyArea(match)
    clearQty()
  }

  function toast(msg: string, kind: ToastKind = 'error') {
    setNotesHint(msg)
    setNotesKind(kind)
  }

  /** Sum of amounts already collected across every leg of the current split,
   * plus a hypothetical extra leg — used both to render "Remaining" and to
   * decide whether confirming a leg finishes the bill. */
  function splitRemainingAmount(payments: SplitPayment[] = splitPayments) {
    const collected = payments.reduce((sum, p) => sum + p.paid, 0)
    return Math.max(0, round2(summary.total - collected))
  }

  function openSplitPayment() {
    setPayOpen(false)
    setSplitPayments([])
    setSplitMethod(null)
    setSplitTip(null)
    setSplitPaidInput('')
    setSplitTipInput('')
    setSplitActiveField('paid')
    setSplitStep('method')
    setSplitOpen(true)
  }

  function selectSplitMethod(method: SplitMethod) {
    setSplitMethod(method)
    setSplitTip(null)
    // Left blank rather than pre-filled with the remaining balance — the
    // keypad only appends/clears (no backspace), so a pre-filled value would
    // turn the very next digit tap into "1500.005" instead of a fresh entry.
    setSplitPaidInput('')
    setSplitTipInput('')
    setSplitActiveField('paid')
    setSplitStep(splitTipEnabled ? 'tip' : 'entry')
  }

  function selectSplitTip(choice: 'none' | 'with') {
    setSplitTip(choice)
    setSplitActiveField(choice === 'with' ? 'tip' : 'paid')
    setSplitStep('entry')
  }

  function splitBack() {
    if (splitStep === 'tip') {
      setSplitMethod(null)
      setSplitStep('method')
    } else if (splitStep === 'entry') {
      setSplitTip(null)
      setSplitStep(splitTipEnabled ? 'tip' : 'method')
      if (!splitTipEnabled) setSplitMethod(null)
    }
  }

  /** Shared digit-pad handler for both the Paid Amount and Tip Amount boxes —
   * whichever box the cashier last tapped (splitActiveField) receives the key. */
  function onSplitKeypad(k: string) {
    const setField = splitActiveField === 'tip' ? setSplitTipInput : setSplitPaidInput
    setField((prev) => {
      if (k === 'C') return ''
      if (k === '.') return prev.includes('.') ? prev : prev + '.'
      const dot = prev.indexOf('.')
      if (dot !== -1 && prev.length - dot > 2) return prev
      return (prev + k).slice(0, 9)
    })
  }

  /** PAID — records this leg, then either loops back to method selection
   * (balance remaining) or moves to the completed summary (bill settled). */
  function confirmSplitPayment() {
    const remaining = splitRemainingAmount()
    const paidRaw = Number(splitPaidInput)
    if (!splitMethod || !Number.isFinite(paidRaw) || paidRaw <= 0) {
      toast('Enter a valid paid amount')
      return
    }
    const paid = Math.min(round2(paidRaw), remaining)
    const tip = splitTip === 'with' ? Math.max(0, round2(Number(splitTipInput) || 0)) : 0
    const nextPayments = [...splitPayments, { method: splitMethod, paid, tip }]
    setSplitPayments(nextPayments)

    if (splitRemainingAmount(nextPayments) <= 0.004) {
      setSplitStep('done')
      return
    }
    setSplitMethod(null)
    setSplitTip(null)
    setSplitPaidInput('')
    setSplitTipInput('')
    setSplitActiveField('paid')
    setSplitStep('method')
  }

  function finishSplitPayment() {
    setSplitOpen(false)
    toast('Payment completed', 'success')
    clearData()
  }

  /** DisplayKOT — AppendItems=0 replaces the grid; =1 keeps NEW lines then adds KOT lines. */
  function applyKotDetails(payload: unknown, productTiles: ProductTile[], append = false) {
    const rows = kotDetailsRows(payload)
    if (!rows.length) {
      toast('NO Item for KOT')
      return null
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
        modifiers: String(row.Modifier ?? row.Modifir ?? row.Remarks ?? ''),
        qty,
        price,
        disc: calced.disc,
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
        barcode: String(row.BarCode ?? row.Barcode ?? ''),
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
    setRemarks(String(first.HeaderRemarks ?? first.txtRemarks ?? first.KotRemarks ?? ''))
    setCustomerId(num(first.CustomerID ?? first.customerID))
    setCustomerName(String(first.CustomerName ?? first.customerName ?? ''))
    const loadedWaiter = num(first.WaiterID ?? first.waiterID)
    setWaiterId(loadedWaiter > 0 ? loadedWaiter : getPosSession().staffId)
    return append ? [...lines, ...nextLines] : nextLines
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

  /**
   * btnSaveKOT_Click → SaveBilDetailsToHoldTable("BillHold","KotSave")
   * Validations match Mainfrm.vb one-for-one. Printing is deferred.
   *
   * `linesOverride` lets a caller save an explicit array instead of live `lines` state —
   * needed when orchestrating a multi-step flow (e.g. moving a line to another KOT) where
   * the next step can't wait a render for `setLines` to land. Context fields (area/table/
   * customer/waiter/covers) still come from component state, since by the time an override
   * is used the state has already been switched to the right ticket via `takeOrder`.
   * Returns the saved/kept KOT id, or null if validation blocked the save or it failed.
   */
  async function onSaveKot(linesOverride?: TicketLine[]): Promise<number | null> {
    if (savingKot) return null
    const ls = linesOverride ?? lines
    const sm = linesOverride ? computeSummary(linesOverride) : summary
    if (ls.length === 0) {
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
      setCustomerOpen(true)
      void loadCustomers()
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
        txtDiscount: sm.discount,
        lblSubTotalAmt: sm.subtotal,
        lblTax1Total: sm.tax,
        lblRound: 0,
        lblBillTotal: sm.total,
        txtNoofCustomer: covers,
        txtRemarks: remarks,
        mfKotPrefix: resolvedArea.kotPrefix || kotPrefix,
        CurrentKOTID: currentKotId > 0 ? currentKotId : 0,
        btnname: 'KotSave',
        Items: buildKotItems(ls),
      })
      const kotId = num(result.CurrentKOTID ?? result.jobId)
      if (kotId > 0) setCurrentKotId(kotId)
      let details = result.kotDetails
      if (!kotDetailsRows(details).length && kotId > 0) {
        details = await apiService.fetchKotDetails(String(kotId))
      }
      const savedNo = `${String(result.KotPrefix ?? kotPrefix)}${String(result.KotNumber ?? kotNo)}`
      toast(`Kot ${savedNo} Saved. . . `, 'success')
      if (clearAfterKotSave === 1) {
        clearData()
      } else if (details) {
        applyKotDetails(details, allProducts, false)
      }
      return kotId > 0 ? kotId : currentKotId
    } catch (err) {
      toast(errMessage(err, 'Unable To Save'))
      return null
    } finally {
      setSavingKot(false)
      clearQty()
    }
  }

  async function loadOrderList(supply: 'ALL' | ServiceKind = orderListSupply, search = orderListSearch) {
    setOrderListState('loading')
    setOrderListError(null)
    try {
      const rows = await apiService.fetchOrderList({
        search: search.trim() || undefined,
        supplyType: supply === 'ALL' ? undefined : supply === 'TAKEAWAY' ? 'PARCEL' : supply,
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
    setOrderListOpen(true)
    void loadOrderList('ALL', '')
  }

  /** DisplayKOT — Order List and table load. AppendItems=0 replaces; =1 keeps NEW lines.
   *  Returns the freshly-loaded lines so a caller mid-orchestration (e.g. moving a line
   *  to another KOT) can use them directly instead of racing the `lines` state update. */
  async function takeOrder(kotMasterId: number, append = false): Promise<TicketLine[] | null> {
    if (kotMasterId <= 0 || loadingKot) return null
    setLoadingKot(true)
    try {
      const details = await apiService.fetchKotDetails(String(kotMasterId))
      const result = applyKotDetails(details, allProducts, append)
      if (!result) return null
      setOrderListOpen(false)
      return result
    } catch (err) {
      toast(`Error loading KOT: ${errMessage(err, 'failed')}`)
      return null
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
        })).filter((c) => c.id > 0 && c.name),
      )
    } catch {
      setCustomerRows([])
    } finally {
      setCustomerState('idle')
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
          <img src="/logo-white.png" alt="Deyno" className="pd-logo-img" />
          <span>PRO</span>
        </div>
        <nav className="pd-nav">
          {NAV.map((item) => {
            const menu = NAV_MENUS[item]
            if (!menu) {
              return (
                <button
                  key={item}
                  type="button"
                  className={`pd-nav-btn${item === nav ? ' is-active' : ''}`}
                  onClick={() => setNav(item)}
                >
                  {item}
                </button>
              )
            }
            return (
              <div key={item} className="pd-nav-menu-wrap">
                <button
                  type="button"
                  className={`pd-nav-btn${item === nav ? ' is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setNav(item)
                    setOpenNavMenu((open) => (open === item ? null : item))
                  }}
                >
                  {item}
                </button>
                {openNavMenu === item ? (
                  <div className="pd-nav-menu" onClick={(e) => e.stopPropagation()}>
                    <NavMenuList
                      entries={menu}
                      onPick={(label) => {
                        setOpenNavMenu(null)
                        toast(`${label} — coming soon`, 'info')
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
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
            <h1>{currentKotId > 0 ? 'Open KOT' : 'Order'} #{kotLabel}</h1>
            <div className="pd-meta">
              <button
                type="button"
                className="pd-meta-btn"
                onClick={() => {
                  if (currentArea) void areaClickToPopulationTable(currentArea)
                  else setAreaOpen(true)
                }}
              >
                <span className="pd-pill-icon"><TableGlyph size={10} /></span>
                Table {tableName || (tableId > 0 ? String(tableId) : '—')}
                {chairNo > 0 ? ` / CH ${chairNo}` : ''}
                <ChevronDown size={11} className="pd-pill-chevron" />
              </button>
              <button
                type="button"
                className="pd-meta-btn"
                onClick={() => setCovers((n) => (n >= 12 ? 1 : n + 1))}
                title="Number of persons"
              >
                <span className="pd-pill-icon"><Users size={10} /></span>
                {covers} {covers === 1 ? 'Cover' : 'Covers'}
                <ChevronDown size={11} className="pd-pill-chevron" />
              </button>
              <button
                type="button"
                className="pd-meta-btn"
                onClick={() => {
                  setCustomerOpen(true)
                  void loadCustomers()
                }}
              >
                <span className="pd-pill-icon"><User size={10} /></span>
                {customerName || 'Cash Customer'}
                <ChevronDown size={11} className="pd-pill-chevron" />
              </button>
            </div>
          </div>

          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th className="col-no">#</th>
                  <th className="col-item">Item</th>
                  <th className="col-qty num">Qty</th>
                  <th className="col-money num">Price</th>
                  <th className="col-money num">Disc</th>
                  <th className="col-money num">Tax</th>
                  <th className="col-money num">Total</th>
                  <th className="col-menu" aria-hidden="true" />
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
                      onDoubleClick={(e) => {
                        setSelectedLine(line.key)
                        openRowMenuAt(e.clientX, e.clientY, line.key)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setSelectedLine(line.key)
                        openRowMenuAt(e.clientX, e.clientY, line.key)
                      }}
                    >
                      <td className="col-no">{i + 1}</td>
                      <td className="col-item">
                        <span className="pd-item-name">{line.item}</span>
                        {line.modifiers ? (
                          <span className="pd-item-mod">↳ {line.modifiers}</span>
                        ) : null}
                      </td>
                      <td
                        className="col-qty num pd-qty-cell"
                        onClick={(e) => {
                          e.stopPropagation()
                          openQtyChange(line.key)
                        }}
                      >
                        {line.qty}
                      </td>
                      <td className="col-money num pd-money-muted">{money(line.price)}</td>
                      <td className="col-money num pd-money-muted">{money(line.disc)}</td>
                      <td className="col-money num pd-money-muted">{money(line.tax)}</td>
                      <td className="col-money num">{money(line.total)}</td>
                      <td className="col-menu">
                        <button
                          type="button"
                          className="pd-row-delete"
                          aria-label="Delete item"
                          title="Delete item"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteLine(line.key)
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pd-foot">
            <div className="pd-summary">
              <div className="pd-summary-scroll">
                <span className="pd-summary-item">
                  <span className="label">
                    <span className="label-full">Items</span>
                    <span className="label-short">Itm</span>
                  </span>
                  <span className="val">{summary.itemCount}</span>
                </span>
                <span className="pd-summary-item">
                  <span className="label">Qty</span>
                  <span className="val">{summary.qty}</span>
                </span>
                <span className="pd-summary-item">
                  <span className="label">
                    <span className="label-full">Total</span>
                    <span className="label-short">Tot</span>
                  </span>
                  <span className="val">{money(summary.subtotal)}</span>
                </span>
                <span className="pd-summary-item">
                  <span className="label">Disc</span>
                  <span className="val">{money(summary.discount)}</span>
                </span>
                <span className="pd-summary-item">
                  <span className="label">Txbl</span>
                  <span className="val">{money(summary.taxable)}</span>
                </span>
                <span className="pd-summary-item">
                  <span className="label">Tax</span>
                  <span className="val">{money(summary.tax)}</span>
                </span>
              </div>
              <span className="pd-summary-item pd-summary-net">
                <span className="total-label">
                  <span className="label-full">NET AMT</span>
                  <span className="label-short">Net</span>
                </span>
                <span className="total-val">{money(summary.total)}</span>
              </span>
            </div>

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
                  <span className="pd-service-label">{s.id}</span>
                </button>
              ))}
              <button
                type="button"
                className={`pd-service-btn pd-service-btn-end${lines.length > 0 ? '' : ' is-hidden'}`}
                onClick={clearData}
                disabled={lines.length === 0}
                aria-hidden={lines.length === 0}
                tabIndex={lines.length === 0 ? -1 : 0}
              >
                <BtnIcon icon={Plus} /> <span className="pd-service-label">New KOT</span>
              </button>
            </div>
          </div>
        </section>

        <section className="pd-panel pd-catalogue">
        <div className="pd-search-row">
          {crumb ? (
            <div className="pd-crumb">
              <span className="pd-crumb-title">{crumb}</span>
              <span className="pd-crumb-count">{products.length} items</span>
            </div>
          ) : null}
          <label className="pd-search">
            <Search size={14} color="var(--text-3)" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
          <button
            type="button"
            className="pd-barcode-btn"
            aria-label="Scan barcode"
            onClick={() => searchInputRef.current?.focus()}
          >
            <ScanBarcode size={14} />
          </button>
        </div>

        <div className="pd-catalogue-body">
        <aside className="pd-cat-col">
          <div
            ref={groupStripRef}
            className="pd-cats"
            onPointerDown={onGroupStripPointerDown}
            onPointerMove={onGroupStripPointerMove}
            onPointerUp={onGroupStripPointerUp}
            onPointerCancel={onGroupStripPointerUp}
          >
            {stripButtons.map((c) => {
              const CatIcon = categoryIcon(c.name)
              return (
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
                  <CatIcon size={13} strokeWidth={2} />
                  <span className="pd-cat-label">{c.name.toLowerCase()}</span>
                </button>
              )
            })}
          </div>
          {stripLevel !== 'group' ? (
            <button type="button" className="pd-cat pd-back" onClick={onBack}>
              <ChevronLeft size={14} />
              <span className="pd-cat-label">Back</span>
            </button>
          ) : (
            <button type="button" className="pd-cat pd-top-move">
              <Star size={13} strokeWidth={2} />
              <span className="pd-cat-label">Top Move</span>
            </button>
          )}
        </aside>

        <div className="pd-right">
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

          {tablePopupOpen ? (
            <div className="pd-table-popup">
              <div className="pd-table-popup-bar">
                <strong>{currentArea?.name || 'Tables'}</strong>
                <button type="button" className="pd-table-home" onClick={hideTablePopup}>
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
                  <div className="pd-table-grid">
                    {tablesForArea.map((t) => {
                      const occ = occupiedByTable.get(t.id) ?? []
                      const occupied = occ.length > 0
                      return (
                        <TableCard
                          key={t.id}
                          label={t.name}
                          seats={t.seats}
                          status={occupied ? 'occupied' : 'free'}
                          orderNo={occupied ? occ[0].kotNo : undefined}
                          pax={occupied ? occ[0].pax : undefined}
                          selected={tableId === t.id}
                          onClick={() => void tableBtnClick(t)}
                          occupiedChairs={occ.filter((k) => k.chairNo > 0).map((k) => k.chairNo)}
                          onChairSelect={(chair) => void dotChairClick(t, chair)}
                        />
                      )
                    })}
                    {tablesForArea.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
                  </div>
                  {chairPromptOpen && tableId > 0 ? (
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
              <>
              {products.map((p) => (
                  <button key={p.id} type="button" className="pd-product" onClick={() => onItemClick(p)}>
                    <span className="pd-product-name">
                      {p.name.toLowerCase()}
                      {p.sub && p.sub !== p.name ? (
                        <span className="pd-product-sub">{p.sub.toLowerCase()}</span>
                      ) : null}
                    </span>
                    <span className="pd-product-foot">
                      <span className="pd-product-price">AED {money(p.price)}</span>
                    </span>
                  </button>
              ))}
              <button
                type="button"
                className="pd-product pd-product-add"
                onClick={() => toast('Add New Item — coming soon')}
              >
                <span className="pd-product-add-icon" aria-hidden>
                  <Plus size={18} strokeWidth={2.4} />
                </span>
                <span className="pd-product-add-label">Add New Item</span>
              </button>
              </>
            )}
          </div>
          )}

          <div className="pd-actions">
            <div className="pd-actions-main">
            <div className="pd-keypad-wrap">
              <div className="pd-keypad-left">
                <div className="pd-entry">
                  <span>{entry || '0'}</span>
                  <button type="button" className="pd-entry-qty" onClick={onQtyClick}>
                    QTY {padQty}
                  </button>
                </div>
                <NumberKeypad onKey={onKey} />
              </div>

              <div className="pd-group-btns">
                <div className="pd-quick-actions">
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
                    className="pd-act"
                    onClick={() => void onSaveKot()}
                    disabled={savingKot}
                  >
                    <BtnIcon icon={Zap} /> <span>Quick KOT</span>
                  </button>
                  <button
                    type="button"
                    className="pd-act"
                    onClick={() => {
                      setCommentsDraft(remarks)
                      setCommentsOpen(true)
                    }}
                  >
                    <BtnIcon icon={MessageSquare} /> <span>Comments</span>
                  </button>

                  <div className="pd-more-wrap">
                    <button
                      type="button"
                      className={`pd-act pd-more-btn${moreActionsOpen ? ' is-active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setMoreActionsOpen((v) => !v)
                      }}
                    >
                      <BtnIcon icon={MoreHorizontal} /> <span>More</span>
                    </button>

                    {moreActionsOpen ? (
                      // No stopPropagation here — a click on any item (or the
                      // menu background) should bubble to the window listener
                      // below and close the menu, same as an outside click.
                      <div className="pd-more-menu">
                        <button type="button" className="pd-more-item" onClick={onOrderListClick}>
                          <BtnIcon icon={ClipboardList} /> <span>Order List</span>
                        </button>
                        <button type="button" className="pd-more-item">
                          <BtnIcon icon={Percent} /> <span>Discount</span>
                        </button>
                        <button type="button" className="pd-more-item">
                          <BtnIcon icon={Printer} /> <span>Print Bill</span>
                        </button>
                        <button type="button" className="pd-more-item">
                          <BtnIcon icon={FileText} /> <span>Dummy Bill</span>
                        </button>
                        <button type="button" className="pd-more-item is-danger">
                          <BtnIcon icon={Ban} /> <span>Cancel Bill</span>
                        </button>
                        <button type="button" className="pd-more-item" onClick={onQtyClick}>
                          <BtnIcon icon={Hash} />
                          <span>Qty{padQty !== '1' ? ` ${padQty}` : ''}</span>
                        </button>
                        <button type="button" className="pd-more-item">
                          <BtnIcon icon={CircleOff} /> <span>No Sale</span>
                        </button>
                        <button type="button" className="pd-more-item">
                          <BtnIcon icon={RotateCcw} /> <span>Return</span>
                        </button>
                        <button type="button" className="pd-more-item is-danger">
                          <BtnIcon icon={MinusCircle} /> <span>Item Cancel</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="pd-pay"
              onClick={() => setPayOpen(true)}
              disabled={lines.length === 0}
            >
              <BtnIcon icon={CreditCard} size={16} />
              PAY <em>AED {money(summary.total)}</em>
            </button>
            </div>

            {/* Corner strip — the 4 buttons used constantly mid-service,
               pinned as a full-height column so they never hide behind "More". */}
            <div className="pd-corner-actions">
              <button type="button" className="pd-corner-btn" onClick={() => setAreaOpen(true)}>
                <BtnIcon icon={MapPinned} />
                <span>Area Change</span>
              </button>
              <button type="button" className="pd-corner-btn">
                <BtnIcon icon={Receipt} />
                <span>Receipt</span>
              </button>
              <button type="button" className="pd-corner-btn" onClick={() => toast('KOT Join — coming soon', 'info')}>
                <BtnIcon icon={Merge} />
                <span>KOT Join</span>
              </button>
              <button type="button" className="pd-corner-btn">
                <BtnIcon icon={Printer} />
                <span>KOT Print</span>
              </button>
            </div>
          </div>
        </div>
        </div>
        </section>
      </div>

      <footer className="pd-status">
        <span>
          Counter 01&nbsp;&nbsp;&nbsp;{waiter.toUpperCase()} : {waiter.toUpperCase()}
        </span>
        <span>{formatClock(now)}</span>
      </footer>

      {notesHint ? (
        <div className="pd-toast">
          <Toast message={notesHint} kind={notesKind} />
        </div>
      ) : null}

      {rowMenu ? (
        <div
          className="pd-radial-menu"
          style={{ left: rowMenu.x, top: rowMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pd-radial-backdrop" aria-hidden />
          <div className="pd-radial-center" aria-hidden />
          {(
            [
              { label: 'Line\nDiscount', icon: Percent, angle: -90, onClick: () => openLineDiscount(rowMenu.key) },
              { label: 'Change\nPrice', icon: Tag, angle: 0, onClick: () => openPriceChange(rowMenu.key) },
              { label: 'Change\nQty', icon: SlidersHorizontal, angle: 90, onClick: () => openQtyChange(rowMenu.key) },
              { label: 'Move', icon: MapPinned, angle: 180, onClick: () => openMovePicker(rowMenu.key) },
            ] as const
          ).map(({ label, icon, angle, onClick }, i) => {
            const radius = 74
            const rad = (angle * Math.PI) / 180
            const tx = Math.round(Math.cos(rad) * radius)
            const ty = Math.round(Math.sin(rad) * radius)
            return (
              <button
                key={label}
                type="button"
                className="pd-radial-btn"
                style={
                  {
                    '--tx': `${tx}px`,
                    '--ty': `${ty}px`,
                    animationDelay: `${i * 0.09}s`,
                  } as CSSProperties
                }
                onClick={onClick}
              >
                <BtnIcon icon={icon} />
                {label.split('\n').map((ln) => (
                  <span key={ln}>{ln}</span>
                ))}
              </button>
            )
          })}
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
                <div className="pd-qty-picker-wrap">
                  <span className="pd-qty-picker-label">New Qty</span>
                  <QtyScrollPicker
                    value={Math.max(1, Math.round(Number(qtyChangeNew) || qtyChangeLine.qty || 1))}
                    onChange={(n) => setQtyChangeNew(String(n))}
                  />
                  <input
                    ref={qtyChangeRef}
                    className="pd-visually-hidden-input"
                    value={qtyChangeNew}
                    onChange={(e) => setQtyChangeNew(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyQtyChange()
                      if (e.key === 'Escape') cancelQtyChange()
                    }}
                    inputMode="decimal"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
                <div className="pd-qty-row">
                  <span>Current Qty</span>
                  <strong>{qtyChangeLine.qty}</strong>
                </div>
              </div>
              <div className="pd-qty-pad">
                <NumberKeypad className="pd-qty-keys" onKey={onQtyChangeKey} />
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
          <div className="pd-qty-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-price-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Tag size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Price Change</p>
                  <h2 id="pd-price-title" className="pd-mod-item-name">
                    {priceChangeLine.item}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={cancelPriceChange} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields">
                <div className="pd-qty-row">
                  <span>Current Price</span>
                  <strong>{money(priceChangeLine.price)}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>New Price</span>
                  <input
                    ref={priceChangeRef}
                    className="pd-qty-input"
                    value={priceChangeNew}
                    onChange={(e) => setPriceChangeNew(e.target.value.replace(/[^\d.]/g, '').slice(0, 10))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyPriceChange()
                      if (e.key === 'Escape') cancelPriceChange()
                    }}
                    inputMode="decimal"
                    placeholder="Enter price…"
                  />
                </div>
              </div>
              <div className="pd-qty-pad">
                <NumberKeypad className="pd-qty-keys" onKey={onPriceChangeKey} />
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

      {discChangeOpen && discChangeLine ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelLineDiscount()
          }}
        >
          <div className="pd-qty-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-disc-title">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Percent size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Line Discount</p>
                  <h2 id="pd-disc-title" className="pd-mod-item-name">
                    {discChangeLine.item}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={cancelLineDiscount} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields">
                <div className="pd-qty-row">
                  <span>Current Discount</span>
                  <strong>{money(discChangeLine.disc)}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>New Discount</span>
                  <input
                    ref={discChangeRef}
                    className="pd-qty-input"
                    value={discChangeNew}
                    onChange={(e) => setDiscChangeNew(e.target.value.replace(/[^\d.]/g, '').slice(0, 10))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyLineDiscount()
                      if (e.key === 'Escape') cancelLineDiscount()
                    }}
                    inputMode="decimal"
                    placeholder="Enter discount…"
                  />
                </div>
              </div>
              <div className="pd-qty-pad">
                <NumberKeypad className="pd-qty-keys" onKey={onDiscChangeKey} />
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={applyLineDiscount}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={cancelLineDiscount}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {movePicker ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !moving) setMovePicker(null)
          }}
        >
          <div className="pd-ol-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <MapPinned size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Move Item</p>
                  <h2 className="pd-mod-item-name">Choose destination order</h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => !moving && setMovePicker(null)}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <div className="pd-ol-cards">
                {moving ? <p className="pd-cat-msg">Moving item…</p> : null}
                {!moving && orderListState === 'loading' ? <p className="pd-cat-msg">Loading orders…</p> : null}
                {!moving && orderListState === 'error' ? <p className="pd-cat-msg">{orderListError}</p> : null}
                {!moving &&
                orderListState === 'idle' &&
                orderListRows.filter((r) => r.kotMasterId !== currentKotId).length === 0 ? (
                  <p className="pd-cat-msg">No other open orders to move this item to</p>
                ) : null}
                {!moving &&
                  orderListRows
                    .filter((row) => row.kotMasterId !== currentKotId)
                    .map((row) => (
                      <button
                        key={row.kotMasterId}
                        type="button"
                        className="pd-ol-card"
                        onClick={() => void moveLineToKot(row)}
                      >
                        <span className="pd-ol-card-area">
                          {row.supplyType} · {row.areaName || 'Area'}
                        </span>
                        <span className="pd-ol-card-time">{formatKotClock(row.kotTime)}</span>
                        <span className="pd-ol-card-table">Table: {row.tableName || 'N/A'}</span>
                        <span className="pd-ol-card-pax">PAX: {row.pax || 0}</span>
                        <span className="pd-ol-card-waiter">{row.waiterName || waiter}</span>
                        <span className="pd-ol-card-amt">AED {money(row.amount)}</span>
                        <span className="pd-ol-card-kot">KOT No: {row.kotNo}</span>
                      </button>
                    ))}
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
            if (e.target === e.currentTarget) setCommentsOpen(false)
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
              <button type="button" className="pd-mod-x" onClick={() => setCommentsOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <textarea
                className="pd-mod-text pd-ol-remarks"
                value={commentsDraft}
                onChange={(e) => setCommentsDraft(e.target.value.slice(0, 250))}
                rows={4}
                placeholder="Remarks…"
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
              <button type="button" className="pd-mod-foot-btn is-close" onClick={() => setCommentsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPayOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <CreditCard size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Net AED {money(summary.total)}</p>
                  <h2 className="pd-mod-item-name">Choose Payment Mode</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setPayOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-ol-body">
              <div className="pd-pay-grid">
                {PAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="pd-pay-option"
                    onClick={() => {
                      if (opt.id === 'split') {
                        openSplitPayment()
                        return
                      }
                      setPayOpen(false)
                      toast(`${opt.label} — coming soon`, 'info')
                    }}
                  >
                    <span className="pd-pay-option-icon" aria-hidden>
                      <opt.icon size={18} strokeWidth={2} />
                    </span>
                    <span className="pd-pay-option-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {splitOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && splitStep !== 'done') setSplitOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-narrow pd-split-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                {splitStep === 'tip' || splitStep === 'entry' ? (
                  <button type="button" className="pd-mod-back" onClick={splitBack} aria-label="Back">
                    <ArrowLeft size={16} />
                  </button>
                ) : (
                  <div className="pd-mod-header-icon">
                    <SplitSquareHorizontal size={15} color="#fff" />
                  </div>
                )}
                <div>
                  <p className="pd-mod-kicker">Split Payment</p>
                  <h2 className="pd-mod-item-name">
                    {splitStep === 'method' && 'Select Payment Method'}
                    {splitStep === 'tip' && 'Add a Tip?'}
                    {splitStep === 'entry' && 'Enter Amount'}
                    {splitStep === 'done' && 'Payment Complete'}
                  </h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setSplitOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>

            {splitStep !== 'done' ? (
              <div className="pd-split-totals">
                <span className="pd-split-total-item">
                  <span className="label">Bill Total</span>
                  <span className="val">AED {money(summary.total)}</span>
                </span>
                <span className="pd-split-total-item">
                  <span className="label">Paid</span>
                  <span className="val">AED {money(splitPayments.reduce((s, p) => s + p.paid, 0))}</span>
                </span>
                <span className="pd-split-total-item pd-split-total-remaining">
                  <span className="label">Remaining</span>
                  <span className="val">AED {money(splitRemainingAmount())}</span>
                </span>
              </div>
            ) : null}

            <div className="pd-ol-body">
              {splitStep === 'method' ? (
                <div className="pd-split-method-grid">
                  {SPLIT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`pd-split-method is-${m.id}`}
                      onClick={() => selectSplitMethod(m.id)}
                    >
                      <span className="pd-split-method-icon" aria-hidden>
                        <m.icon size={28} strokeWidth={2} />
                      </span>
                      <span className="pd-split-method-label">{m.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {splitStep === 'tip' ? (
                <div className="pd-split-tip">
                  <p className="pd-split-tip-q">Would you like to add a tip?</p>
                  <div className="pd-split-tip-grid">
                    <button type="button" className="pd-split-tip-btn" onClick={() => selectSplitTip('none')}>
                      Without Tip
                    </button>
                    <button type="button" className="pd-split-tip-btn is-brand" onClick={() => selectSplitTip('with')}>
                      With Tip
                    </button>
                  </div>
                </div>
              ) : null}

              {splitStep === 'entry' && splitMethod ? (
                <div className="pd-split-entry">
                  <div className="pd-split-method-pill">
                    <BtnIcon icon={SPLIT_METHODS.find((m) => m.id === splitMethod)?.icon ?? Banknote} />
                    <span>{SPLIT_METHODS.find((m) => m.id === splitMethod)?.label}</span>
                  </div>

                  <button
                    type="button"
                    className={`pd-split-amount-box${splitActiveField === 'paid' ? ' is-active' : ''}`}
                    onClick={() => setSplitActiveField('paid')}
                  >
                    <span className="pd-split-amount-label">Paid Amount</span>
                    <span className="pd-split-amount-val">
                      <em>AED</em> {splitPaidInput || '0.00'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="pd-split-full-btn"
                    onClick={() => {
                      setSplitPaidInput(splitRemainingAmount().toFixed(2))
                      setSplitActiveField('paid')
                    }}
                  >
                    Pay Full Remaining (AED {money(splitRemainingAmount())})
                  </button>

                  {splitTip === 'with' ? (
                    <button
                      type="button"
                      className={`pd-split-amount-box is-tip${splitActiveField === 'tip' ? ' is-active' : ''}`}
                      onClick={() => setSplitActiveField('tip')}
                    >
                      <span className="pd-split-amount-label">Tip Amount</span>
                      <span className="pd-split-amount-val">
                        <em>AED</em> {splitTipInput || '0.00'}
                      </span>
                    </button>
                  ) : null}

                  <NumberKeypad className="pd-keys pd-split-keys" onKey={onSplitKeypad} />

                  <button
                    type="button"
                    className="pd-split-paid-btn"
                    disabled={!(Number(splitPaidInput) > 0)}
                    onClick={confirmSplitPayment}
                  >
                    PAID
                  </button>
                </div>
              ) : null}

              {splitStep === 'done' ? (
                <div className="pd-split-done">
                  <span className="pd-split-done-icon" aria-hidden>
                    <CircleCheck size={40} strokeWidth={1.6} />
                  </span>
                  <p className="pd-split-done-title">Bill fully settled</p>
                  <div className="pd-split-done-list">
                    {splitPayments.map((p, i) => {
                      const meta = SPLIT_METHODS.find((m) => m.id === p.method)
                      return (
                        <span key={i} className="pd-split-done-row">
                          <span className="pd-split-done-row-label">
                            {meta ? <meta.icon size={14} /> : null} {meta?.label}
                          </span>
                          <span className="pd-split-done-row-val">
                            AED {money(p.paid)}
                            {p.tip > 0 ? ` + ${money(p.tip)} tip` : ''}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                  <button type="button" className="pd-split-paid-btn" onClick={finishSplitPayment}>
                    Done
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tableFloorOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) hideTablePopup()
          }}
        >
          <div className="pd-floor-dialog" role="dialog" aria-modal="true">
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
              <button type="button" className="pd-mod-x" onClick={hideTablePopup} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-floor-canvas">
              <p className="pd-floor-note">No floor map defined for this Area. Showing default table layout.</p>
              <div className="pd-table-grid is-floor">
                {tablesForArea.map((t) => {
                  const occ = occupiedByTable.get(t.id) ?? []
                  const occupied = occ.length > 0
                  return (
                    <TableCard
                      key={t.id}
                      label={t.name}
                      seats={t.seats}
                      status={occupied ? 'occupied' : 'free'}
                      orderNo={occupied ? occ[0].kotNo : undefined}
                      pax={occupied ? occ[0].pax : undefined}
                      onClick={() => void tableBtnClick(t, true)}
                      occupiedChairs={occ.filter((k) => k.chairNo > 0).map((k) => k.chairNo)}
                      onChairSelect={(chair) => void dotChairClick(t, chair)}
                    />
                  )
                })}
                {tablesForArea.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
              </div>
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
                  onClick={() => {
                    setCustomerOpen(true)
                    void loadCustomers()
                  }}
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
            if (e.target === e.currentTarget) setCustomerOpen(false)
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
              <label className="pd-search">
                <Search size={14} color="var(--text-3)" />
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadCustomers(e.currentTarget.value)
                  }}
                  placeholder="Search name / mobile"
                />
                {customerSearch ? (
                  <button
                    type="button"
                    className="pd-search-clear"
                    aria-label="Clear search"
                    onClick={() => {
                      setCustomerSearch('')
                      void loadCustomers('')
                    }}
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </label>
              <div className="pd-ol-list">
                {customerState === 'loading' ? <p className="pd-cat-msg">Loading…</p> : null}
                {customerRows.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pd-ol-row${customerId === c.id ? ' is-on' : ''}`}
                    onClick={() => {
                      setCustomerId(c.id)
                      setCustomerName(c.name)
                      setCustomerOpen(false)
                    }}
                  >
                    <strong>{c.name}</strong>
                    <span>{c.mobile || '—'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {orderListOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOrderListOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-wide" role="dialog" aria-modal="true">
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
                    className={`pd-ol-filter${orderListSupply === s ? ' is-on' : ''}`}
                    onClick={() => {
                      setOrderListSupply(s)
                      void loadOrderList(s, orderListSearch)
                    }}
                  >
                    {s === 'ALL' ? 'All Orders' : s}
                  </button>
                ))}
              </div>
              <label className="pd-search">
                <Search size={14} color="var(--text-3)" />
                <input
                  value={orderListSearch}
                  onChange={(e) => setOrderListSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadOrderList(orderListSupply, e.currentTarget.value)
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
                      void loadOrderList(orderListSupply, '')
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
                {orderListRows.map((row) => (
                  <button
                    key={row.kotMasterId}
                    type="button"
                    className="pd-ol-card"
                    disabled={loadingKot}
                    onClick={() => void takeOrder(row.kotMasterId, false)}
                  >
                    <span className="pd-ol-card-area">
                      {row.supplyType} · {row.areaName || 'Area'}
                    </span>
                    <span className="pd-ol-card-time">{formatKotClock(row.kotTime)}</span>
                    <span className="pd-ol-card-table">
                      Table: {row.tableName || 'N/A'}
                    </span>
                    <span className="pd-ol-card-pax">PAX: {row.pax || 0}</span>
                    <span className="pd-ol-card-waiter">{row.waiterName || waiter}</span>
                    {row.remarks ? <span className="pd-ol-card-note">{row.remarks}</span> : null}
                    <span className="pd-ol-card-amt">AED {money(row.amount)}</span>
                    <span className="pd-ol-card-kot">KOT No: {row.kotNo}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
