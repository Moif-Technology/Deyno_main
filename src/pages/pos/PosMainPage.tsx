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
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, PenLine, StickyNote, ArrowRight, Clock, ChevronRight, ChevronDown, Hash, Home, LogOut, Tag, Trash2, X, Printer, Save, MessageSquare, Percent, FileText, Ban, CircleOff, RotateCcw, MinusCircle, Receipt, MapPinned, Utensils, ShoppingBag, Truck, CreditCard, SlidersHorizontal, Plus, ClipboardList, Users, User, ScanBarcode, Sandwich, Soup, Coffee, Flame, Cake, CupSoda, GlassWater, Star, Fish, Salad, Pizza, Drumstick, Beef, Egg, UtensilsCrossed, Smile, Sunrise, MoreHorizontal, Banknote, Wallet, Smartphone, Globe, Gift, SplitSquareHorizontal, Ellipsis, QrCode, ArrowLeft, CircleCheck, Merge, Pencil, ArrowLeftRight, BarChart3, ShieldCheck, Settings as SettingsIcon, Menu as MenuIcon, Repeat, Package, SeparatorHorizontal, Info } from 'lucide-react'
import { SessionManager } from '../../utils/sessionManager'
import { clearStaffSession } from '../../utils/pinLoginSession'
import { getEnrollment } from '../../utils/deviceEnrollment'
import { getPosSession } from '../../utils/posSession'
import { translateToArabic } from '../../utils/translate'
import { apiService, ApiError } from '../../api/apiService'
import { TableCard, TableGlyph } from '../../components/common/TableCard'
import { Toast, type ToastKind } from '../../components/common/Toast'
import { DatePicker } from '../../components/common/DatePicker'
import { Toggle } from '../../components/common/Toggle'
import { SearchBar } from '../../components/common/SearchBar'
import { SearchSelect, type SearchSelectOption } from '../../components/common/SearchSelect'
import { ArabicInput } from '../../components/common/ArabicInput'
import { ScrollTable } from '../../components/common/ScrollTable'
import { GlobalSearch, type GlobalSearchItem } from '../../components/common/GlobalSearch'
import SalesViewerDialog from './SalesViewerDialog'
import CounterCloseAllDialog from './CounterCloseAllDialog'
import TableShapePicker from './TableShapePicker'
import './posMain.css'

const NAV = ['Creation', 'Edit', 'Transactions', 'Credit', 'Reports', 'Admin', 'Settings'] as const

const NAV_ICON: Record<(typeof NAV)[number], ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Creation: Plus,
  Edit: Pencil,
  Transactions: ArrowLeftRight,
  Credit: CreditCard,
  Reports: BarChart3,
  Admin: ShieldCheck,
  Settings: SettingsIcon,
}
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
  Creation: [
    'Product Entry',
    'Area Entry',
    'Table Entry',
    'Main Group Entry',
    'Group Entry',
    'Sub Group Entry',
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
    { label: 'Production', children: ['Entry', 'List'] },
    {
      label: 'Product Transfer/Receive',
      children: ['Product Request', 'Product receipt', 'Product Transfer', 'Transfer List', 'Receipt List'],
    },
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
  Admin: [
    'CounterClose -Admin',
    'DayClose report',
    'Clear KOT',
    'Discount Entry',
    'DiscountList',
    'Change Settlement',
    'ProductList Edit',
    'KDS Refresh',
    'Change Discount% Button',
  ],
  Settings: [
    'Printer Setup',
    'User List',
    'Activate Access Card',
    'Privillage Setup',
    'Control Panel',
    'Password Change',
    'Lang setup',
    'Party Order List',
    'Multi Supplier setup',
    'Disable VAT',
    'Utility For Vat Correction',
  ],
}

/** Backing config for the generic master-entry modals opened from the
 * "Creation" side-nav (everything except Product Entry, which reuses the
 * dedicated Add New Item modal). Header icon + title come from here so the
 * modal heading always matches the side-menu label that opened it. */
const ENTRY_DEFS: { key: EntryKey; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { key: 'area', label: 'Area Entry', icon: MapPinned },
  { key: 'table', label: 'Table Entry', icon: Utensils },
  { key: 'mainGroup', label: 'Main Group Entry', icon: Tag },
  { key: 'group', label: 'Group Entry', icon: Hash },
  { key: 'subGroup', label: 'Sub Group Entry', icon: SeparatorHorizontal },
  { key: 'kitchenMessage', label: 'Kitchen Message', icon: MessageSquare },
  { key: 'combo', label: 'Combo', icon: Merge },
  { key: 'recipe', label: 'Recipe Entry', icon: ClipboardList },
  { key: 'barcode', label: 'Barcode Print Utility', icon: ScanBarcode },
  { key: 'notes', label: 'Notes Entry', icon: FileText },
  { key: 'onlineSource', label: 'Online Source Entry', icon: Globe },
  { key: 'paymentMode', label: 'Payment Mode Entry', icon: Wallet },
  { key: 'messMaster', label: 'Mess Master Entry', icon: Users },
  { key: 'addOn', label: 'Add On', icon: Gift },
  { key: 'booking', label: 'Booking', icon: CircleCheck },
  { key: 'bookingList', label: 'Booking List', icon: Repeat },
  { key: 'floorDesign', label: 'Floor Design', icon: SlidersHorizontal },
  { key: 'stockAdjustment', label: 'Stock Adjustment', icon: RotateCcw },
  { key: 'stockAdjustList', label: 'Stock Adjust List', icon: ClipboardList },
  { key: 'productionEntry', label: 'Production Entry', icon: Package },
  { key: 'openingStock', label: 'Opening Stock Entry', icon: ShoppingBag },
  { key: 'stockReport', label: 'Stock report', icon: BarChart3 },
  { key: 'movementReport', label: 'Movement Report', icon: Truck },
  { key: 'productRequest', label: 'Product Request', icon: ArrowLeftRight },
  { key: 'productReceipt', label: 'Product receipt', icon: ArrowLeftRight },
  { key: 'productTransfer', label: 'Product Transfer', icon: Truck },
  { key: 'transferList', label: 'Transfer List', icon: ClipboardList },
  { key: 'receiptList', label: 'Receipt List', icon: ClipboardList },
  { key: 'supplierList', label: 'SupplierList', icon: User },
  { key: 'purchaseEntry', label: 'Purchase entry', icon: CreditCard },
  { key: 'purchaseList', label: 'Purchase List', icon: ClipboardList },
  { key: 'purchaseReturn', label: 'Purchase Return', icon: RotateCcw },
  { key: 'purchaseReturnList', label: 'Purchase ReturnList', icon: ClipboardList },
  { key: 'damageEntry', label: 'Damage Entry', icon: Ban },
  { key: 'damageList', label: 'Damage List', icon: ClipboardList },
  { key: 'advancePayment', label: 'Advance Payment', icon: Banknote },
  { key: 'paymentList', label: 'PaymentList', icon: ClipboardList },
  { key: 'osBalanceList', label: 'Os Balance List', icon: BarChart3 },
  { key: 'creditReceiptList', label: 'ReceiptList', icon: ClipboardList },
  { key: 'advanceViewer', label: 'Advance Viewer', icon: Banknote },
  { key: 'messBillViewer', label: 'Mess Bill Viewer', icon: Users },
  { key: 'billReprint', label: 'Bill Reprint', icon: Printer },
  { key: 'areaWiseReportRP', label: 'Area Wise report', icon: MapPinned },
  { key: 'groupWiseRP', label: 'Group Wise', icon: Tag },
  { key: 'itemWiseRP', label: 'Item Wise', icon: BarChart3 },
  { key: 'itemVoidReportRP', label: 'Item Void Report', icon: Ban },
  { key: 'cancelBillDetails', label: 'Cancel Bill Details', icon: FileText },
  { key: 'cancelBillSummary', label: 'Cancel Bill Summary', icon: FileText },
  { key: 'counterCloseReportsRP', label: 'CounterClose Reports', icon: BarChart3 },
  { key: 'salesBillWiseRP', label: 'Sales BillWise', icon: Receipt },
  { key: 'dayWiseRP', label: 'DayWise', icon: Receipt },
  { key: 'pendingOrderList', label: 'Pending Order List', icon: ClipboardList },
  { key: 'counterWiseA4', label: 'CounterWise', icon: BarChart3 },
  { key: 'counterWiseTimewise', label: 'CounterWise Timewise', icon: BarChart3 },
  { key: 'itemwiseSummary', label: 'Summary', icon: BarChart3 },
  { key: 'itemwiseDetails', label: 'Details', icon: FileText },
  { key: 'areawiseA4', label: 'Areawise', icon: MapPinned },
  { key: 'waiterwise', label: 'Waiterwise', icon: Users },
  { key: 'salesmanWise', label: 'Salesman Wise', icon: User },
  { key: 'customerAnalysisDetailed', label: 'Detailed', icon: Users },
  { key: 'customerAnalysisSummary', label: 'Summary', icon: Users },
  { key: 'counterCloseDetailsA4', label: 'CounterClose Details', icon: BarChart3 },
  { key: 'incomeExpense', label: 'Income Expense', icon: Wallet },
  { key: 'productionReport', label: 'Production Report', icon: Package },
  { key: 'itemVoidA4', label: 'Item Void', icon: Ban },
  { key: 'graphReport', label: 'Graph Report', icon: BarChart3 },
  { key: 'itemwiseViewer', label: 'Itemwise Viewer', icon: FileText },
  { key: 'delBoyCommission', label: 'Del. Boy commission', icon: Truck },
  { key: 'productMovementFast', label: 'Fast Move', icon: Truck },
  { key: 'productMovementSlow', label: 'Slow Move', icon: Truck },
  { key: 'dayCloseReport', label: 'DayClose report', icon: BarChart3 },
  { key: 'incomeExpenseEntry', label: 'Income or Expenses', icon: Wallet },
  { key: 'discountEntry', label: 'Discount Entry', icon: Percent },
  { key: 'discountList', label: 'DiscountList', icon: Percent },
  { key: 'changeSettlement', label: 'Change Settlement', icon: CreditCard },
  { key: 'vatActivation', label: 'VAT Activation', icon: ShieldCheck },
  { key: 'productListEdit', label: 'ProductList Edit', icon: Package },
  { key: 'changeDiscountPercent', label: 'Change Discount% Button', icon: Percent },
  { key: 'eventLogs', label: 'Event Logs', icon: FileText },
  { key: 'printerSetup', label: 'Printer Setup', icon: Printer },
  { key: 'userList', label: 'User List', icon: User },
  { key: 'activateAccessCard', label: 'Activate Access Card', icon: ShieldCheck },
  { key: 'privilegeSetup', label: 'Privillage Setup', icon: ShieldCheck },
  { key: 'controlPanel', label: 'Control Panel', icon: SettingsIcon },
  { key: 'passwordChange', label: 'Password Change', icon: ShieldCheck },
  { key: 'langSetup', label: 'Lang setup', icon: Globe },
  { key: 'partyOrderList', label: 'Party Order List', icon: ClipboardList },
  { key: 'multiSupplierSetup', label: 'Multi Supplier setup', icon: Truck },
  { key: 'vatCorrectionUtility', label: 'Utility For Vat Correction', icon: Percent },
  { key: 'cashInOut', label: 'Cash/Cash Out', icon: Banknote },
]

// "Summary" appears twice in the nav tree (Reports A4 > Itemwise > Summary,
// and Reports A4 > Customer Analysis > Summary) — a plain label lookup can't
// tell them apart, so it's excluded here and resolved by full path instead
// (see AMBIGUOUS_LABEL_ROUTES below).
const AMBIGUOUS_LABELS = new Set(['Summary'])

const LABEL_TO_ENTRY: Partial<Record<string, EntryKey>> = {
  ...Object.fromEntries(ENTRY_DEFS.filter((d) => !AMBIGUOUS_LABELS.has(d.label)).map((d) => [d.label, d.key])),
  // The "Production" submenu's child is just "Entry" in the nav tree — the
  // modal heading reads "Production Entry" (ENTRY_DEFS.label above) for
  // clarity, but the click target's actual text is the bare word.
  Entry: 'productionEntry',
}

/** Resolves an ambiguous leaf label (in AMBIGUOUS_LABELS) using a substring
 * of its full nav path instead. Checked before the plain LABEL_TO_ENTRY
 * lookup whenever the label alone isn't enough to know which screen. */
const AMBIGUOUS_LABEL_ROUTES: { label: string; pathIncludes: string; key: EntryKey }[] = [
  { label: 'Summary', pathIncludes: 'Itemwise', key: 'itemwiseSummary' },
  { label: 'Summary', pathIncludes: 'Customer Analysis', key: 'customerAnalysisSummary' },
]
const ENTRY_META: Record<EntryKey, (typeof ENTRY_DEFS)[number]> = Object.fromEntries(
  ENTRY_DEFS.map((d) => [d.key, d]),
) as Record<EntryKey, (typeof ENTRY_DEFS)[number]>

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
/** "Add New Item" / edit-product modal draft — all number-ish fields stay
 * as strings while editing so the input can be blank/partial mid-type. */
type ProductForm = {
  id: number
  code: string
  description: string
  arabicDescription: string
  groupId: number
  groupName: string
  subgroupId: number
  subgroupName: string
  kitchenLocation: string
  kotPriority: string
  unitCost: string
  vatIn: string
  unitPrice: string
  vatOut: string
  packQty: string
  unit: string
  qtyOnHand: string
  productType: string
  itemDescription: string
}

const BLANK_PRODUCT_FORM: ProductForm = {
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

/** Nav-menu entries under "Creation"/"Transactions" that open a simple
 * master-entry modal instead of a bespoke screen. 'product' (Product Entry)
 * reuses the existing Add New Item modal and isn't part of this generic set. */
type EntryKey =
  | 'area'
  | 'table'
  | 'mainGroup'
  | 'group'
  | 'subGroup'
  | 'kitchenMessage'
  | 'combo'
  | 'recipe'
  | 'barcode'
  | 'notes'
  | 'onlineSource'
  | 'paymentMode'
  | 'messMaster'
  | 'addOn'
  | 'booking'
  | 'bookingList'
  | 'floorDesign'
  | 'stockAdjustment'
  | 'stockAdjustList'
  | 'productionEntry'
  | 'openingStock'
  | 'stockReport'
  | 'movementReport'
  | 'productRequest'
  | 'productReceipt'
  | 'productTransfer'
  | 'transferList'
  | 'receiptList'
  | 'supplierList'
  | 'purchaseEntry'
  | 'purchaseList'
  | 'purchaseReturn'
  | 'purchaseReturnList'
  | 'damageEntry'
  | 'damageList'
  | 'advancePayment'
  | 'paymentList'
  | 'osBalanceList'
  | 'creditReceiptList'
  | 'advanceViewer'
  | 'messBillViewer'
  | 'billReprint'
  | 'areaWiseReportRP'
  | 'groupWiseRP'
  | 'itemWiseRP'
  | 'itemVoidReportRP'
  | 'cancelBillDetails'
  | 'cancelBillSummary'
  | 'counterCloseReportsRP'
  | 'salesBillWiseRP'
  | 'dayWiseRP'
  | 'pendingOrderList'
  | 'counterWiseA4'
  | 'counterWiseTimewise'
  | 'itemwiseSummary'
  | 'itemwiseDetails'
  | 'areawiseA4'
  | 'waiterwise'
  | 'salesmanWise'
  | 'customerAnalysisDetailed'
  | 'customerAnalysisSummary'
  | 'counterCloseDetailsA4'
  | 'incomeExpense'
  | 'productionReport'
  | 'itemVoidA4'
  | 'graphReport'
  | 'itemwiseViewer'
  | 'delBoyCommission'
  | 'productMovementFast'
  | 'productMovementSlow'
  | 'dayCloseReport'
  | 'incomeExpenseEntry'
  | 'discountEntry'
  | 'discountList'
  | 'changeSettlement'
  | 'vatActivation'
  | 'productListEdit'
  | 'changeDiscountPercent'
  | 'eventLogs'
  | 'printerSetup'
  | 'userList'
  | 'activateAccessCard'
  | 'privilegeSetup'
  | 'controlPanel'
  | 'passwordChange'
  | 'langSetup'
  | 'partyOrderList'
  | 'multiSupplierSetup'
  | 'vatCorrectionUtility'
  | 'cashInOut'

type RecipeLine = {
  code: string
  name: string
  packDetails: string
  cost: string
  packQty: string
  qty: string
  unit: string
}

type BookingRow = {
  id: number
  area: string
  customer: string
  mobile: string
  partySize: string
  advance: string
  date: string
}

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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
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

/** Minutes since a KOT was saved, or null when the time can't be read. */
function kotAgeMinutes(iso: string): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 60000))
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

/** Renders a nav item's submenu inline (accordion-style, indented under its
 * parent) instead of a flyout — entries with `children` expand/collapse in
 * place, tracked by a path string ("Reports/Reports A4/…") so each nesting
 * level opens independently. */
function NavMenuInline({
  entries,
  path,
  depth,
  expanded,
  onToggle,
  onPick,
}: {
  entries: readonly NavMenuEntry[]
  path: string
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  onPick: (label: string, path: string) => void
}) {
  return (
    <>
      {entries.map((entry) => {
        const label = typeof entry === 'string' ? entry : entry.label
        const hasChildren = typeof entry !== 'string' && 'children' in entry
        const itemPath = `${path}/${label}`
        const isOpen = hasChildren && expanded.has(itemPath)
        return (
          <div key={itemPath} className="pd-subnav-item">
            <button
              type="button"
              className={`pd-subnav-btn${isOpen ? ' is-open' : ''}`}
              style={{ paddingLeft: 14 + depth * 14 }}
              onClick={() => (hasChildren ? onToggle(itemPath) : onPick(label, itemPath))}
            >
              <span>{label}</span>
              {hasChildren ? (
                <ChevronRight size={12} className="pd-subnav-arrow" />
              ) : null}
            </button>
            {hasChildren && isOpen ? (
              <NavMenuInline
                entries={(entry as { children: readonly NavMenuEntry[] }).children}
                path={itemPath}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onPick={onPick}
              />
            ) : null}
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

  const [nav, setNav] = useState<(typeof NAV)[number]>('Creation')
  const [groups, setGroups] = useState<Cat[]>([])
  const [allSubGroups, setAllSubGroups] = useState<SubCat[]>([])
  const [allSubSubGroups, setAllSubSubGroups] = useState<SubSubCat[]>([])
  const [allProducts, setAllProducts] = useState<ProductTile[]>([])
  const [notesHint, setNotesHint] = useState<string | null>(null)
  const [notesKind, setNotesKind] = useState<ToastKind>('error')
  const [openNavMenu, setOpenNavMenu] = useState<(typeof NAV)[number] | null>(null)
  // True while the side-menu search has text — the menu list is swapped for
  // the search results until it's cleared.
  const [navSearching, setNavSearching] = useState(false)
  const navSearchRef = useRef<HTMLInputElement | null>(null)
  const [expandedSubPaths, setExpandedSubPaths] = useState<Set<string>>(() => new Set())
  const [sideNavHidden, setSideNavHidden] = useState(true)
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
  const gridWrapRef = useRef<HTMLDivElement | null>(null)
  const groupTouch = useRef({ active: false, pointerId: -1, startY: 0, lastY: 0, moved: false })
  const [groupId, setGroupId] = useState<number | null>(null)
  const [subGroupId, setSubGroupId] = useState<number | null>(null)
  const [subSubGroupId, setSubSubGroupId] = useState<number | null>(null)
  const [topMoveActive, setTopMoveActive] = useState(false)
  const [topMoveProducts, setTopMoveProducts] = useState<ProductTile[]>([])
  const [topMoveLoading, setTopMoveLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<TicketLine[]>([])
  const [selectedLine, setSelectedLine] = useState<number | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(() => new Set())
  const [separatorAfterKeys, setSeparatorAfterKeys] = useState<Set<number>>(() => new Set())
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
  const deliveryPickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [orderListRows, setOrderListRows] = useState<OrderRow[]>([])
  const [orderListState, setOrderListState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [orderListError, setOrderListError] = useState<string | null>(null)
  const [orderListSearch, setOrderListSearch] = useState('')
  const [orderListSupply, setOrderListSupply] = useState<'ALL' | ServiceKind>('ALL')
  const [areaOpen, setAreaOpen] = useState(false)
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)
  // True while the More modal plays its zoom-out, before it unmounts.
  const [moreClosing, setMoreClosing] = useState(false)
  const moreCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [payOpen, setPayOpen] = useState(false)

  // Split Payment — method → amount entry (with an inline, optional tip
  // toggle), looping back to method selection until the bill is covered.
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitStep, setSplitStep] = useState<'method' | 'entry' | 'done'>('method')
  const [splitMethod, setSplitMethod] = useState<SplitMethod | null>(null)
  const [splitTip, setSplitTip] = useState<'none' | 'with' | null>(null)
  const [splitPaidInput, setSplitPaidInput] = useState('')
  const [splitTipInput, setSplitTipInput] = useState('')
  const [splitActiveField, setSplitActiveField] = useState<'paid' | 'tip'>('paid')
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([])

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentsDraft, setCommentsDraft] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerRows, setCustomerRows] = useState<{ id: number; name: string; mobile: string }[]>([])
  const [customerState, setCustomerState] = useState<'idle' | 'loading'>('idle')

  // Receipt lookup — "Receipt" quick action: find a credit customer, see
  // their outstanding bills and recent payment history.
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptSearch, setReceiptSearch] = useState('')
  const [receiptCustomers, setReceiptCustomers] = useState<{ id: number; code: string; name: string }[]>([])
  const [receiptCustomersState, setReceiptCustomersState] = useState<'idle' | 'loading'>('idle')
  const [receiptCustomerId, setReceiptCustomerId] = useState<number | null>(null)
  const [receiptCustomerName, setReceiptCustomerName] = useState('')
  const [receiptBills, setReceiptBills] = useState<{ date: string; billNo: string; amount: number; balance: number }[]>([])
  const [receiptHistory, setReceiptHistory] = useState<{ date: string; type: string; amount: number }[]>([])
  const [receiptDetailState, setReceiptDetailState] = useState<'idle' | 'loading' | 'error'>('idle')

  // "Add New Item" — product master form, plus the group/subgroup picker
  // it opens (the same picker serves both fields).
  const [productOpen, setProductOpen] = useState(false)
  const [productForm, setProductForm] = useState<ProductForm>(BLANK_PRODUCT_FORM)
  const [productSaving, setProductSaving] = useState(false)
  // Options for Add New Item's Group / SubGroup search dropdowns.
  const [groupOptions, setGroupOptions] = useState<SearchSelectOption[]>([])
  const [subgroupOptions, setSubgroupOptions] = useState<SearchSelectOption[]>([])
  const [groupOptionsLoading, setGroupOptionsLoading] = useState<'group' | 'subgroup' | null>(null)

  // Generic "Creation" master-entry modals (Area/Table/Group/etc.) — one
  // shared string|boolean bag keyed by field name, since only one of these
  // is ever open at a time and each modal only reads its own keys.
  const [entryModal, setEntryModal] = useState<EntryKey | null>(null)
  const [entrySaving, setEntrySaving] = useState(false)
  const [entryForm, setEntryForm] = useState<Record<string, string | boolean>>({})
  // Live English→Arabic auto-fill bookkeeping — plain refs (not state) since
  // they're just debounce/ownership tracking, not anything that renders.
  const arabicAutoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const arabicAutoLast = useRef<Record<string, string>>({})
  const translateWarnedAt = useRef(0)
  const [entryWaiters, setEntryWaiters] = useState<{ id: number; name: string }[]>([])
  const [kitchenMessages, setKitchenMessages] = useState<{ id: number; message: string; arabic: string }[]>([
    { id: 1, message: 'LESS SPICY', arabic: 'بدون طحينية' },
    { id: 2, message: 'LESS OIL', arabic: 'زيادة طحينية' },
    { id: 3, message: 'SPICY', arabic: '' },
    { id: 4, message: 'Rare', arabic: '' },
    { id: 5, message: 'Medium rare', arabic: '' },
    { id: 6, message: 'NO NEED PLASTIC', arabic: '' },
    { id: 7, message: 'Medium', arabic: '' },
    { id: 8, message: 'Medium well', arabic: '' },
    { id: 9, message: 'Well done', arabic: '' },
  ])
  const [kitchenMsgSelected, setKitchenMsgSelected] = useState<number | null>(null)
  const [comboGroups, setComboGroups] = useState<string[]>([])
  const [comboGroupInput, setComboGroupInput] = useState('')
  const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([])
  const [recipeDraft, setRecipeDraft] = useState({ code: '', name: '', packDetails: '', cost: '', packQty: '', qty: '', unit: 'GM' })
  const [notesList, setNotesList] = useState<{ id: number; date: string; description: string }[]>([])
  const [notesSelected, setNotesSelected] = useState<number | null>(null)
  const [paymentModes, setPaymentModes] = useState<{ name: string; status: string }[]>([
    { name: 'TALABAT', status: 'ACTIVE' },
    { name: 'ZOMATO', status: 'ACTIVE' },
  ])
  const [messLines, setMessLines] = useState<string[]>([])
  // Mess Master's searchable item picker — keyed by name (that's what a mess
  // line stores), so duplicate product names collapse to one option.
  const messItemOptions = useMemo<SearchSelectOption[]>(() => {
    const seen = new Set<string>()
    const out: SearchSelectOption[] = []
    for (const p of allProducts) {
      if (seen.has(p.name)) continue
      seen.add(p.name)
      out.push({ id: p.name, name: p.name })
    }
    return out
  }, [allProducts])
  const [addOns, setAddOns] = useState<{ name: string; arabic: string; priceNoVat: string; vatPct: string }[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [bookingAreaTab, setBookingAreaTab] = useState<'DINE IN' | 'UPSTAIR' | 'OUTSIDE'>('DINE IN')
  const [floorAreaId, setFloorAreaId] = useState<number | null>(null)
  const [floorBusy, setFloorBusy] = useState(false)

  // Reports — these two already have full, real implementations sitting in
  // their own files (real apiService calls) that just weren't wired to the
  // side nav yet, so they're opened directly instead of via the generic
  // entry-modal system.
  const [salesViewerOpen, setSalesViewerOpen] = useState(false)
  const [counterCloseOpen, setCounterCloseOpen] = useState(false)

  // Admin submenu's plain alert/confirm popups (Cashier Change, Clear KOT,
  // ShutDown) — a different shape from the master-entry modals (no header
  // icon, red/pink alert card, OK or Yes/No only), so they get their own
  // small piece of state instead of forcing them into the EntryKey system.
  const [confirmAlert, setConfirmAlert] = useState<{
    title: string
    message: string
    mode: 'ok' | 'yesno'
    tone?: 'info' | 'danger'
    confirmLabel?: string
    onYes?: () => void
  } | null>(null)

  // Transactions master-entry modals (Stock Adjustment, Production, Purchase,
  // Damage, etc.) — none of these have a backend endpoint yet, so the "add
  // row" screens share one generic draft + line-list pair (reset per open)
  // instead of nine near-identical arrays, and Save/Print/Post just confirm
  // locally rather than persisting.
  const [txnLines, setTxnLines] = useState<Record<string, string>[]>([])
  const [txnDraft, setTxnDraft] = useState<Record<string, string>>({})
  const [txnSelected, setTxnSelected] = useState<number | null>(null)
  const [suppliers] = useState<{ code: string; name: string; phone: string; mobile: string; contact: string }[]>([
    { code: 'SUPP1', name: 'CASH SUPPLIER', phone: '0', mobile: '', contact: '' },
  ])
  const [mrSelectedGroups, setMrSelectedGroups] = useState<Set<number>>(new Set())

  // Settings — User List / Activate Access Card share the same staff roster.
  const [userListRows, setUserListRows] = useState<
    { code: string; name: string; role: string; login: string; card: string }[]
  >([
    { code: '123', name: 'ADMIN', role: 'ADMIN', login: '0', card: 'Not Set' },
    { code: 'invent', name: 'Invent', role: 'ADMIN', login: '1122', card: 'Not Set' },
    { code: 'MARIA', name: 'MARIA', role: 'ADMIN', login: '201', card: 'Active' },
    { code: '351', name: 'CASHIER1', role: 'CASHIER', login: '100', card: 'Not Set' },
    { code: '352', name: 'CASHIER2', role: 'CASHIER', login: '901', card: 'Not Set' },
    { code: 'MOI', name: 'MOIF ADMIN', role: 'CASHIER', login: '013', card: 'Not Set' },
  ])
  const [userListSelected, setUserListSelected] = useState<string | null>('123')
  const [langRows, setLangRows] = useState<{ en: string; ar: string }[]>([])
  const [printerRows, setPrinterRows] = useState<{ counterNo: string; kitchenLoc: string; printerName: string }[]>([])
  const [controlPanelTab, setControlPanelTab] = useState('Company Details')
  const [privilegeChecks, setPrivilegeChecks] = useState<Set<string>>(new Set(['Settings', 'Purchase', 'Main Page']))

  // Cash In / Cash Out — real backend (fetchCashInOut/addCashInOut) already
  // exists for the counter's cash-drawer movements.
  const [cashMode, setCashMode] = useState<'pick' | 'in' | 'out'>('pick')
  const [cashRows, setCashRows] = useState<{ desc: string; amount: number }[]>([])

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

  // Ctrl+K (⌘K on Mac) opens the side menu with its search box focused.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSideNavHidden(false)
        window.setTimeout(() => navSearchRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (sideNavHidden) setNavSearching(false)
  }, [sideNavHidden])

  useEffect(() => {
    if (!notesHint) return
    const t = window.setTimeout(() => setNotesHint(null), 1800)
    return () => window.clearTimeout(t)
  }, [notesHint])

  // Keep the ticket list scrolled to the newest line — once it overflows its
  // max-height (~6 rows), adding another item would otherwise leave it below
  // the fold with no automatic scroll to reveal it.
  useEffect(() => {
    const el = gridWrapRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])

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

  function openMoreActions() {
    if (moreCloseTimer.current) clearTimeout(moreCloseTimer.current)
    moreCloseTimer.current = null
    setMoreClosing(false)
    setMoreActionsOpen(true)
  }

  function closeMoreActions() {
    if (!moreActionsOpen || moreCloseTimer.current) return
    setMoreClosing(true)
    // Matches the .pd-more-overlay.is-closing animation duration.
    moreCloseTimer.current = setTimeout(() => {
      moreCloseTimer.current = null
      setMoreActionsOpen(false)
      setMoreClosing(false)
    }, 180)
  }

  useEffect(() => {
    if (!moreActionsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMoreActions()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => () => {
    if (moreCloseTimer.current) clearTimeout(moreCloseTimer.current)
  }, [])

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

  const crumb = useMemo(() => {
    if (topMoveActive) return 'Top Move'
    const g = groups.find((x) => x.id === groupId)?.name
    const s = groupSubs.find((x) => x.id === subGroupId)?.name
    const ss = subSubs.find((x) => x.id === subSubGroupId)?.name
    return [g, s, ss].filter(Boolean).join(' > ')
  }, [groups, groupSubs, subSubs, groupId, subGroupId, subSubGroupId, topMoveActive])

  const products = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return allProducts.filter((p) =>
        `${p.name} ${p.sub ?? ''} ${p.price}`.toLowerCase().includes(q),
      )
    }
    if (topMoveActive) return topMoveProducts
    return allProducts.filter((p) => {
      if (groupId == null) return false
      if (p.groupId !== groupId) return false
      if (subGroupId != null && p.subgroupId !== subGroupId) return false
      if (subSubGroupId != null && p.subsubgroupId !== subSubGroupId) return false
      return true
    })
  }, [allProducts, groupId, subGroupId, subSubGroupId, query, topMoveActive, topMoveProducts])

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

  /** Selecting a group both loads its items and, if it has subgroups,
   * expands them indented underneath it (inline accordion) — no more
   * navigating to a separate subgroup "screen". */
  function onGroupClick(id: number) {
    setTopMoveActive(false)
    setGroupId(id)
    setSubGroupId(null)
    setSubSubGroupId(null)
  }

  function onSubGroupClick(id: number) {
    setTopMoveActive(false)
    setSubGroupId(id)
    setSubSubGroupId(null)
  }

  function onSubSubClick(id: number) {
    setTopMoveActive(false)
    setSubSubGroupId(id)
  }

  async function onTopMoveClick() {
    if (topMoveActive) {
      setTopMoveActive(false)
      return
    }
    setTopMoveActive(true)
    setQuery('')
    setTopMoveLoading(true)
    try {
      const to = new Date()
      const from = new Date(to)
      from.setDate(from.getDate() - 30)
      const rows = await apiService.fetchSalesReport('item-wise', {
        dateFrom: isoDate(from),
        dateTo: isoDate(to),
      })
      const qtyByProduct = new Map<number, number>()
      for (const r of rows) {
        const id = num(r.productId ?? r.ProductID ?? r.itemId ?? r.ItemID)
        if (!id) continue
        const qty = num(r.qty ?? r.quantity ?? r.Qty ?? r.totalQty ?? r.saleQty)
        qtyByProduct.set(id, (qtyByProduct.get(id) ?? 0) + qty)
      }
      const byId = new Map(allProducts.map((p) => [p.id, p]))
      const ranked = [...qtyByProduct.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => byId.get(id))
        .filter((p): p is ProductTile => !!p)
        .slice(0, 24)
      setTopMoveProducts(ranked)
      if (!ranked.length) toast('No top moving products found', 'info')
    } catch {
      toast('Could not load top moving products')
      setTopMoveActive(false)
    } finally {
      setTopMoveLoading(false)
    }
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

  /** Tapping a row's # turns every row's # into a checkbox so several lines
   * can be picked at once, then removed together with deleteSelectedLines. */
  function toggleLineSelect(key: number) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function deleteSelectedLines() {
    const blocked = lines.filter((l) => selectedKeys.has(l.key) && !l.kotPending).length
    setLines((prev) => prev.filter((l) => !(selectedKeys.has(l.key) && l.kotPending)))
    setSelectedKeys(new Set())
    if (blocked) {
      toast(`${blocked} item${blocked > 1 ? 's' : ''} already sent — use Item Cancel instead`)
    }
  }

  /** "Add Line" button above the table — draws a divider after the
   * currently selected row (or the last row, if none is selected) to mark
   * a course/batch break. Clicking it again on the same row removes it. */
  function toggleSeparatorAfterSelected() {
    if (lines.length === 0) {
      toast('Add an item first')
      return
    }
    const key = selectedLine ?? lines[lines.length - 1].key
    setSeparatorAfterKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
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
    setSelectedKeys(new Set())
    setSeparatorAfterKeys(new Set())
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
    // applyArea infers the active tab from the area's own supplyType, which
    // can disagree with pickAreaForService's more lenient name-based match
    // (e.g. an area named "Takeaway" but tagged with a blank/other supply
    // type) — set it explicitly so the TAKEAWAY tab actually highlights.
    setService('TAKEAWAY')
    setRemarks('')
    hideTablePopup()
    resetOpenKotTicket()
    clearQty()
  }

  /** btnDelivery_Click / Delivery() — table 0, hide popup. */
  function deliveryClick(forced?: AreaRow, askCustomer = true) {
    const match = forced ?? pickAreaForService('DELIVERY')
    if (!match) {
      toast('DELIVERY Area Not Found........')
      return
    }
    applyArea(match, 0)
    // Same reasoning as takeAwayClick — don't rely solely on applyArea's
    // supplyType-derived guess for which tab should be highlighted.
    setService('DELIVERY')
    setRemarks('')
    hideTablePopup()
    resetOpenKotTicket()
    if (askCustomer) {
      setCustomerOpen(true)
      void loadCustomers()
    }
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
    setSelectedKeys(new Set())
    setSeparatorAfterKeys(new Set())
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
    setSplitStep('entry')
  }

  /** "Add Tip" toggle on the amount-entry screen — expands/collapses the
   * Tip Amount box inline instead of a separate step. */
  function toggleSplitTip() {
    if (splitTip === 'with') {
      setSplitTip(null)
      setSplitTipInput('')
      setSplitActiveField('paid')
    } else {
      setSplitTip('with')
      setSplitActiveField('tip')
    }
  }

  function splitBack() {
    if (splitStep === 'entry') {
      setSplitMethod(null)
      setSplitTip(null)
      setSplitStep('method')
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
      setSelectedKeys(new Set())
      setSeparatorAfterKeys(new Set())
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
    openOrderListFor('ALL')
  }

  /** Double-clicking a service tab (TAKEAWAY) jumps straight to its filtered
   * Order List instead of making the cashier open More > Order List and
   * pick the filter chip by hand. */
  function openOrderListFor(supply: 'ALL' | ServiceKind) {
    setOrderListSearch('')
    setOrderListSupply(supply)
    setOrderListOpen(true)
    void loadOrderList(supply, '')
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

  async function loadReceiptCustomers(search = receiptSearch) {
    setReceiptCustomersState('loading')
    try {
      const rows = await apiService.fetchCreditSettlementCustomers({
        search: search.trim() || undefined,
        limit: 80,
      })
      setReceiptCustomers(
        rows.map((c) => ({
          id: num(c.customerId ?? c.CustomerID ?? c.id),
          code: String(c.customerCode ?? c.CustomerCode ?? c.code ?? '').trim(),
          name: String(c.customerName ?? c.CustomerName ?? c.name ?? '').trim(),
        })).filter((c) => c.id > 0 && c.name),
      )
    } catch {
      setReceiptCustomers([])
    } finally {
      setReceiptCustomersState('idle')
    }
  }

  /** The outstanding-bills / history payload shapes aren't documented
   * server-side, so pull the row list out from whichever wrapper key (or a
   * bare array) the API actually returns. */
  function rowsFrom(payload: unknown, keys: string[]): Record<string, unknown>[] {
    if (Array.isArray(payload)) return payload as Record<string, unknown>[]
    const obj = asRow(payload)
    for (const k of keys) {
      const v = obj[k]
      if (Array.isArray(v)) return v as Record<string, unknown>[]
    }
    return []
  }

  async function selectReceiptCustomer(c: { id: number; name: string }) {
    setReceiptCustomerId(c.id)
    setReceiptCustomerName(c.name)
    setReceiptDetailState('loading')
    try {
      const [billsRaw, historyRows] = await Promise.all([
        apiService.fetchCustomerOutstandingBills(String(c.id)),
        apiService.fetchCreditSettlementHistory({ customerId: String(c.id), limit: 20 }),
      ])
      setReceiptBills(
        rowsFrom(billsRaw, ['bills', 'data', 'rows']).map((b) => ({
          date: String(b.billDate ?? b.BillDate ?? b.date ?? '').trim(),
          billNo: String(b.billNo ?? b.BillNo ?? b.billNoDisplay ?? '').trim(),
          amount: num(b.billAmount ?? b.BillAmount ?? b.amount),
          balance: num(b.billOsBalance ?? b.BillOsBalance ?? b.osBalance ?? b.balance),
        })),
      )
      setReceiptHistory(
        historyRows.map((h) => ({
          date: String(h.transactionDate ?? h.TransactionDate ?? h.date ?? h.trnsDate ?? '').trim(),
          type: String(h.transactionType ?? h.TransactionType ?? h.type ?? h.paymentMode ?? '').trim(),
          amount: num(h.amount ?? h.Amount ?? h.transAmount),
        })),
      )
      setReceiptDetailState('idle')
    } catch {
      setReceiptBills([])
      setReceiptHistory([])
      setReceiptDetailState('error')
    }
  }

  async function reloadProducts() {
    try {
      const rows = await apiService.fetchProducts({ limit: 2000 })
      const groupIds = new Set(groups.map((g) => g.id))
      setAllProducts(mapProducts(rows).filter((p) => (groupIds.size ? groupIds.has(p.groupId) : true)))
    } catch {
      // Keep whatever was already loaded — the modal already told the user
      // whether the save/delete itself succeeded.
    }
  }

  function openNewProductModal() {
    setProductForm(BLANK_PRODUCT_FORM)
    setProductOpen(true)
  }

  /** "New Code" — no next-code endpoint exists yet, so this is a simple
   * timestamp-based placeholder the user can still edit by hand. */
  function generateNewProductCode() {
    setProductForm((f) => ({ ...f, code: `ITM${Date.now().toString().slice(-8)}` }))
  }

  // ── Generic "Creation" master-entry modals ────────────────────────────

  function ef(key: string): string {
    const v = entryForm[key]
    return typeof v === 'string' ? v : ''
  }
  function efBool(key: string): boolean {
    return entryForm[key] === true
  }
  function setEf(key: string, value: string | boolean) {
    setEntryForm((f) => ({ ...f, [key]: value }))
  }

  /** Debounced English→Arabic auto-fill, wired on the English field's own
   * onChange. Never clobbers a manual edit in the Arabic field — it only
   * overwrites while that field is empty or still holds what auto-fill put
   * there last (tracked per field in arabicAutoLast). */
  function notifyTranslateDown() {
    const now = Date.now()
    if (now - translateWarnedAt.current < 30000) return
    translateWarnedAt.current = now
    toast('Auto-translate unavailable — check the internet connection', 'info')
  }

  function setEfWithArabicAutoFill(englishKey: string, arabicKey: string, value: string) {
    setEf(englishKey, value)
    if (arabicAutoTimers.current[arabicKey]) clearTimeout(arabicAutoTimers.current[arabicKey])
    const trimmed = value.trim()
    if (!trimmed) return
    arabicAutoTimers.current[arabicKey] = setTimeout(() => {
      translateToArabic(trimmed)
        .then((translated) => {
          if (!translated) return
          setEntryForm((prev) => {
            const current = prev[arabicKey]
            const currentStr = typeof current === 'string' ? current : ''
            if (currentStr && currentStr !== arabicAutoLast.current[arabicKey]) return prev
            arabicAutoLast.current[arabicKey] = translated
            return { ...prev, [arabicKey]: translated }
          })
        })
        .catch(notifyTranslateDown)
    }, 400)
  }

  async function reloadAreas() {
    try {
      setAreas(mapAreas(await apiService.fetchAreas()))
    } catch {
      // Keep whatever was already loaded.
    }
  }

  async function reloadTables() {
    try {
      const rows = await apiService.fetchTables()
      setTables(
        rows
          .map((t) => ({
            id: Number(t.id) || 0,
            name: t.label,
            areaId: Number(t.areaId) || 0,
            seats: Number(t.seats) || 0,
            waiterId: Number(t.waiterId) || 0,
          }))
          .filter((t) => t.id > 0),
      )
    } catch {
      // Keep whatever was already loaded.
    }
  }

  async function reloadGroups() {
    try {
      setGroups(mapGroups(await apiService.fetchGroups()))
    } catch {
      // Keep whatever was already loaded.
    }
  }

  function closeEntryModal() {
    setEntryModal(null)
  }

  function openEntryModal(key: EntryKey) {
    setEntryForm({})
    setEntryModal(key)
    setSideNavHidden(true)

    if (key === 'table') {
      setEf('tableShape', 'SQUARE')
      void apiService
        .fetchWaiters()
        .then((rows) =>
          setEntryWaiters(
            rows
              .map((r) => ({ id: num(r.waiterId ?? r.WaiterID ?? r.id), name: String(r.waiterName ?? r.WaiterName ?? '').trim() }))
              .filter((w) => w.id > 0 && w.name),
          ),
        )
        .catch(() => setEntryWaiters([]))
      void apiService
        .nextTableNumber()
        .then((row) => {
          const n = num(asRow(row).tableNo ?? asRow(row).TableNo ?? asRow(row).nextTableNo ?? row)
          if (n > 0) setEf('tableNo', String(n))
        })
        .catch(() => {})
    }
    if (key === 'area') {
      setEf('tableCreationType', 'manual')
      setEf('showOnTablet', true)
    }
    if (key === 'barcode') {
      const today = isoDate(new Date())
      setEf('productionDate', today)
      setEf('expiryDate', today)
      setEf('printCount', '1')
    }
    if (key === 'paymentMode') {
      setEf('status', 'ACTIVE')
    }
    if (key === 'booking') {
      setBookingAreaTab('DINE IN')
      setEf('bookingDate', isoDate(new Date()))
    }
    if (key === 'bookingList') {
      const today = isoDate(new Date())
      setEf('bookingFrom', today)
      setEf('bookingTo', today)
    }
    if (key === 'floorDesign') {
      setFloorAreaId((prev) => prev ?? areas[0]?.id ?? null)
    }
    if (key === 'combo') {
      setComboGroups([])
      setComboGroupInput('')
    }
    if (key === 'recipe') {
      setRecipeLines([])
      setRecipeDraft({ code: '', name: '', packDetails: '', cost: '', packQty: '', qty: '', unit: 'GM' })
    }
    if (key === 'messMaster') setMessLines([])
    if (key === 'kitchenMessage') setKitchenMsgSelected(null)
    if (key === 'notes') {
      const today = isoDate(new Date())
      setNotesSelected(null)
      setEf('notesFrom', today)
      setEf('notesTo', today)
    }

    const lineItemKeys: EntryKey[] = [
      'stockAdjustment',
      'productionEntry',
      'openingStock',
      'productRequest',
      'productReceipt',
      'productTransfer',
      'purchaseEntry',
      'purchaseReturn',
      'damageEntry',
      'incomeExpenseEntry',
      'discountEntry',
      'productListEdit',
    ]
    if (lineItemKeys.includes(key)) {
      setTxnLines([])
      setTxnDraft({})
      setTxnSelected(null)
    }
    const today = isoDate(new Date())
    const weekAgo = isoDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    if (key === 'stockAdjustment' || key === 'productionEntry' || key === 'openingStock' || key === 'damageEntry') {
      setEf('txnDate', today)
      if (key === 'stockAdjustment') setTd('reason', 'Opening Stock')
      if (key === 'damageEntry') setTd('reason', 'Damage')
    }
    if (key === 'productRequest' || key === 'productReceipt' || key === 'productTransfer') {
      setEf('txnDate', today)
      setEf('txnFromArea', 'AUH')
    }
    if (key === 'purchaseEntry') {
      setEf('purchaseDate', today)
      setEf('enteredDate', today)
      setEf('payMode', 'CREDIT')
    }
    if (key === 'purchaseReturn') {
      setEf('returnDate', today)
      setEf('enteredDate', today)
      setEf('payMode', 'CREDIT')
      setEf('returnType', 'With GRN')
    }
    if (
      key === 'stockAdjustList' ||
      key === 'damageList' ||
      key === 'transferList' ||
      key === 'receiptList' ||
      key === 'purchaseList' ||
      key === 'purchaseReturnList'
    ) {
      setEf('listFrom', weekAgo)
      setEf('listTo', today)
    }
    if (key === 'movementReport') {
      setEf('mrFrom', today)
      setEf('mrTo', today)
      setMrSelectedGroups(new Set())
    }
    if (key === 'advanceViewer' || key === 'creditReceiptList' || key === 'messBillViewer') {
      setEf('vFrom', today)
      setEf('vTo', today)
    }
    if (key === 'osBalanceList') {
      setEf('obMode', 'all')
      setEf('obFrom', isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
      setEf('obTo', today)
    }

    const reportKeys: EntryKey[] = [
      'areaWiseReportRP', 'groupWiseRP', 'itemWiseRP', 'itemVoidReportRP',
      'cancelBillDetails', 'cancelBillSummary', 'counterCloseReportsRP',
      'salesBillWiseRP', 'dayWiseRP', 'pendingOrderList', 'counterWiseA4',
      'counterWiseTimewise', 'itemwiseSummary', 'itemwiseDetails', 'areawiseA4',
      'waiterwise', 'salesmanWise', 'customerAnalysisDetailed', 'customerAnalysisSummary',
      'counterCloseDetailsA4', 'incomeExpense', 'productionReport', 'itemVoidA4',
      'graphReport', 'itemwiseViewer', 'delBoyCommission', 'productMovementFast', 'productMovementSlow',
    ]
    if (reportKeys.includes(key)) {
      setEf('rFrom', today)
      setEf('rTo', today)
      setEf('rMode', 'date')
      setEf('rDetailMode', 'detailed')
      if (key === 'productMovementFast' || key === 'productMovementSlow') {
        setEf('rFrom', isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
        setEf('rMin', '0')
      }
    }
    if (key === 'billReprint') {
      setTxnSelected(null)
    }
    if (key === 'dayCloseReport') {
      setEf('rFrom', today)
      setEf('rTo', today)
    }
    if (key === 'incomeExpenseEntry') {
      setEf('ieDate', today)
      setEf('ieTaxRate', '5.00')
      setEf('iePayType', 'CASH')
      setEf('ieType', 'INCOME')
    }
    if (key === 'discountEntry') {
      setEf('discFrom', today)
      setEf('discTo', today)
    }
    if (key === 'changeSettlement') {
      setEf('csDate', today)
    }
    if (key === 'eventLogs') {
      setEf('elFrom', today)
      setEf('elTo', today)
      setEf('elAction', 'ALL')
      setEf('elSource', 'ALL')
      setEf('elStatus', 'ALL')
    }
    if (key === 'changeDiscountPercent') {
      setEf('cdpTotal', '0.00')
      setEf('cdpAmount', '0.00')
      setEf('cdpPercent', '0.00')
    }
    if (key === 'controlPanel') {
      setControlPanelTab('Company Details')
      setEf('cpHeading2', 'Khalifa st. beside Mediclinic,Abu Dhabi , UAE')
      setEf('cpHeading3', 'Ph: 024441125, Mob : 0503071522')
      setEf('cpTaxRegNo', '100233883600003')
      setEf('cpFooter1', 'Thank You...Visit Again')
    }
    if (key === 'privilegeSetup') {
      setEf('privUser', 'ADMIN')
    }
    if (key === 'userList' || key === 'activateAccessCard') {
      setUserListSelected(userListRows[0]?.code ?? null)
    }
    if (key === 'vatCorrectionUtility') {
      setEf('vcFrom', today)
      setEf('vcTo', today)
    }
    if (key === 'printerSetup' || key === 'langSetup') {
      setTxnDraft({})
    }
    if (key === 'cashInOut') {
      setCashMode('pick')
      setCashRows([])
    }
  }

  async function saveAreaEntry() {
    if (!ef('areaName').trim()) {
      toast('Enter an Area Name')
      return
    }
    setEntrySaving(true)
    try {
      await apiService.createArea({
        areaName: ef('areaName').trim(),
        areaNameArabic: ef('areaNameArabic').trim(),
        supplyType: ef('supplyType'),
        kotPrefix: ef('prefix').trim(),
        priceType: ef('priceType'),
        tableCreationType: ef('tableCreationType') === 'automatic' ? 1 : 0,
        showOnTablet: efBool('showOnTablet'),
      })
      toast('Area saved', 'success')
      void reloadAreas()
      setEntryForm({})
    } catch {
      toast('Could not save the area')
    } finally {
      setEntrySaving(false)
    }
  }

  async function saveTableEntry() {
    if (!ef('tableName').trim()) {
      toast('Enter a Table Name')
      return
    }
    const area = areas.find((a) => a.name === ef('areaName'))
    setEntrySaving(true)
    try {
      await apiService.createTable({
        areaId: area?.id,
        tableNo: Number(ef('tableNo')) || undefined,
        tableName: ef('tableName').trim(),
        tableNameArabic: ef('tableNameArabic').trim(),
        noOfChairs: Number(ef('noOfChairs')) || 0,
        waiterId: Number(ef('waiterId')) || undefined,
        tableFormat: ef('tableShape') || 'SQUARE',
      })
      toast('Table saved', 'success')
      void reloadTables()
      setEntryForm({})
    } catch {
      toast('Could not save the table')
    } finally {
      setEntrySaving(false)
    }
  }

  async function saveMainGroupEntry() {
    if (!ef('mgDescription').trim()) {
      toast('Enter a Description')
      return
    }
    setEntrySaving(true)
    try {
      await apiService.createGroup({
        groupCode: ef('mgCode').trim() || undefined,
        groupDescription: ef('mgDescription').trim(),
        groupDescriptionArabic: ef('mgDescriptionArabic').trim(),
        applyDiscount: efBool('mgApplyDiscount'),
      })
      toast('Main group saved', 'success')
      void reloadGroups()
      setEntryForm({})
    } catch {
      toast('Could not save the main group')
    } finally {
      setEntrySaving(false)
    }
  }

  /** Group Entry (sub-group) — tries the REST endpoint first; if the server
   * doesn't have it yet, keeps the row locally so the sidebar still reflects
   * it for this session instead of silently doing nothing. */
  async function saveGroupEntry() {
    if (!ef('grpName').trim()) {
      toast('Enter a Group Name')
      return
    }
    const master = groups.find((g) => g.name === ef('grpMaster'))
    if (!master) {
      toast('Pick a Master Group')
      return
    }
    setEntrySaving(true)
    try {
      const payload = {
        groupId: master.id,
        subGroupDescription: ef('grpName').trim(),
        subGroupDescriptionArabic: ef('grpNameArabic').trim(),
        showOnlyOnBackOffice: efBool('grpBackOfficeOnly'),
      }
      try {
        await apiService.createSubGroup(payload)
        toast('Group saved', 'success')
      } catch {
        setAllSubGroups((prev) => [
          ...prev,
          { id: -Date.now(), name: payload.subGroupDescription, groupId: master.id },
        ])
        toast('Server endpoint not available yet — kept locally for this session', 'info')
      }
      setEntryForm({})
    } finally {
      setEntrySaving(false)
    }
  }

  /** Sub Group Entry (sub-sub-group) — same optimistic-then-local fallback
   * as Group Entry above. */
  async function saveSubGroupEntry() {
    if (!ef('sgName').trim()) {
      toast('Enter a Sub Group Name')
      return
    }
    const master = allSubGroups.find((s) => s.name === ef('sgMaster'))
    if (!master) {
      toast('Pick a Group')
      return
    }
    setEntrySaving(true)
    try {
      const payload = {
        subGroupId: master.id,
        subSubGroupDescription: ef('sgName').trim(),
        subSubGroupDescriptionArabic: ef('sgNameArabic').trim(),
      }
      try {
        await apiService.createSubSubGroup(payload)
        toast('Sub group saved', 'success')
      } catch {
        setAllSubSubGroups((prev) => [
          ...prev,
          { id: -Date.now(), name: payload.subSubGroupDescription, subGroupId: master.id },
        ])
        toast('Server endpoint not available yet — kept locally for this session', 'info')
      }
      setEntryForm({})
    } finally {
      setEntrySaving(false)
    }
  }

  function saveKitchenMessage() {
    const msg = ef('kmMessage').trim()
    if (!msg) {
      toast('Enter a Kitchen Message')
      return
    }
    if (kitchenMsgSelected != null) {
      setKitchenMessages((prev) =>
        prev.map((m) => (m.id === kitchenMsgSelected ? { ...m, message: msg, arabic: ef('kmArabic').trim() } : m)),
      )
    } else {
      setKitchenMessages((prev) => [...prev, { id: Date.now(), message: msg, arabic: ef('kmArabic').trim() }])
    }
    toast('Kitchen message saved', 'success')
    setEntryForm({})
    setKitchenMsgSelected(null)
  }

  function deleteKitchenMessage() {
    if (kitchenMsgSelected == null) return
    setKitchenMessages((prev) => prev.filter((m) => m.id !== kitchenMsgSelected))
    setKitchenMsgSelected(null)
    setEntryForm({})
  }

  function saveCombo() {
    if (!ef('comboName').trim()) {
      toast('Enter a Combo Name')
      return
    }
    if (comboGroups.length === 0) {
      toast('Add at least one Group')
      return
    }
    toast('Combo saved', 'success')
    setEntryForm({})
    setComboGroups([])
  }

  function addRecipeLine() {
    if (!recipeDraft.name.trim()) {
      toast('Enter a Product Name')
      return
    }
    setRecipeLines((prev) => [...prev, recipeDraft])
    setRecipeDraft({ code: '', name: '', packDetails: '', cost: '', packQty: '', qty: '', unit: recipeDraft.unit })
  }

  function recipeUnitCost() {
    return recipeLines.reduce((sum, l) => sum + (Number(l.cost) || 0) * (Number(l.qty) || 0), 0)
  }

  function saveRecipe() {
    if (recipeLines.length === 0) {
      toast('Add at least one ingredient line')
      return
    }
    toast('Recipe saved', 'success')
    setEntryForm({})
    setRecipeLines([])
  }

  function printBarcode() {
    if (!ef('barcodeProduct').trim()) {
      toast('Enter a Product')
      return
    }
    toast(`Sent ${ef('printCount') || '1'} label(s) to the printer`, 'success')
  }

  function saveNote() {
    const desc = ef('noteDescription').trim()
    if (!desc) {
      toast('Enter a note')
      return
    }
    const today = new Date().toLocaleDateString('en-GB')
    if (notesSelected != null) {
      setNotesList((prev) => prev.map((n) => (n.id === notesSelected ? { ...n, description: desc } : n)))
    } else {
      setNotesList((prev) => [{ id: Date.now(), date: today, description: desc }, ...prev])
    }
    toast('Note saved', 'success')
  }

  function deleteNote(id: number) {
    setNotesList((prev) => prev.filter((n) => n.id !== id))
    if (notesSelected === id) {
      setNotesSelected(null)
      setEf('noteDescription', '')
    }
    toast('Note deleted', 'success')
  }

  function saveOnlineSource() {
    if (!ef('sourceName').trim()) {
      toast('Enter a Source Name')
      return
    }
    toast('Online source saved', 'success')
    setEntryForm({})
  }

  function savePaymentMode() {
    const name = ef('pmName').trim()
    if (!name) {
      toast('Enter a Payment Mode Name')
      return
    }
    setPaymentModes((prev) => {
      const existing = prev.find((p) => p.name.toUpperCase() === name.toUpperCase())
      if (existing) return prev.map((p) => (p === existing ? { ...p, status: ef('status') } : p))
      return [...prev, { name, status: ef('status') || 'ACTIVE' }]
    })
    toast('Payment mode saved', 'success')
    setEf('pmName', '')
  }

  function addMessLine() {
    const item = ef('messAddLine').trim()
    if (!item) return
    setMessLines((prev) => (prev.includes(item) ? prev : [...prev, item]))
    setEf('messAddLine', '')
  }

  function saveMessMaster() {
    if (!ef('messName').trim()) {
      toast('Enter a Mess Name')
      return
    }
    toast('Mess saved', 'success')
    setEntryForm({})
    setMessLines([])
  }

  function saveAddOn() {
    if (!ef('addOnName').trim()) {
      toast('Enter an Add-on Name')
      return
    }
    setAddOns((prev) => [
      ...prev,
      { name: ef('addOnName').trim(), arabic: ef('addOnArabic').trim(), priceNoVat: ef('addOnPrice'), vatPct: ef('addOnVat') },
    ])
    toast('Add-on saved', 'success')
    setEntryForm({})
  }

  function confirmBooking() {
    if (!ef('bookCustomer').trim()) {
      toast('Enter a Customer name')
      return
    }
    setBookings((prev) => [
      {
        id: Date.now(),
        area: bookingAreaTab,
        customer: ef('bookCustomer').trim(),
        mobile: ef('bookMobile').trim(),
        partySize: ef('bookPartySize'),
        advance: ef('bookAdvance'),
        date: ef('bookingDate'),
      },
      ...prev,
    ])
    toast('Booking confirmed', 'success')
    closeEntryModal()
  }

  async function loadFloorDesign() {
    if (floorAreaId == null) return
    setFloorBusy(true)
    try {
      await apiService.fetchFloorDesign(floorAreaId)
      toast('Floor design loaded', 'success')
    } catch {
      toast('No saved floor design for this area yet', 'info')
    } finally {
      setFloorBusy(false)
    }
  }

  async function saveFloorDesignEntry() {
    if (floorAreaId == null) {
      toast('Pick an Area')
      return
    }
    setFloorBusy(true)
    try {
      await apiService.saveFloorDesign(floorAreaId, {})
      toast('Floor design saved', 'success')
    } catch {
      toast('Could not save the floor design')
    } finally {
      setFloorBusy(false)
    }
  }

  // ── Transactions master-entry modals (Stock/Production/Purchase/Damage) ──

  function td(key: string): string {
    return txnDraft[key] ?? ''
  }
  function setTd(key: string, value: string) {
    setTxnDraft((d) => ({ ...d, [key]: value }))
  }

  /** Same English→Arabic auto-fill as setEfWithArabicAutoFill, but for the
   * txnDraft bag (Lang Setup's add-row uses td/setTd, not ef/setEf). */
  function setTdWithArabicAutoFill(englishKey: string, arabicKey: string, value: string) {
    setTd(englishKey, value)
    if (arabicAutoTimers.current[arabicKey]) clearTimeout(arabicAutoTimers.current[arabicKey])
    const trimmed = value.trim()
    if (!trimmed) return
    arabicAutoTimers.current[arabicKey] = setTimeout(() => {
      translateToArabic(trimmed)
        .then((translated) => {
          if (!translated) return
          setTxnDraft((prev) => {
            const current = prev[arabicKey] ?? ''
            if (current && current !== arabicAutoLast.current[arabicKey]) return prev
            arabicAutoLast.current[arabicKey] = translated
            return { ...prev, [arabicKey]: translated }
          })
        })
        .catch(notifyTranslateDown)
    }, 400)
  }

  function addTxnLine() {
    if (!td('barcode').trim() && !td('shortDesc').trim()) {
      toast('Enter a Barcode or Short Description')
      return
    }
    setTxnLines((prev) => [...prev, { ...txnDraft }])
    setTxnDraft({})
  }

  function deleteSelectedTxnLine() {
    if (txnSelected == null) {
      toast('Select a row first')
      return
    }
    setTxnLines((prev) => prev.filter((_, i) => i !== txnSelected))
    setTxnSelected(null)
  }

  function txnLineTotal(l: Record<string, string>) {
    return (Number(l.qty) || 0) * (Number(l.unitPrice || l.sellingPrice) || 0)
  }

  function txnGrandTotal() {
    return txnLines.reduce((sum, l) => sum + txnLineTotal(l), 0)
  }

  function saveTxn(label: string) {
    if (txnLines.length === 0) {
      toast('Add at least one line')
      return
    }
    toast(`${label} saved`, 'success')
    setEntryForm({})
    setTxnLines([])
    setTxnDraft({})
    setTxnSelected(null)
  }

  function printTxn() {
    if (txnLines.length === 0) {
      toast('Add at least one line before printing')
      return
    }
    toast('Sent to printer', 'success')
  }

  function postTxn() {
    if (txnLines.length === 0) {
      toast('Add at least one line before posting')
      return
    }
    toast('Posted', 'success')
  }

  function searchTxnList() {
    toast('No records found for this range', 'info')
  }

  function selectTxnRow() {
    toast('No row selected')
  }

  function saveAdvancePayment() {
    if (!ef('apCustomer').trim()) {
      toast('Enter a Customer')
      return
    }
    if (!(Number(ef('apAmount')) > 0)) {
      toast('Enter an Advance Amount')
      return
    }
    toast('Advance payment saved', 'success')
    setEntryForm({})
  }

  function displayCreditList() {
    toast('No records found for this range', 'info')
  }

  function printReport() {
    toast('Sent to printer', 'success')
  }

  function applyDiscountRange() {
    if (!(Number(ef('discPercent')) > 0)) {
      toast('Enter a Discount Percentage')
      return
    }
    toast(`Discount applied ${ef('discFrom')} to ${ef('discTo')}`, 'success')
  }

  function removeSelectedDiscount() {
    toast('Pick a discount row first')
  }

  function setupVat() {
    toast('VAT setup — coming soon', 'info')
  }

  function applyDiscountPercentPreset(pct: number) {
    const total = Number(ef('cdpTotal')) || 0
    setEf('cdpPercent', pct.toFixed(2))
    setEf('cdpAmount', (total * (pct / 100)).toFixed(2))
  }

  function saveDiscountPercent() {
    toast('Discount percentage saved', 'success')
    closeEntryModal()
  }

  function searchEventLogs() {
    toast('No log entries found for this range', 'info')
  }

  // ── Settings ────────────────────────────────────────────────────────────

  function addPrinterRow() {
    if (!td('counterNo').trim()) {
      toast('Enter a Counter No')
      return
    }
    setPrinterRows((prev) => [...prev, { counterNo: td('counterNo'), kitchenLoc: td('kitchenLoc'), printerName: td('printerName') }])
    setTxnDraft({})
  }

  function deleteSelectedUser() {
    if (!userListSelected) {
      toast('Select a user first')
      return
    }
    setUserListRows((prev) => prev.filter((u) => u.code !== userListSelected))
    setUserListSelected(null)
  }

  function activateSelectedCard() {
    if (!userListSelected) {
      toast('Select an ADMIN / CHIEF CASHIER first')
      return
    }
    setUserListRows((prev) => prev.map((u) => (u.code === userListSelected ? { ...u, card: 'Active' } : u)))
    toast('Tap the access card now', 'info')
  }

  function clearAccessCard() {
    if (!userListSelected) {
      toast('Select a user first')
      return
    }
    setUserListRows((prev) => prev.map((u) => (u.code === userListSelected ? { ...u, card: 'Not Set' } : u)))
    toast('Card cleared', 'success')
  }

  function togglePrivilege(name: string) {
    setPrivilegeChecks((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function savePrivileges() {
    toast('Privileges saved', 'success')
  }

  function addLangRow() {
    if (!td('enText').trim()) {
      toast('Enter an English Description')
      return
    }
    setLangRows((prev) => [...prev, { en: td('enText'), ar: td('arText') }])
    setTxnDraft({})
  }

  function saveControlPanel() {
    toast('Settings saved', 'success')
  }

  function savePassword() {
    if (!ef('pcLogin').trim()) {
      toast('Enter a Login Name')
      return
    }
    if (!ef('pcNewPassword').trim() || ef('pcNewPassword') !== ef('pcConfirmPassword')) {
      toast('New Password and Confirm Password must match')
      return
    }
    toast('Password changed', 'success')
    closeEntryModal()
  }

  function saveMultiSupplierSetup() {
    toast('Multi supplier setup saved', 'success')
    closeEntryModal()
  }

  function deliveryZeroClear() {
    toast('Delivery zero clear — coming soon', 'info')
  }

  function salesVariationCorrection() {
    toast('Sales variation correction — coming soon', 'info')
  }

  // ── Cash In / Cash Out ─────────────────────────────────────────────────

  async function loadCashRows(mode: 'in' | 'out') {
    try {
      const rows = await apiService.fetchCashInOut()
      const wantType = mode === 'in' ? 'CASH_IN' : 'CASH_OUT'
      setCashRows(
        rows
          .filter((r) => String(r.transactionType ?? r.TransactionType ?? '').toUpperCase() === wantType)
          .map((r) => ({
            desc: String(r.remarks ?? r.Remarks ?? '').trim(),
            amount: Number(r.amount ?? r.Amount) || 0,
          })),
      )
    } catch {
      setCashRows([])
    }
  }

  function openCashMode(mode: 'in' | 'out') {
    setCashMode(mode)
    setEf('cashDesc', '')
    setEf('cashAmount', '')
    void loadCashRows(mode)
  }

  function onCashKey(k: string) {
    if (k === 'C') {
      setEf('cashAmount', ef('cashAmount').slice(0, -1))
      return
    }
    if (k === '.' && ef('cashAmount').includes('.')) return
    setEf('cashAmount', (ef('cashAmount') + k).slice(0, 10))
  }

  async function addCashMovement() {
    if (cashMode === 'pick') return
    const amt = Number(ef('cashAmount'))
    if (!(amt > 0)) {
      toast('Enter an Amount')
      return
    }
    if (!ef('cashDesc').trim()) {
      toast('Enter a Description')
      return
    }
    try {
      await apiService.addCashInOut({
        transactionType: cashMode === 'in' ? 'CASH_IN' : 'CASH_OUT',
        amount: amt,
        remarks: ef('cashDesc').trim(),
      })
      toast(`Cash ${cashMode === 'in' ? 'In' : 'Out'} saved`, 'success')
      setEf('cashDesc', '')
      setEf('cashAmount', '')
      void loadCashRows(cashMode)
    } catch {
      toast('Could not save the cash entry')
    }
  }

  async function loadGroupOptions(kind: 'group' | 'subgroup') {
    setGroupOptionsLoading(kind)
    try {
      if (kind === 'group') {
        const rows = await apiService.fetchGroups()
        setGroupOptions(
          rows
            .map((g) => ({
              id: num(g.groupId ?? g.GroupID),
              name: String(g.groupDescription ?? g.GroupDescription ?? g.groupName ?? '').trim(),
              code: String(g.groupCode ?? g.GroupCode ?? '').trim(),
            }))
            .filter((g) => g.id > 0 && g.name),
        )
      } else {
        const rows = await apiService.fetchSubGroups({ groupId: productForm.groupId || undefined })
        setSubgroupOptions(
          rows
            .map((sg) => ({
              id: num(sg.subGroupId ?? sg.SubGroupID),
              name: String(sg.subGroupDescription ?? sg.SubGroupDescription ?? '').trim(),
              code: String(sg.subGroupCode ?? sg.SubGroupCode ?? '').trim(),
            }))
            .filter((sg) => sg.id > 0 && sg.name),
        )
      }
    } catch {
      if (kind === 'group') setGroupOptions([])
      else setSubgroupOptions([])
    } finally {
      setGroupOptionsLoading(null)
    }
  }

  function withVat(base: string, vatPct: string): string {
    const b = Number(base)
    const v = Number(vatPct)
    if (!Number.isFinite(b) || b <= 0) return '0.00'
    return money(b * (1 + (Number.isFinite(v) ? v : 0) / 100))
  }

  async function saveProductForm() {
    if (!productForm.description.trim()) {
      toast('Enter a Description')
      return
    }
    if (!productForm.groupId) {
      toast('Pick a Group')
      return
    }
    if (!(Number(productForm.unitPrice) > 0)) {
      toast('Enter a Unit Price')
      return
    }
    setProductSaving(true)
    try {
      const payload = {
        productCode: productForm.code.trim() || undefined,
        productName: productForm.description.trim(),
        arabicName: productForm.arabicDescription.trim(),
        groupId: productForm.groupId,
        subgroupId: productForm.subgroupId || undefined,
        kitchenLocation: productForm.kitchenLocation.trim(),
        kotPriority: productForm.kotPriority,
        unitCost: Number(productForm.unitCost) || 0,
        tax1Rate: Number(productForm.vatIn) || 0,
        unitPrice: Number(productForm.unitPrice) || 0,
        outputTax1Rate: Number(productForm.vatOut) || 0,
        packQty: Number(productForm.packQty) || 1,
        unit: productForm.unit,
        productType: productForm.productType,
        description: productForm.itemDescription.trim(),
      }
      if (productForm.id > 0) {
        await apiService.updateProduct(productForm.id, payload)
      } else {
        await apiService.createProduct(payload)
      }
      toast('Item saved', 'success')
      setProductOpen(false)
      void reloadProducts()
    } catch {
      toast('Could not save the item')
    } finally {
      setProductSaving(false)
    }
  }

  function toggleSubPath(path: string) {
    setExpandedSubPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  /** Opens whatever a side-menu leaf points at. Shared by the menu itself
   * and the side-menu global search, so both behave identically. */
  function onNavPick(label: string, path: string) {
    if (label === 'Product Entry') {
      openNewProductModal()
      setSideNavHidden(true)
      return
    }
    if (label === 'Credit payment Receipt') {
      setReceiptOpen(true)
      void loadReceiptCustomers('')
      setSideNavHidden(true)
      return
    }
    if (label === 'Counter Close') {
      setCounterCloseOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Sales Viewer') {
      setSalesViewerOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'CounterClose -Admin') {
      setCounterCloseOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Cashier Chgange') {
      setConfirmAlert({
        title: 'Change Cashier',
        message: 'Take the counter reading before changing the cashier.',
        mode: 'ok',
        confirmLabel: 'Got it',
      })
      setSideNavHidden(true)
      return
    }
    if (label === 'Clear KOT') {
      setConfirmAlert({
        title: 'Clear all KOTs?',
        message: 'Every open KOT will be cancelled. This action cannot be undone.',
        mode: 'yesno',
        tone: 'danger',
        confirmLabel: 'Clear KOTs',
        onYes: () => toast('All KOTs cancelled', 'success'),
      })
      setSideNavHidden(true)
      return
    }
    if (label === 'ShutDown') {
      setConfirmAlert({
        title: 'Shut down the system?',
        message: 'The POS will close. Make sure all open bills are settled first.',
        mode: 'yesno',
        tone: 'danger',
        confirmLabel: 'Shut Down',
        onYes: () => toast('Shutdown — not wired up in this build', 'info'),
      })
      setSideNavHidden(true)
      return
    }
    if (label === 'KDS Refresh') {
      toast('KDS refreshed', 'success')
      setSideNavHidden(true)
      return
    }
    if (label === 'Disable VAT') {
      setConfirmAlert({
        title: 'Disable VAT?',
        message: 'VAT will no longer be applied to new bills.',
        mode: 'yesno',
        confirmLabel: 'Disable VAT',
        onYes: () => toast('VAT disabled', 'success'),
      })
      setSideNavHidden(true)
      return
    }
    const ambiguous = AMBIGUOUS_LABELS.has(label)
      ? AMBIGUOUS_LABEL_ROUTES.find((r) => r.label === label && path.includes(r.pathIncludes))
      : undefined
    const entryKey = ambiguous?.key ?? LABEL_TO_ENTRY[label]
    if (entryKey) {
      openEntryModal(entryKey)
      return
    }
    toast(`${label} — coming soon`, 'info')
  }

  /** Everything the side-menu search can find: every menu screen (with its
   * menu path), the main quick actions, products, categories and areas. */
  function buildSearchItems(): GlobalSearchItem[] {
    const items: GlobalSearchItem[] = []

    const walk = (entries: readonly NavMenuEntry[], path: string, trail: string[], icon: GlobalSearchItem['icon']) => {
      for (const entry of entries) {
        const label = typeof entry === 'string' ? entry : entry.label
        const itemPath = `${path}/${label}`
        if (typeof entry !== 'string' && 'children' in entry) {
          walk(entry.children, itemPath, [...trail, label], icon)
          continue
        }
        items.push({
          id: `menu:${itemPath}`,
          group: 'Menu',
          label,
          hint: trail.join(' › '),
          icon,
          onSelect: () => onNavPick(label, itemPath),
        })
      }
    }
    for (const top of NAV) {
      const menu = NAV_MENUS[top]
      if (menu) walk(menu, top, [top], NAV_ICON[top])
    }

    const actions: [string, GlobalSearchItem['icon'], () => void, string?][] = [
      ['Area Change', MapPinned, () => setAreaOpen(true), 'table dine in takeaway delivery'],
      ['Receipt', Receipt, () => {
        setReceiptOpen(true)
        void loadReceiptCustomers('')
      }, 'credit payment'],
      ['Order List', ClipboardList, onOrderListClick, 'kot open orders'],
      ['Select Customer', Users, () => {
        setCustomerOpen(true)
        void loadCustomers()
      }, 'customer client guest'],
      ['Add New Item', Plus, openNewProductModal, 'product create'],
    ]
    for (const [label, icon, run, keywords] of actions) {
      items.push({ id: `action:${label}`, group: 'Actions', label, icon, keywords, onSelect: run })
    }

    const groupName = new Map(groups.map((g) => [g.id, g.name]))
    for (const p of allProducts) {
      items.push({
        id: `product:${p.id}`,
        group: 'Products',
        label: p.name,
        hint: [`AED ${money(p.price)}`, groupName.get(p.groupId)].filter(Boolean).join(' · '),
        keywords: p.sub,
        icon: Package,
        onSelect: () => onItemClick(p),
      })
    }

    for (const g of groups) {
      items.push({
        id: `group:${g.id}`,
        group: 'Categories',
        label: g.name,
        hint: 'Show items',
        icon: categoryIcon(g.name),
        onSelect: () => {
          setQuery('')
          onGroupClick(g.id)
        },
      })
    }

    for (const a of areas) {
      items.push({
        id: `area:${a.id}`,
        group: 'Areas',
        label: a.name,
        hint: a.supplyType || undefined,
        icon: MapPinned,
        onSelect: () => areaButtonClick(a),
      })
    }

    return items
  }

  /** One sidebar nav item — icon + label, expanding its submenu inline
   * (indented underneath, accordion-style) rather than a flyout. */
  function renderNavItem(item: (typeof NAV)[number]) {
    const menu = NAV_MENUS[item]
    const ItemIcon = NAV_ICON[item]
    const isOpen = openNavMenu === item
    const button = (
      <button
        type="button"
        className={`pd-side-nav-btn${item === nav ? ' is-active' : ''}${isOpen && item !== nav ? ' is-open' : ''}`}
        onClick={() => {
          if (menu) setOpenNavMenu((open) => (open === item ? null : item))
          setNav(item)
        }}
      >
        <ItemIcon size={18} strokeWidth={2} />
        <span>{item}</span>
        {menu ? <ChevronRight size={13} className={`pd-side-nav-arrow${isOpen ? ' is-open' : ''}`} /> : null}
      </button>
    )
    if (!menu) {
      return (
        <div key={item} className="pd-side-nav-wrap">
          {button}
        </div>
      )
    }
    return (
      <div key={item} className="pd-side-nav-wrap">
        {button}
        {isOpen ? (
          <div className="pd-subnav">
            <NavMenuInline
              entries={menu}
              path={item}
              depth={0}
              expanded={expandedSubPaths}
              onToggle={toggleSubPath}
              onPick={onNavPick}
            />
          </div>
        ) : null}
      </div>
    )
  }

  /** Shared barcode-add-row + running grid + remarks + total, reused as-is
   * by Product Request / Product Receipt / Product Transfer — the three
   * screens only differ in the header fields rendered above this block. */
  function renderTxnItemBlock() {
    return (
      <>
        <div className="pd-recipe-line-row">
          <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
          <input placeholder="Short Description" value={td('shortDesc')} onChange={(e) => setTd('shortDesc', e.target.value)} />
          <input placeholder="Qty" value={td('qty')} onChange={(e) => setTd('qty', e.target.value.replace(/[^\d.]/g, ''))} />
          <input placeholder="Unit Cost" value={td('unitCost')} onChange={(e) => setTd('unitCost', e.target.value.replace(/[^\d.]/g, ''))} />
          <input placeholder="Unit Price" value={td('unitPrice')} onChange={(e) => setTd('unitPrice', e.target.value.replace(/[^\d.]/g, ''))} />
          <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
            Add
          </button>
        </div>
        <div className="pd-grid-wrap">
          <table className="pd-grid">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Short Description</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {txnLines.length === 0 ? (
                <tr>
                  <td colSpan={6}>No lines added</td>
                </tr>
              ) : (
                txnLines.map((l, i) => (
                  <tr
                    key={i}
                    className={txnSelected === i ? 'is-selected' : undefined}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setTxnSelected(i)}
                  >
                    <td>{l.barcode}</td>
                    <td>{l.shortDesc}</td>
                    <td>{l.qty}</td>
                    <td>{l.unitCost}</td>
                    <td>{l.unitPrice}</td>
                    <td>AED {money(txnLineTotal(l))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="pd-form-row">
          <label>Remarks</label>
          <textarea rows={2} value={ef('txnRemarks')} onChange={(e) => setEf('txnRemarks', e.target.value)} />
        </div>
        <div className="pd-form-row">
          <label>Total Amount</label>
          <div className="pd-form-computed">AED {money(txnGrandTotal())}</div>
        </div>
      </>
    )
  }

  /** Shared From/To + Display header + empty-state grid, reused as-is by
   * Advance Viewer / ReceiptList / Mess Bill Viewer — all three are report
   * viewers with the same shape and only differ in their grid columns. */
  function renderDisplayListBody(columns: string[]) {
    return (
      <>
        <div className="pd-txn-search-row">
          <div className="pd-form-row">
            <label>From</label>
            <DatePicker value={ef('vFrom')} onChange={(v) => setEf('vFrom', v)} max={ef('vTo')} />
          </div>
          <div className="pd-form-row">
            <label>To</label>
            <DatePicker value={ef('vTo')} onChange={(v) => setEf('vTo', v)} min={ef('vFrom')} />
          </div>
          <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={displayCreditList}>
            Display
          </button>
        </div>
        <div className="pd-grid-wrap">
          <table className="pd-grid">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={columns.length}>No records found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    )
  }

  /** Footer buttons for the generic "Creation" master-entry modal — varies
   * per screen (New/Save/Close, Save/Close, Confirm/Close, etc.) to match
   * what each legacy screen actually offered. */
  function renderEntryFooter() {
    if (!entryModal) return null
    switch (entryModal) {
      case 'area':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveAreaEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'table':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveTableEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'mainGroup':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveMainGroupEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'group':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveGroupEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'subGroup':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveSubGroupEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'kitchenMessage':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" disabled={kitchenMsgSelected == null} onClick={deleteKitchenMessage}>
              Delete
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveKitchenMessage}>
              Save
            </button>
          </>
        )
      case 'combo':
        return (
          <>
            <button
              type="button"
              className="pd-mod-foot-btn"
              disabled={comboGroups.length === 0}
              onClick={() => {
                setComboGroups([])
                setComboGroupInput('')
              }}
            >
              Remove from list
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveCombo}>
              Save
            </button>
          </>
        )
      case 'recipe':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveRecipe}>
              Save
            </button>
          </>
        )
      case 'barcode':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={printBarcode}>
              Print
            </button>
          </>
        )
      case 'notes':
        return null
      case 'onlineSource':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveOnlineSource}>
              Save
            </button>
          </div>
        )
      case 'paymentMode':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={savePaymentMode}>
              Save
            </button>
          </div>
        )
      case 'messMaster':
        return (
          <>
            <button
              type="button"
              className="pd-mod-foot-btn"
              disabled={messLines.length === 0}
              onClick={() => {
                setMessLines([])
                setEf('messAddLine', '')
              }}
            >
              Remove from list
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveMessMaster}>
              Save
            </button>
          </>
        )
      case 'addOn':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => setEntryForm({})}>
              Add New
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveAddOn}>
              Save
            </button>
          </>
        )
      case 'booking':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={confirmBooking}>
              Confirm
            </button>
          </>
        )
      case 'bookingList':
        return null
      case 'floorDesign':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={floorBusy} onClick={() => void saveFloorDesignEntry()}>
              {floorBusy ? 'Saving…' : 'Save'}
            </button>
          </>
        )
      case 'stockAdjustment':
      case 'openingStock':
      case 'damageEntry':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={deleteSelectedTxnLine}>
              Delete Raw
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn(ENTRY_META[entryModal].label)}>
              Save
            </button>
          </>
        )
      case 'productionEntry':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn('Production Entry')}>
              Save
            </button>
          </>
        )
      case 'stockReport':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Report shown below (mock data)', 'success')}>
              Show Report
            </button>
          </>
        )
      case 'movementReport':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Report shown below (mock data)', 'success')}>
              Show
            </button>
          </>
        )
      case 'productRequest':
      case 'productReceipt':
      case 'productTransfer':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={printTxn}>
              Print
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn(ENTRY_META[entryModal].label)}>
              Save
            </button>
          </>
        )
      case 'stockAdjustList':
      case 'transferList':
      case 'receiptList':
      case 'damageList':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={selectTxnRow}>
              Select
            </button>
          </>
        )
      case 'supplierList':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Pick a supplier row first')}>
              Delete
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Add supplier — coming soon', 'info')}>
              New
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={selectTxnRow}>
              Select
            </button>
          </>
        )
      case 'purchaseEntry':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Switched to Edit mode', 'info')}>
              EDIT
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={postTxn}>
              Post
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Posted to temp account', 'info')}>
              Acc Post Temp
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={printTxn}>
              Print
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn('Purchase Entry')}>
              Save
            </button>
          </>
        )
      case 'purchaseReturn':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={postTxn}>
              Post
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Posted to temp account', 'info')}>
              Acc Post Temp
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={printTxn}>
              Print
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn('Purchase Return')}>
              Save
            </button>
          </>
        )
      case 'purchaseList':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Pick a purchase row first')}>
              Delete
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Opens a blank Purchase Entry — use the side menu', 'info')}>
              New
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={selectTxnRow}>
              Select
            </button>
          </>
        )
      case 'purchaseReturnList':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Pick a return row first')}>
              Delete
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={selectTxnRow}>
              Select
            </button>
          </>
        )
      case 'advancePayment':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-close" onClick={closeEntryModal}>
              Cancel
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveAdvancePayment}>
              Save
            </button>
          </>
        )
      case 'paymentList':
      case 'osBalanceList':
      case 'advanceViewer':
      case 'creditReceiptList':
      case 'messBillViewer':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
              Print
            </button>
            <span className="pd-mod-foot-spacer" />
          </>
        )
      case 'billReprint':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
              1 Print
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Other Bill — coming soon', 'info')}>
              2 Other Bill
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('KOT Print — coming soon', 'info')}>
              3 KOT Print
            </button>
          </>
        )
      case 'counterCloseReportsRP':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
              Print
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={selectTxnRow}>
              Select
            </button>
            <span className="pd-mod-foot-spacer" />
          </>
        )
      case 'delBoyCommission':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('All groups checked', 'success')}>
              Check All
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
              Print
            </button>
          </>
        )
      case 'areawiseA4':
      case 'waiterwise':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Report shown below (mock data)', 'success')}>
              Show
            </button>
            <span className="pd-mod-foot-spacer" />
          </>
        )
      case 'areaWiseReportRP':
      case 'groupWiseRP':
      case 'itemWiseRP':
      case 'itemVoidReportRP':
      case 'cancelBillDetails':
      case 'cancelBillSummary':
      case 'salesBillWiseRP':
      case 'dayWiseRP':
      case 'pendingOrderList':
      case 'counterWiseA4':
      case 'counterWiseTimewise':
      case 'itemwiseSummary':
      case 'itemwiseDetails':
      case 'salesmanWise':
      case 'customerAnalysisDetailed':
      case 'customerAnalysisSummary':
      case 'counterCloseDetailsA4':
      case 'incomeExpense':
      case 'productionReport':
      case 'itemVoidA4':
      case 'graphReport':
      case 'itemwiseViewer':
      case 'productMovementFast':
      case 'productMovementSlow':
      case 'dayCloseReport':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
              Print
            </button>
            <span className="pd-mod-foot-spacer" />
          </>
        )
      case 'incomeExpenseEntry':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={deleteSelectedTxnLine}>
              Delete Raw
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn('Income/Expense entry')}>
              Save
            </button>
          </>
        )
      case 'discountEntry':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={deleteSelectedTxnLine}>
              Delete Raw
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn('Discount')}>
              Save
            </button>
          </>
        )
      case 'discountList':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={removeSelectedDiscount}>
              Remove Discount
            </button>
            <span className="pd-mod-foot-spacer" />
          </>
        )
      case 'changeSettlement':
        return null
      case 'vatActivation':
        return null
      case 'productListEdit':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={selectTxnRow}>
              Select
            </button>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn('Product list')}>
              Save
            </button>
          </>
        )
      case 'changeDiscountPercent':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-close" onClick={closeEntryModal}>
              Cancel
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveDiscountPercent}>
              Save
            </button>
          </>
        )
      case 'eventLogs':
        return null
      case 'printerSetup':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Printer setup saved', 'success')}>
              Save
            </button>
          </>
        )
      case 'userList':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={deleteSelectedUser}>
              Delete
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" onClick={closeEntryModal}>
              Select
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Add user — coming soon', 'info')}>
              New
            </button>
          </>
        )
      case 'activateAccessCard':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={activateSelectedCard}>
              Activate
            </button>
            <button type="button" className="pd-mod-foot-btn is-close" onClick={clearAccessCard}>
              Clear Card
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Refreshed', 'success')}>
              Refresh
            </button>
            <span className="pd-mod-foot-spacer" />
          </>
        )
      case 'privilegeSetup':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={savePrivileges}>
              Save
            </button>
          </>
        )
      case 'controlPanel':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('More Settings — coming soon', 'info')}>
              More Settings
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveControlPanel}>
              Save
            </button>
          </>
        )
      case 'passwordChange':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={savePassword}>
              Save
            </button>
          </>
        )
      case 'langSetup':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Language settings saved', 'success')}>
              Save
            </button>
          </>
        )
      case 'partyOrderList':
        return null
      case 'multiSupplierSetup':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveMultiSupplierSetup}>
              Save
            </button>
          </>
        )
      case 'vatCorrectionUtility':
        return null
      case 'cashInOut':
        return cashMode === 'pick' ? (
          <button type="button" className="pd-mod-foot-btn is-close pd-cash-cancel" onClick={closeEntryModal}>
            Cancel
          </button>
        ) : (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void addCashMovement()}>
              Save
            </button>
          </>
        )
      default:
        return null
    }
  }

  const emptyHint =
    query.trim()
      ? 'No matching items'
      : topMoveActive
        ? topMoveLoading
          ? 'Loading top moving items…'
          : 'No top moving products found'
        : groupId == null
          ? 'Select a group'
          : 'No items in this category'

  return (
    <div className="pos-main">
      <header className="pd-header pd-header-slim">
        <button
          type="button"
          className="pd-nav-toggle"
          title={sideNavHidden ? 'Show menu' : 'Hide menu'}
          onClick={() => setSideNavHidden((v) => !v)}
        >
          {sideNavHidden ? <MenuIcon size={18} /> : <X size={18} />}
        </button>
        <div className="pd-logo">
          <img src="/logo-white.png" alt="Deyno" className="pd-logo-img" />
          <span>PRO</span>
        </div>
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

      <div className="pd-shell">
        {sideNavHidden ? null : (
          <>
            <div className="pd-side-nav-backdrop" onClick={() => setSideNavHidden(true)} />
            <nav className={`pd-side-nav${navSearching ? ' is-searching' : ''}`}>
              <GlobalSearch
                className="pd-side-search"
                inputRef={navSearchRef}
                items={buildSearchItems()}
                placeholder="Search"
                limits={{ Menu: 8, Products: 8 }}
                onQueryChange={(q) => setNavSearching(Boolean(q.trim()))}
                onPicked={() => {
                  setNavSearching(false)
                  setSideNavHidden(true)
                }}
              />
              {navSearching ? null : NAV.map((item) => renderNavItem(item))}
              {navSearching ? null : <div className="pd-side-spacer" aria-hidden />}
              {navSearching ? null : (
                <div className="pd-side-nav-wrap pd-side-logout-wrap">
                  <button
                    type="button"
                    className="pd-side-nav-btn pd-side-logout"
                    onClick={() => {
                      clearStaffSession()
                      navigate('/')
                    }}
                  >
                    <LogOut size={18} strokeWidth={2} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </nav>
          </>
        )}

      <div className="pd-main">
        <section className="pd-panel">
          <div className="pd-order-head">
            <h1>{currentKotId > 0 ? 'Open KOT' : 'Order'} #{kotLabel}</h1>
            <div className="pd-meta">
              <button
                type="button"
                className="pd-meta-btn is-table"
                title={`Table ${tableName || (tableId > 0 ? String(tableId) : '—')}${chairNo > 0 ? ` / CH ${chairNo}` : ''}`}
                onClick={() => {
                  if (currentArea) void areaClickToPopulationTable(currentArea)
                  else setAreaOpen(true)
                }}
              >
                <span className="pd-pill-icon"><TableGlyph size={10} /></span>
                <span className="pd-meta-text">
                  Table {tableName || (tableId > 0 ? String(tableId) : '—')}
                  {chairNo > 0 ? ` / CH ${chairNo}` : ''}
                </span>
                <ChevronDown size={11} className="pd-pill-chevron" />
              </button>
              <button
                type="button"
                className="pd-meta-btn is-covers"
                onClick={() => setCovers((n) => (n >= 12 ? 1 : n + 1))}
                title="Number of persons"
              >
                <span className="pd-pill-icon"><Users size={10} /></span>
                <span className="pd-meta-text">
                  {covers} {covers === 1 ? 'Cover' : 'Covers'}
                </span>
                <ChevronDown size={11} className="pd-pill-chevron" />
              </button>
              <button
                type="button"
                className="pd-meta-btn is-customer"
                title={customerName || 'Cash Customer'}
                onClick={() => {
                  setCustomerOpen(true)
                  void loadCustomers()
                }}
              >
                <span className="pd-pill-icon"><User size={10} /></span>
                <span className="pd-meta-text">{customerName || 'Cash Customer'}</span>
                <ChevronDown size={11} className="pd-pill-chevron" />
              </button>
            </div>
          </div>

          {selectedKeys.size > 0 ? (
            <div className="pd-select-bar">
              <span>{selectedKeys.size} selected</span>
              <button type="button" className="pd-select-bar-cancel" onClick={() => setSelectedKeys(new Set())}>
                Cancel
              </button>
              <button type="button" className="pd-select-bar-delete" onClick={deleteSelectedLines}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          ) : null}

          <div className="pd-grid-wrap" ref={gridWrapRef}>
            <table className="pd-grid">
              <thead>
                <tr>
                  <th className="col-no">
                    {selectedKeys.size > 0 ? (
                      <input
                        type="checkbox"
                        className="pd-row-check"
                        aria-label="Select all"
                        checked={lines.length > 0 && lines.every((l) => selectedKeys.has(l.key))}
                        onChange={() =>
                          setSelectedKeys((prev) =>
                            prev.size === lines.length ? new Set() : new Set(lines.map((l) => l.key)),
                          )
                        }
                      />
                    ) : (
                      '#'
                    )}
                  </th>
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
                    <td colSpan={8}>
                      <div className="pd-empty-state">
                        <img src="/logo-dark.png" alt="" className="pd-empty-logo" />
                      </div>
                    </td>
                  </tr>
                ) : (
                  lines.flatMap((line, i) => {
                    const row = (
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
                      <td
                        className="col-no"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleLineSelect(line.key)
                        }}
                      >
                        {selectedKeys.size > 0 ? (
                          <input
                            type="checkbox"
                            className="pd-row-check"
                            aria-label={`Select row ${i + 1}`}
                            checked={selectedKeys.has(line.key)}
                            onChange={() => toggleLineSelect(line.key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          i + 1
                        )}
                      </td>
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
                    )
                    if (!separatorAfterKeys.has(line.key)) return [row]
                    return [
                      row,
                      <tr key={`sep-${line.key}`} className="pd-line-sep" aria-hidden="true">
                        <td colSpan={8}>
                          <hr />
                        </td>
                      </tr>,
                    ]
                  })
                )}
              </tbody>
            </table>
          </div>

          {lines.length > 0 ? (
            <div className="pd-line-bar">
              <button
                type="button"
                className="pd-line-add"
                onClick={toggleSeparatorAfterSelected}
                title="Draw a line after the selected row"
              >
                <SeparatorHorizontal size={13} /> Add Line
              </button>
            </div>
          ) : null}

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
                  onClick={(e) => {
                    if (s.id !== 'DELIVERY') {
                      onServiceClick(s.id)
                      return
                    }
                    // Second click of a double-click — the dblclick handler takes over.
                    if (e.detail > 1) return
                    // Delivery's customer picker would cover this button and swallow
                    // the second click of a double-click, so open it after a short
                    // pause that a double-click cancels.
                    deliveryClick(undefined, false)
                    if (deliveryPickerTimer.current) clearTimeout(deliveryPickerTimer.current)
                    deliveryPickerTimer.current = setTimeout(() => {
                      deliveryPickerTimer.current = null
                      setCustomerOpen(true)
                      void loadCustomers()
                    }, 280)
                  }}
                  onDoubleClick={() => {
                    if (s.id === 'TAKEAWAY') openOrderListFor('TAKEAWAY')
                    if (s.id === 'DELIVERY') {
                      if (deliveryPickerTimer.current) clearTimeout(deliveryPickerTimer.current)
                      deliveryPickerTimer.current = null
                      openOrderListFor('DELIVERY')
                    }
                  }}
                  title={
                    s.id === 'TAKEAWAY'
                      ? 'Double-click for the Takeaway list'
                      : s.id === 'DELIVERY'
                        ? 'Double-click for the Delivery list'
                        : undefined
                  }
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
          <SearchBar
            ref={searchInputRef}
            size="sm"
            value={query}
            onValueChange={setQuery}
            placeholder="Search item / barcode"
          />
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
          <button
            type="button"
            className={`pd-cat pd-top-move${topMoveActive ? ' is-active' : ''}`}
            onClick={onTopMoveClick}
            disabled={topMoveLoading}
          >
            <Star size={13} strokeWidth={2} />
            <span className="pd-cat-label">{topMoveLoading ? 'Loading…' : 'Top Move'}</span>
          </button>
          <div
            ref={groupStripRef}
            className="pd-cats"
            onPointerDown={onGroupStripPointerDown}
            onPointerMove={onGroupStripPointerMove}
            onPointerUp={onGroupStripPointerUp}
            onPointerCancel={onGroupStripPointerUp}
          >
            {groups.map((g) => {
              const GroupIcon = categoryIcon(g.name)
              const isGroupOn = groupId === g.id
              return (
                <div key={g.id} className="pd-cat-branch">
                  <button
                    type="button"
                    className={`pd-cat${isGroupOn ? ' is-active' : ''}`}
                    onClick={() => onStripTap(() => onGroupClick(g.id))}
                  >
                    <GroupIcon size={13} strokeWidth={2} />
                    <span className="pd-cat-label">{g.name.toLowerCase()}</span>
                  </button>
                  {/* Subgroups expand indented under their group instead of
                     replacing the list with a new "screen". */}
                  {isGroupOn && groupSubs.length ? (
                    <div className="pd-subcat-list">
                      {groupSubs.map((s) => {
                        const SubIcon = categoryIcon(s.name)
                        const isSubOn = subGroupId === s.id
                        return (
                          <div key={s.id} className="pd-cat-branch">
                            <button
                              type="button"
                              className={`pd-cat is-sub${isSubOn ? ' is-active' : ''}`}
                              onClick={() => onStripTap(() => onSubGroupClick(s.id))}
                            >
                              <SubIcon size={12} strokeWidth={2} />
                              <span className="pd-cat-label">{s.name.toLowerCase()}</span>
                            </button>
                            {isSubOn && subSubs.length ? (
                              <div className="pd-subcat-list pd-subsubcat-list">
                                {subSubs.map((ss) => {
                                  const SubSubIcon = categoryIcon(ss.name)
                                  return (
                                    <button
                                      key={ss.id}
                                      type="button"
                                      className={`pd-cat is-sub${subSubGroupId === ss.id ? ' is-active' : ''}`}
                                      onClick={() => onStripTap(() => onSubSubClick(ss.id))}
                                    >
                                      <SubSubIcon size={11} strokeWidth={2} />
                                      <span className="pd-cat-label">{ss.name.toLowerCase()}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
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
                    <span className="pd-product-name">{p.name.toLowerCase()}</span>
                    {p.sub && p.sub !== p.name ? (
                      <span className="pd-product-sub">{p.sub.toLowerCase()}</span>
                    ) : null}
                    <span className="pd-product-foot">
                      <span className="pd-product-price">AED {money(p.price)}</span>
                    </span>
                  </button>
              ))}
              <button
                type="button"
                className="pd-product pd-product-add"
                onClick={openNewProductModal}
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
                    QTY{padQty !== '1' ? ` ${padQty}` : ''}
                  </button>
                </div>
                <NumberKeypad onKey={onKey} />
              </div>

              {/* Action tiles — 3 columns x 3 rows, in priority order:
                 Save KOT (wide) · Discount / Cancel Bill · No Sale · Order List /
                 Dummy Bill · More · Quick Cash. Everything else lives in More. */}
              <div className="pd-group-btns">
                <div className="pd-tiles">
                  <button
                    type="button"
                    className="pd-tile is-wide is-primary"
                    onClick={() => void onSaveKot()}
                    disabled={savingKot}
                  >
                    <Save className="pd-tile-ic" strokeWidth={2} />
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">{savingKot ? 'Saving…' : 'Save KOT'}</span>
                      <small>Create kitchen order</small>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                  <button type="button" className="pd-tile">
                    <Percent className="pd-tile-ic" strokeWidth={2} />
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">Discount</span>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                  <button type="button" className="pd-tile is-danger">
                    <Ban className="pd-tile-ic" strokeWidth={2} />
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">Cancel Bill</span>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                  <button type="button" className="pd-tile">
                    <CircleOff className="pd-tile-ic" strokeWidth={2} />
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">No Sale</span>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                  <button type="button" className="pd-tile" onClick={onOrderListClick}>
                    <ClipboardList className="pd-tile-ic" strokeWidth={2} />
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">Order List</span>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                  <button type="button" className="pd-tile">
                    <FileText className="pd-tile-ic" strokeWidth={2} />
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">Dummy Bill</span>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className={`pd-tile${moreActionsOpen && !moreClosing ? ' is-active' : ''}`}
                    onClick={() => (moreActionsOpen ? closeMoreActions() : openMoreActions())}
                  >
                    <MoreHorizontal className="pd-tile-ic" strokeWidth={2} />
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">More</span>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="pd-tile is-primary"
                    onClick={() => void onSaveKot()}
                    disabled={savingKot}
                  >
                    <Banknote className="pd-tile-ic" strokeWidth={2} />
                    <span className="pd-tile-text">
                      <span className="pd-tile-label">Quick Cash</span>
                    </span>
                    <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
                  </button>
                </div>

                {moreActionsOpen ? createPortal(
                  // Centered modal. Any click inside — an item or the
                  // backdrop — closes it with the zoom-out animation.
                  <div
                    className={`pd-more-overlay${moreClosing ? ' is-closing' : ''}`}
                    role="presentation"
                    onClick={closeMoreActions}
                  >
                  <div className="pd-more-menu" role="dialog" aria-modal="true" aria-label="More actions">
                    <button type="button" className="pd-more-item" onClick={() => setAreaOpen(true)}>
                      <BtnIcon icon={MapPinned} /> <span>Area Change</span>
                    </button>
                    <button
                      type="button"
                      className="pd-more-item"
                      onClick={() => {
                        setReceiptOpen(true)
                        void loadReceiptCustomers('')
                      }}
                    >
                      <BtnIcon icon={Receipt} /> <span>Receipt</span>
                    </button>
                    <button
                      type="button"
                      className="pd-more-item"
                      onClick={() => toast('KOT Join — coming soon', 'info')}
                    >
                      <BtnIcon icon={Merge} /> <span>KOT Join</span>
                    </button>
                    <button type="button" className="pd-more-item">
                      <BtnIcon icon={RotateCcw} /> <span>Return</span>
                    </button>
                    <button type="button" className="pd-more-item">
                      <BtnIcon icon={Package} /> <span>Delivery</span>
                    </button>
                    <button type="button" className="pd-more-item">
                      <BtnIcon icon={Repeat} /> <span>KOT Reprint</span>
                    </button>
                    <button type="button" className="pd-more-item">
                      <BtnIcon icon={Printer} /> <span>Print Bill</span>
                    </button>
                    <button type="button" className="pd-more-item">
                      <BtnIcon icon={ShoppingBag} /> <span>Takeaway List</span>
                    </button>
                    <button type="button" className="pd-more-item">
                      <BtnIcon icon={ClipboardList} /> <span>Delivery List</span>
                    </button>
                    <button type="button" className="pd-more-item is-danger">
                      <BtnIcon icon={MinusCircle} /> <span>Item Cancel</span>
                    </button>
                  </div>
                  </div>,
                  document.body,
                ) : null}
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
          </div>
        </div>
        </div>
        </section>
      </div>
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
          <div className="pd-ol-dialog pd-pay-dialog" role="dialog" aria-modal="true">
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
                {splitStep === 'entry' ? (
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

              {splitStep === 'entry' && splitMethod ? (
                <div className="pd-split-entry">
                  <div className="pd-split-toprow">
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
                    <button
                      type="button"
                      className={`pd-split-tip-add${splitTip === 'with' ? ' is-on' : ''}`}
                      onClick={toggleSplitTip}
                    >
                      {splitTip === 'with' ? <X size={14} /> : <Plus size={14} />}
                      {splitTip === 'with' ? 'Remove Tip' : 'Add Tip'}
                    </button>
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
              <SearchBar
                size="sm"
                value={customerSearch}
                onValueChange={setCustomerSearch}
                onSubmit={(v) => void loadCustomers(v)}
                onClear={() => void loadCustomers('')}
                placeholder="Search name / mobile"
              />
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

      {receiptOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReceiptOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-ol-wide pd-receipt-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Receipt size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Customer Lookup</p>
                  <h2 className="pd-mod-item-name">{receiptCustomerName || 'Select a customer'}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setReceiptOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-receipt-body">
              <div className="pd-receipt-list-col">
                <SearchBar
                  size="sm"
                  value={receiptSearch}
                  onValueChange={setReceiptSearch}
                  onSubmit={(v) => void loadReceiptCustomers(v)}
                  onClear={() => void loadReceiptCustomers('')}
                  placeholder="Search customer / code"
                />
                <div className="pd-ol-list">
                  {receiptCustomersState === 'loading' ? <p className="pd-cat-msg">Loading…</p> : null}
                  {receiptCustomersState === 'idle' && receiptCustomers.length === 0 ? (
                    <p className="pd-cat-msg">No customers found</p>
                  ) : null}
                  {receiptCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`pd-ol-row${receiptCustomerId === c.id ? ' is-on' : ''}`}
                      onClick={() => void selectReceiptCustomer(c)}
                    >
                      <strong>{c.name}</strong>
                      <span>{c.code || '—'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pd-receipt-detail-col">
                {!receiptCustomerId ? (
                  <p className="pd-cat-msg">Select a customer to see their bills and payments</p>
                ) : (
                  <>
                    <section className="pd-receipt-section">
                      <h3>Outstanding Bills</h3>
                      {receiptDetailState === 'loading' ? <p className="pd-cat-msg">Loading…</p> : null}
                      {receiptDetailState === 'error' ? (
                        <p className="pd-cat-msg">Could not load bills</p>
                      ) : null}
                      {receiptDetailState === 'idle' && receiptBills.length === 0 ? (
                        <p className="pd-cat-msg">No outstanding bills</p>
                      ) : null}
                      {receiptBills.length ? (
                        <div className="pd-receipt-rows">
                          {receiptBills.map((b, i) => (
                            <div key={i} className="pd-receipt-row">
                              <span className="pd-receipt-row-main">
                                <strong>{b.billNo || '—'}</strong>
                                <small>{b.date || '—'}</small>
                              </span>
                              <span className="pd-receipt-row-amt">
                                AED {money(b.amount)}
                                <small>Bal {money(b.balance)}</small>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <section className="pd-receipt-section">
                      <h3>Recent Transactions</h3>
                      {receiptDetailState === 'idle' && receiptHistory.length === 0 ? (
                        <p className="pd-cat-msg">No transactions yet</p>
                      ) : null}
                      {receiptHistory.length ? (
                        <div className="pd-receipt-rows">
                          {receiptHistory.map((h, i) => (
                            <div key={i} className="pd-receipt-row">
                              <span className="pd-receipt-row-main">
                                <strong>{h.type || 'Payment'}</strong>
                                <small>{h.date || '—'}</small>
                              </span>
                              <span className="pd-receipt-row-amt">AED {money(h.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <div className="pd-receipt-actions">
                      <button
                        type="button"
                        className="pd-mod-foot-btn"
                        onClick={() => toast('Print Outstanding — coming soon', 'info')}
                      >
                        Print Outstanding
                      </button>
                      <button
                        type="button"
                        className="pd-mod-foot-btn is-ok"
                        onClick={() => toast('Receipt Summary — coming soon', 'info')}
                      >
                        Receipt Summary
                      </button>
                      <button
                        type="button"
                        className="pd-mod-foot-btn"
                        onClick={() => toast('Receipt Details — coming soon', 'info')}
                      >
                        Receipt Details
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {salesViewerOpen ? <SalesViewerDialog areas={areas} onClose={() => setSalesViewerOpen(false)} /> : null}

      {counterCloseOpen ? <CounterCloseAllDialog onClose={() => setCounterCloseOpen(false)} /> : null}

      {confirmAlert ? (
        <div
          className="pd-alert-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmAlert(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmAlert(null)
          }}
        >
          <div
            className={`pd-alert-box${confirmAlert.tone === 'danger' ? ' is-danger' : ''}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pd-alert-title"
            aria-describedby="pd-alert-msg"
          >
            <button type="button" className="pd-alert-x" onClick={() => setConfirmAlert(null)} aria-label="Close">
              <X size={16} />
            </button>
            <div className="pd-alert-body">
              <span className="pd-alert-icon" aria-hidden="true">
                {confirmAlert.tone === 'danger' ? <AlertTriangle size={22} /> : <Info size={22} />}
              </span>
              <div className="pd-alert-text">
                <h2 id="pd-alert-title" className="pd-alert-title">{confirmAlert.title}</h2>
                <p id="pd-alert-msg" className="pd-alert-msg">{confirmAlert.message}</p>
              </div>
            </div>
            <div className="pd-alert-actions">
              {confirmAlert.mode === 'yesno' ? (
                <button
                  type="button"
                  className="pd-alert-btn"
                  autoFocus={confirmAlert.tone === 'danger'}
                  onClick={() => setConfirmAlert(null)}
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                className="pd-alert-btn is-primary"
                autoFocus={confirmAlert.tone !== 'danger'}
                onClick={() => {
                  confirmAlert.onYes?.()
                  setConfirmAlert(null)
                }}
              >
                {confirmAlert.confirmLabel ?? (confirmAlert.mode === 'ok' ? 'OK' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {productOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProductOpen(false)
          }}
        >
          <div className="pd-ol-dialog pd-product-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Package size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Product Master</p>
                  <h2 className="pd-mod-item-name">{productForm.id > 0 ? 'Edit Item' : 'New Item'}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={() => setProductOpen(false)} aria-label="Close">
                <X size={13} />
              </button>
            </div>

            <div className="pd-product-body">
              <div className="pd-form-row">
                <label>Item Code</label>
                <div className="pd-form-code">
                  <input
                    value={productForm.code}
                    onChange={(e) => setProductForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="Auto or enter manually"
                  />
                  <button type="button" className="pd-form-code-btn" onClick={generateNewProductCode}>
                    New Code
                  </button>
                </div>
              </div>

              <div className="pd-form-row">
                <label>Description</label>
                <input
                  value={productForm.description}
                  onChange={(e) => {
                    const value = e.target.value
                    setProductForm((f) => ({ ...f, description: value }))
                    const key = 'productDescriptionArabic'
                    if (arabicAutoTimers.current[key]) clearTimeout(arabicAutoTimers.current[key])
                    const trimmed = value.trim()
                    if (!trimmed) return
                    arabicAutoTimers.current[key] = setTimeout(() => {
                      translateToArabic(trimmed)
                        .then((translated) => {
                          if (!translated) return
                          setProductForm((prev) => {
                            if (prev.arabicDescription && prev.arabicDescription !== arabicAutoLast.current[key]) return prev
                            arabicAutoLast.current[key] = translated
                            return { ...prev, arabicDescription: translated }
                          })
                        })
                        .catch(notifyTranslateDown)
                    }, 400)
                  }}
                  placeholder="Item name"
                />
              </div>

              <div className="pd-form-row">
                <label>Arabic Description</label>
                <ArabicInput
                  value={productForm.arabicDescription}
                  onValueChange={(v) => setProductForm((f) => ({ ...f, arabicDescription: v }))}
                  source={productForm.description}
                  onTranslateError={notifyTranslateDown}
                />
              </div>

              <div className="pd-form-grid-2">
                <div className="pd-form-row">
                  <label>Group</label>
                  <SearchSelect
                    id="pd-product-group"
                    value={productForm.groupId || null}
                    valueLabel={productForm.groupName}
                    options={groupOptions}
                    loading={groupOptionsLoading === 'group'}
                    onOpen={() => void loadGroupOptions('group')}
                    onChange={(o) => {
                      if (o.id === productForm.groupId) return
                      setSubgroupOptions([])
                      setProductForm((f) => ({
                        ...f,
                        groupId: Number(o.id),
                        groupName: o.name,
                        subgroupId: 0,
                        subgroupName: '',
                      }))
                    }}
                    placeholder="Select group"
                    searchPlaceholder="Search group"
                  />
                </div>
                <div className="pd-form-row">
                  <label>SubGroup</label>
                  <SearchSelect
                    id="pd-product-subgroup"
                    value={productForm.subgroupId || null}
                    valueLabel={productForm.subgroupName}
                    options={subgroupOptions}
                    loading={groupOptionsLoading === 'subgroup'}
                    onOpen={() => void loadGroupOptions('subgroup')}
                    onChange={(o) =>
                      setProductForm((f) => ({ ...f, subgroupId: Number(o.id), subgroupName: o.name }))
                    }
                    disabled={!productForm.groupId}
                    disabledHint="Pick a group first"
                    placeholder="Select subgroup"
                    searchPlaceholder="Search subgroup"
                    emptyText="No subgroups in this group"
                  />
                </div>
              </div>

              <div className="pd-form-grid-2">
                <div className="pd-form-row">
                  <label>Kitchen Location</label>
                  <input
                    value={productForm.kitchenLocation}
                    onChange={(e) => setProductForm((f) => ({ ...f, kitchenLocation: e.target.value }))}
                  />
                </div>
                <div className="pd-form-row">
                  <label>KOT Priority</label>
                  <select
                    value={productForm.kotPriority}
                    onChange={(e) => setProductForm((f) => ({ ...f, kotPriority: e.target.value }))}
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div className="pd-form-grid-2">
                <div className="pd-form-row">
                  <label>Unit Cost</label>
                  <input
                    inputMode="decimal"
                    value={productForm.unitCost}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, unitCost: e.target.value.replace(/[^\d.]/g, '') }))
                    }
                  />
                </div>
                <div className="pd-form-row">
                  <label>VAT (IN) %</label>
                  <div className="pd-form-vat-pair">
                    <input
                      inputMode="decimal"
                      value={productForm.vatIn}
                      onChange={(e) =>
                        setProductForm((f) => ({ ...f, vatIn: e.target.value.replace(/[^\d.]/g, '') }))
                      }
                    />
                    <span className="pd-form-computed">AED {withVat(productForm.unitCost, productForm.vatIn)}</span>
                  </div>
                </div>
              </div>

              <div className="pd-form-grid-2">
                <div className="pd-form-row">
                  <label>Unit Price</label>
                  <input
                    inputMode="decimal"
                    value={productForm.unitPrice}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, unitPrice: e.target.value.replace(/[^\d.]/g, '') }))
                    }
                  />
                </div>
                <div className="pd-form-row">
                  <label>VAT (OUT) %</label>
                  <div className="pd-form-vat-pair">
                    <input
                      inputMode="decimal"
                      value={productForm.vatOut}
                      onChange={(e) =>
                        setProductForm((f) => ({ ...f, vatOut: e.target.value.replace(/[^\d.]/g, '') }))
                      }
                    />
                    <span className="pd-form-computed">
                      AED {withVat(productForm.unitPrice, productForm.vatOut)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pd-form-grid-3">
                <div className="pd-form-row">
                  <label>Pack Qty</label>
                  <input
                    inputMode="numeric"
                    value={productForm.packQty}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, packQty: e.target.value.replace(/[^\d]/g, '') }))
                    }
                  />
                </div>
                <div className="pd-form-row">
                  <label>Unit</label>
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))}
                  >
                    <option value="PCS">PCS</option>
                    <option value="KG">KG</option>
                    <option value="LTR">LTR</option>
                    <option value="BOX">BOX</option>
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Qty On Hand</label>
                  <input value={productForm.qtyOnHand} readOnly placeholder="—" />
                </div>
              </div>

              <div className="pd-form-row">
                <label>Product Type</label>
                <select
                  value={productForm.productType}
                  onChange={(e) => setProductForm((f) => ({ ...f, productType: e.target.value }))}
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="COMBO">COMBO</option>
                </select>
              </div>

              <div className="pd-form-row">
                <label>Item Description</label>
                <textarea
                  rows={3}
                  value={productForm.itemDescription}
                  onChange={(e) => setProductForm((f) => ({ ...f, itemDescription: e.target.value }))}
                />
              </div>
            </div>

            <div className="pd-product-modal-foot">
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                disabled={productSaving}
                onClick={() => void saveProductForm()}
              >
                {productSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entryModal ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEntryModal()
          }}
        >
          <div
            className={`pd-ol-dialog ${
              (
                [
                  'recipe', 'addOn', 'floorDesign',
                  'stockAdjustment', 'productionEntry', 'openingStock',
                  'productRequest', 'productReceipt', 'productTransfer',
                  'transferList', 'receiptList', 'supplierList',
                  'purchaseEntry', 'purchaseList', 'purchaseReturn', 'purchaseReturnList',
                  'movementReport', 'osBalanceList',
                  'billReprint', 'counterCloseReportsRP', 'pendingOrderList',
                  'itemwiseViewer', 'delBoyCommission',
                  'incomeExpenseEntry', 'discountEntry', 'discountList',
                  'productListEdit', 'eventLogs',
                  'privilegeSetup', 'controlPanel', 'partyOrderList', 'printerSetup',
                  'cashInOut',
                ] as EntryKey[]
              ).includes(entryModal)
                ? 'pd-ol-wide'
                : entryModal === 'damageEntry'
                  ? 'pd-ol-damage'
                : entryModal === 'table' || entryModal === 'combo' || entryModal === 'messMaster' || entryModal === 'bookingList'
                  ? 'pd-ol-table'
                  : (['area', 'onlineSource', 'advancePayment', 'booking'] as EntryKey[]).includes(entryModal)
                  ? 'pd-ol-narrow'
                  : ''
            }${entryModal === 'booking' || entryModal === 'bookingList' ? ' pd-ol-booking' : ''}`}
            role="dialog"
            aria-modal="true"
          >
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  {(() => {
                    const EntryIcon = ENTRY_META[entryModal].icon
                    return <EntryIcon size={15} strokeWidth={2} />
                  })()}
                </div>
                <div>
                  <p className="pd-mod-kicker">Creation</p>
                  <h2 className="pd-mod-item-name">{ENTRY_META[entryModal].label}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeEntryModal} aria-label="Close">
                <X size={13} />
              </button>
            </div>

            <div className="pd-ol-body">
              {entryModal === 'area' ? (
                <>
                  <div className="pd-form-row">
                    <label>Area Name</label>
                    <input
                      value={ef('areaName')}
                      onChange={(e) => setEfWithArabicAutoFill('areaName', 'areaNameArabic', e.target.value)}
                      placeholder="e.g. DINE IN"
                    />
                  </div>
                  <div className="pd-form-row">
                    <label>Area Name Arabic</label>
                    <ArabicInput value={ef('areaNameArabic')} onValueChange={(v) => setEf('areaNameArabic', v)} source={ef('areaName')} onTranslateError={notifyTranslateDown} />
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Supply Type</label>
                      <select value={ef('supplyType')} onChange={(e) => setEf('supplyType', e.target.value)}>
                        <option value="">Select…</option>
                        <option value="DINE IN">DINE IN</option>
                        <option value="TAKEAWAY">TAKEAWAY</option>
                        <option value="DELIVERY">DELIVERY</option>
                        <option value="PARCEL">PARCEL</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Prefix</label>
                      <input value={ef('prefix')} onChange={(e) => setEf('prefix', e.target.value)} />
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Price Type</label>
                    <select value={ef('priceType')} onChange={(e) => setEf('priceType', e.target.value)}>
                      <option value="">Select…</option>
                      <option value="RETAIL">RETAIL</option>
                      <option value="WHOLESALE">WHOLESALE</option>
                    </select>
                  </div>
                  <div className="pd-form-row">
                    <label>Table Creation Type</label>
                    <div className="pd-entry-radio-row">
                      <label className="pd-entry-radio">
                        <input
                          type="radio"
                          name="tableCreationType"
                          checked={ef('tableCreationType') === 'manual'}
                          onChange={() => setEf('tableCreationType', 'manual')}
                        />
                        Manual
                      </label>
                      <label className="pd-entry-radio">
                        <input
                          type="radio"
                          name="tableCreationType"
                          checked={ef('tableCreationType') === 'automatic'}
                          onChange={() => setEf('tableCreationType', 'automatic')}
                        />
                        Automatic
                      </label>
                    </div>
                  </div>
                  <Toggle checked={efBool('showOnTablet')} onChange={(v) => setEf('showOnTablet', v)} label="Show on Tablet" />
                </>
              ) : null}

              {entryModal === 'table' ? (
                <div className="pd-te-grid">
                <div className="pd-te-fields">
                  <div className="pd-form-row">
                    <label>Area</label>
                    <select value={ef('areaName')} onChange={(e) => setEf('areaName', e.target.value)}>
                      <option value="">Select…</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Table No</label>
                      <input value={ef('tableNo')} onChange={(e) => setEf('tableNo', e.target.value.replace(/[^\d]/g, ''))} />
                    </div>
                    <div className="pd-form-row">
                      <label>No. of Chair</label>
                      <input value={ef('noOfChairs')} onChange={(e) => setEf('noOfChairs', e.target.value.replace(/[^\d]/g, ''))} />
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Table Name</label>
                    <input value={ef('tableName')} onChange={(e) => setEfWithArabicAutoFill('tableName', 'tableNameArabic', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Table Name Arabic</label>
                    <ArabicInput value={ef('tableNameArabic')} onValueChange={(v) => setEf('tableNameArabic', v)} source={ef('tableName')} onTranslateError={notifyTranslateDown} />
                  </div>
                  <div className="pd-form-row">
                    <label>Waiter Name</label>
                    <select value={ef('waiterId')} onChange={(e) => setEf('waiterId', e.target.value)}>
                      <option value="">Select…</option>
                      {entryWaiters.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <TableShapePicker
                  value={ef('tableShape')}
                  onChange={(shape) => setEf('tableShape', shape)}
                  chairs={Number(ef('noOfChairs')) || 0}
                />
                </div>
              ) : null}

              {entryModal === 'mainGroup' ? (
                <>
                  <div className="pd-form-row">
                    <label>Main Group Code</label>
                    <input value={ef('mgCode')} onChange={(e) => setEf('mgCode', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Description</label>
                    <input
                      value={ef('mgDescription')}
                      onChange={(e) => setEfWithArabicAutoFill('mgDescription', 'mgDescriptionArabic', e.target.value)}
                    />
                  </div>
                  <div className="pd-form-row">
                    <label>Description Arabic</label>
                    <ArabicInput value={ef('mgDescriptionArabic')} onValueChange={(v) => setEf('mgDescriptionArabic', v)} source={ef('mgDescription')} onTranslateError={notifyTranslateDown} />
                  </div>
                  <Toggle checked={efBool('mgApplyDiscount')} onChange={(v) => setEf('mgApplyDiscount', v)} label="Apply Discount" />
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.length === 0 ? (
                          <tr>
                            <td colSpan={2}>No main groups yet</td>
                          </tr>
                        ) : (
                          groups.map((g) => (
                            <tr key={g.id}>
                              <td>{g.code}</td>
                              <td>{g.name}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'group' ? (
                <>
                  <div className="pd-form-row">
                    <label>Master Group</label>
                    <select value={ef('grpMaster')} onChange={(e) => setEf('grpMaster', e.target.value)}>
                      <option value="">Select…</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-row">
                    <label>Group Name</label>
                    <input value={ef('grpName')} onChange={(e) => setEfWithArabicAutoFill('grpName', 'grpNameArabic', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Group Name Arabic</label>
                    <ArabicInput value={ef('grpNameArabic')} onValueChange={(v) => setEf('grpNameArabic', v)} source={ef('grpName')} onTranslateError={notifyTranslateDown} />
                  </div>
                  <Toggle
                    checked={efBool('grpBackOfficeOnly')}
                    onChange={(v) => setEf('grpBackOfficeOnly', v)}
                    label="Show only on BackOffice"
                  />
                </>
              ) : null}

              {entryModal === 'subGroup' ? (
                <>
                  <div className="pd-form-row">
                    <label>Group</label>
                    <select value={ef('sgMaster')} onChange={(e) => setEf('sgMaster', e.target.value)}>
                      <option value="">Select…</option>
                      {allSubGroups.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-row">
                    <label>Sub Group Name</label>
                    <input value={ef('sgName')} onChange={(e) => setEfWithArabicAutoFill('sgName', 'sgNameArabic', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Sub Group Name Arabic</label>
                    <ArabicInput value={ef('sgNameArabic')} onValueChange={(v) => setEf('sgNameArabic', v)} source={ef('sgName')} onTranslateError={notifyTranslateDown} />
                  </div>
                </>
              ) : null}

              {entryModal === 'kitchenMessage' ? (
                <>
                  <div className="pd-form-row">
                    <label>Kitchen Message</label>
                    <input value={ef('kmMessage')} onChange={(e) => setEfWithArabicAutoFill('kmMessage', 'kmArabic', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Message Arabic</label>
                    <ArabicInput value={ef('kmArabic')} onValueChange={(v) => setEf('kmArabic', v)} source={ef('kmMessage')} onTranslateError={notifyTranslateDown} />
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Message</th>
                          <th>Message Arabic</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kitchenMessages.map((m) => (
                          <tr
                            key={m.id}
                            className={kitchenMsgSelected === m.id ? 'is-selected' : undefined}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setKitchenMsgSelected(m.id)
                              setEf('kmMessage', m.message)
                              setEf('kmArabic', m.arabic)
                            }}
                          >
                            <td>{m.message}</td>
                            <td dir="rtl">{m.arabic}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'combo' ? (
                <div className="pd-te-grid pd-combo-grid">
                <div className="pd-te-fields">
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Combo Name</label>
                      <input value={ef('comboName')} onChange={(e) => setEf('comboName', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Price</label>
                      <input value={ef('comboPrice')} onChange={(e) => setEf('comboPrice', e.target.value.replace(/[^\d.]/g, ''))} />
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Group Name</label>
                    <div className="pd-combo-pick">
                      <span className="pd-combo-select">
                        <select value={comboGroupInput} onChange={(e) => setComboGroupInput(e.target.value)}>
                          <option value="">Select…</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.name}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                        {comboGroupInput ? (
                          <button
                            type="button"
                            className="pd-combo-clear"
                            aria-label="Clear group"
                            title="Clear"
                            onClick={() => setComboGroupInput('')}
                          >
                            <X size={12} strokeWidth={2.6} />
                          </button>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className="pd-combo-add"
                        aria-label="Add group"
                        title="Add group"
                        disabled={!comboGroupInput || comboGroups.includes(comboGroupInput)}
                        onClick={() => {
                          if (comboGroupInput && !comboGroups.includes(comboGroupInput)) {
                            setComboGroups((prev) => [...prev, comboGroupInput])
                          }
                        }}
                      >
                        <Plus size={16} strokeWidth={2.6} />
                      </button>
                    </div>
                  </div>
                </div>
                  <ScrollTable
                    columns={[{ key: 'name', header: 'Group Name', render: (g: string) => g }]}
                    rows={comboGroups}
                    rowKey={(g) => g}
                    height={240}
                    emptyText="No groups added"
                    isSelected={(g) => comboGroupInput === g}
                    onRowClick={(g) => setComboGroupInput(g)}
                  />
                </div>
              ) : null}

              {entryModal === 'recipe' ? (
                <>
                  <div className="pd-form-row">
                    <label>Finished Product</label>
                    <input value={ef('recipeProduct')} onChange={(e) => setEf('recipeProduct', e.target.value)} />
                  </div>
                  <div className="pd-recipe-line-row">
                    <input
                      placeholder="Product Code"
                      value={recipeDraft.code}
                      onChange={(e) => setRecipeDraft((d) => ({ ...d, code: e.target.value }))}
                    />
                    <input
                      placeholder="Product Name"
                      value={recipeDraft.name}
                      onChange={(e) => setRecipeDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                    <input
                      placeholder="Pack Details"
                      value={recipeDraft.packDetails}
                      onChange={(e) => setRecipeDraft((d) => ({ ...d, packDetails: e.target.value }))}
                    />
                    <input
                      placeholder="Cost"
                      value={recipeDraft.cost}
                      onChange={(e) => setRecipeDraft((d) => ({ ...d, cost: e.target.value.replace(/[^\d.]/g, '') }))}
                    />
                    <input
                      placeholder="Pack Qty"
                      value={recipeDraft.packQty}
                      onChange={(e) => setRecipeDraft((d) => ({ ...d, packQty: e.target.value.replace(/[^\d.]/g, '') }))}
                    />
                    <input
                      placeholder="Qty"
                      value={recipeDraft.qty}
                      onChange={(e) => setRecipeDraft((d) => ({ ...d, qty: e.target.value.replace(/[^\d.]/g, '') }))}
                    />
                    <select value={recipeDraft.unit} onChange={(e) => setRecipeDraft((d) => ({ ...d, unit: e.target.value }))}>
                      <option value="GM">GM</option>
                      <option value="KG">KG</option>
                      <option value="ML">ML</option>
                      <option value="LTR">LTR</option>
                      <option value="PCS">PCS</option>
                    </select>
                    <button type="button" className="pd-form-code-btn" onClick={addRecipeLine}>
                      ADD
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Product Code</th>
                          <th>Product Name</th>
                          <th>Pack Details</th>
                          <th>Pack Qty</th>
                          <th>Qty</th>
                          <th>Cost</th>
                          <th>Unit</th>
                          <th>Line Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipeLines.length === 0 ? (
                          <tr>
                            <td colSpan={8}>No ingredients added</td>
                          </tr>
                        ) : (
                          recipeLines.map((l, i) => (
                            <tr key={i}>
                              <td>{l.code}</td>
                              <td>{l.name}</td>
                              <td>{l.packDetails}</td>
                              <td>{l.packQty}</td>
                              <td>{l.qty}</td>
                              <td>{l.cost}</td>
                              <td>{l.unit}</td>
                              <td>AED {money((Number(l.cost) || 0) * (Number(l.qty) || 0))}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pd-form-row">
                    <label>Remarks</label>
                    <textarea rows={2} value={ef('recipeRemarks')} onChange={(e) => setEf('recipeRemarks', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Unit Cost</label>
                    <div className="pd-form-computed">AED {money(recipeUnitCost())}</div>
                  </div>
                </>
              ) : null}

              {entryModal === 'barcode' ? (
                <>
                  <div className="pd-form-row">
                    <label>Product</label>
                    <input value={ef('barcodeProduct')} onChange={(e) => setEf('barcodeProduct', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Text1</label>
                    <input value={ef('barcodeText1')} onChange={(e) => setEf('barcodeText1', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Text2</label>
                    <input value={ef('barcodeText2')} onChange={(e) => setEf('barcodeText2', e.target.value)} />
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Production Date</label>
                      <DatePicker value={ef('productionDate')} onChange={(v) => setEf('productionDate', v)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Expiry Date</label>
                      <DatePicker value={ef('expiryDate')} onChange={(v) => setEf('expiryDate', v)} min={ef('productionDate')} />
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Print Count</label>
                    <input value={ef('printCount')} onChange={(e) => setEf('printCount', e.target.value.replace(/[^\d]/g, ''))} />
                  </div>
                </>
              ) : null}

              {entryModal === 'notes' ? (
                <div className="pd-nt">
                  <div className={`pd-nt-pad${notesSelected != null ? ' is-editing' : ''}`}>
                    <div className="pd-nt-pad-top">
                      <span>
                        <StickyNote size={14} />
                        {notesSelected != null ? 'Editing note' : 'New note'}
                      </span>
                      {notesSelected != null ? (
                        <span className="pd-nt-pad-actions">
                          <button
                            type="button"
                            className="pd-nt-new is-danger"
                            onClick={() => deleteNote(notesSelected)}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                          <button
                            type="button"
                            className="pd-nt-new"
                            onClick={() => {
                              setNotesSelected(null)
                              setEf('noteDescription', '')
                            }}
                          >
                            <Plus size={13} /> New
                          </button>
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      rows={4}
                      placeholder="Write a note…"
                      value={ef('noteDescription')}
                      onChange={(e) => setEf('noteDescription', e.target.value)}
                    />
                    <div className="pd-nt-pad-foot">
                      <small>{ef('noteDescription').trim().length} characters</small>
                      <button
                        type="button"
                        className="pd-nt-save"
                        disabled={!ef('noteDescription').trim()}
                        onClick={() => {
                          saveNote()
                          setNotesSelected(null)
                          setEf('noteDescription', '')
                        }}
                      >
                        <Check size={14} strokeWidth={2.6} /> {notesSelected != null ? 'Update' : 'Save'}
                      </button>
                    </div>
                  </div>

                  <div className="pd-nt-bar">
                    <b>
                      Notes <em>{notesList.length}</em>
                    </b>
                    <div className="pd-nt-dates">
                      <DatePicker value={ef('notesFrom')} onChange={(v) => setEf('notesFrom', v)} max={ef('notesTo')} />
                      <span>to</span>
                      <DatePicker value={ef('notesTo')} onChange={(v) => setEf('notesTo', v)} min={ef('notesFrom')} />
                    </div>
                  </div>

                  <div className="pd-nt-board">
                    {notesList.length === 0 ? (
                      <div className="pd-nt-empty">
                        <StickyNote size={26} strokeWidth={1.6} />
                        <span>No notes yet — write your first one above.</span>
                      </div>
                    ) : (
                      notesList.map((n) => (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          className={`pd-nt-card${notesSelected === n.id ? ' is-on' : ''}`}
                          onClick={() => {
                            setNotesSelected(n.id)
                            setEf('noteDescription', n.description)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setNotesSelected(n.id)
                              setEf('noteDescription', n.description)
                            }
                          }}
                        >
                          <button
                            type="button"
                            className="pd-nt-del"
                            aria-label="Delete note"
                            title="Delete note"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNote(n.id)
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                          <span className="pd-nt-text">{n.description}</span>
                          <span className="pd-nt-date">
                            {n.date}
                            <PenLine size={11} />
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {entryModal === 'onlineSource' ? (
                <>
                  <div className="pd-form-row">
                    <label>Source Name</label>
                    <input
                      value={ef('sourceName')}
                      onChange={(e) => setEfWithArabicAutoFill('sourceName', 'sourceNameArabic', e.target.value)}
                    />
                  </div>
                  <div className="pd-form-row">
                    <label>Source Name Arabic</label>
                    <ArabicInput value={ef('sourceNameArabic')} onValueChange={(v) => setEf('sourceNameArabic', v)} source={ef('sourceName')} onTranslateError={notifyTranslateDown} />
                  </div>
                </>
              ) : null}

              {entryModal === 'paymentMode' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Payment Mode Name</label>
                      <input value={ef('pmName')} onChange={(e) => setEf('pmName', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Status</label>
                      <select value={ef('status')} onChange={(e) => setEf('status', e.target.value)}>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Payment Mode</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentModes.map((p) => (
                          <tr
                            key={p.name}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setEf('pmName', p.name)
                              setEf('status', p.status)
                            }}
                          >
                            <td>{p.name}</td>
                            <td>{p.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'messMaster' ? (
                <div className="pd-te-grid pd-combo-grid">
                <div className="pd-te-fields">
                  <div className="pd-form-row">
                    <label>Mess Name</label>
                    <input value={ef('messName')} onChange={(e) => setEf('messName', e.target.value)} />
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>No Of Time</label>
                      <select value={ef('messTimes')} onChange={(e) => setEf('messTimes', e.target.value)}>
                        <option value="">Select…</option>
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Mess Amount</label>
                      <input value={ef('messAmount')} onChange={(e) => setEf('messAmount', e.target.value.replace(/[^\d.]/g, ''))} />
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Item</label>
                    <div className="pd-combo-pick">
                      <span className="pd-combo-select">
                        <SearchSelect
                          id="pd-mess-item"
                          value={ef('messAddLine') || null}
                          options={messItemOptions}
                          onChange={(o) => setEf('messAddLine', o.name)}
                          placeholder="Select…"
                          searchPlaceholder="Search item"
                          emptyText="No products loaded"
                        />
                        {ef('messAddLine') ? (
                          <button
                            type="button"
                            className="pd-combo-clear"
                            aria-label="Clear item"
                            title="Clear"
                            onClick={() => setEf('messAddLine', '')}
                          >
                            <X size={12} strokeWidth={2.6} />
                          </button>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className="pd-combo-add"
                        aria-label="Add item"
                        title="Add item"
                        disabled={!ef('messAddLine') || messLines.includes(ef('messAddLine'))}
                        onClick={addMessLine}
                      >
                        <Plus size={16} strokeWidth={2.6} />
                      </button>
                    </div>
                  </div>
                </div>
                  <ScrollTable
                    columns={[{ key: 'name', header: 'Description', render: (l: string) => l }]}
                    rows={messLines}
                    rowKey={(l) => l}
                    height={240}
                    emptyText="No items added"
                  />
                </div>
              ) : null}

              {entryModal === 'addOn' ? (
                <div className="pd-addon-body">
                  <div className="pd-addon-form">
                    <div className="pd-form-row">
                      <label>Add-on Name</label>
                      <input
                        value={ef('addOnName')}
                        onChange={(e) => setEfWithArabicAutoFill('addOnName', 'addOnArabic', e.target.value)}
                      />
                    </div>
                    <div className="pd-form-row">
                      <label>Add On Arabic</label>
                      <ArabicInput value={ef('addOnArabic')} onValueChange={(v) => setEf('addOnArabic', v)} source={ef('addOnName')} onTranslateError={notifyTranslateDown} />
                    </div>
                    <div className="pd-form-grid-2">
                      <div className="pd-form-row">
                        <label>Price Without Vat</label>
                        <input value={ef('addOnPrice')} onChange={(e) => setEf('addOnPrice', e.target.value.replace(/[^\d.]/g, ''))} />
                      </div>
                      <div className="pd-form-row">
                        <label>Vat %</label>
                        <input value={ef('addOnVat')} onChange={(e) => setEf('addOnVat', e.target.value.replace(/[^\d.]/g, ''))} />
                      </div>
                    </div>
                    <div className="pd-form-row">
                      <label>Price With Vat</label>
                      <div className="pd-form-computed">AED {withVat(ef('addOnPrice'), ef('addOnVat'))}</div>
                    </div>
                    <div className="pd-grid-wrap">
                      <table className="pd-grid">
                        <thead>
                          <tr>
                            <th>Add-on</th>
                            <th>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {addOns.length === 0 ? (
                            <tr>
                              <td colSpan={2}>No add-ons saved yet</td>
                            </tr>
                          ) : (
                            addOns.map((a, i) => (
                              <tr key={i}>
                                <td>{a.name}</td>
                                <td>AED {withVat(a.priceNoVat, a.vatPct)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="pd-addon-tree">
                    {groups.length === 0 ? (
                      <p className="pd-cat-msg">No categories loaded</p>
                    ) : (
                      groups.map((g) => (
                        <div key={g.id} className="pd-addon-tree-group">
                          {g.name.toLowerCase()}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {entryModal === 'booking' ? (
                <>
                  <div className="pd-booking-tabs">
                    {(['DINE IN', 'UPSTAIR', 'OUTSIDE'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`pd-booking-tab${bookingAreaTab === t ? ' is-on' : ''}`}
                        onClick={() => setBookingAreaTab(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="pd-form-row">
                    <label>Booking Date</label>
                    <DatePicker value={ef('bookingDate')} onChange={(v) => setEf('bookingDate', v)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Customer</label>
                    <input value={ef('bookCustomer')} onChange={(e) => setEf('bookCustomer', e.target.value)} />
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Mobile</label>
                      <input value={ef('bookMobile')} onChange={(e) => setEf('bookMobile', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Party Size</label>
                      <input value={ef('bookPartySize')} onChange={(e) => setEf('bookPartySize', e.target.value.replace(/[^\d]/g, ''))} />
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Advance Amount</label>
                    <input value={ef('bookAdvance')} onChange={(e) => setEf('bookAdvance', e.target.value.replace(/[^\d.]/g, ''))} />
                  </div>
                </>
              ) : null}

              {entryModal === 'bookingList' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>From</label>
                      <DatePicker value={ef('bookingFrom')} onChange={(v) => setEf('bookingFrom', v)} max={ef('bookingTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('bookingTo')} onChange={(v) => setEf('bookingTo', v)} min={ef('bookingFrom')} />
                    </div>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Booking Date</th>
                          <th>Party Size</th>
                          <th>Customer</th>
                          <th>Mobile</th>
                          <th>Area</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.length === 0 ? (
                          <tr>
                            <td colSpan={5}>No bookings recorded this session</td>
                          </tr>
                        ) : (
                          bookings.map((b) => (
                            <tr key={b.id}>
                              <td>{b.date ? new Date(b.date).toLocaleDateString('en-GB') : '—'}</td>
                              <td>{b.partySize}</td>
                              <td>{b.customer}</td>
                              <td>{b.mobile}</td>
                              <td>{b.area}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'floorDesign' ? (
                <>
                  <div className="pd-form-row">
                    <label>Area</label>
                    <select value={floorAreaId ?? ''} onChange={(e) => setFloorAreaId(Number(e.target.value) || null)}>
                      <option value="">Select…</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-floor-toolbar">
                    <button type="button" className="pd-form-code-btn" disabled={floorBusy} onClick={() => void loadFloorDesign()}>
                      Load
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => toast('Border tool not available yet', 'info')}>
                      Start Border
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => toast('Border tool not available yet', 'info')}>
                      Clear Border
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => toast('Border tool not available yet', 'info')}>
                      Finish Border
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => toast('Label tool not available yet', 'info')}>
                      Add Label
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => toast('Zone tool not available yet', 'info')}>
                      Add Zone
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => toast('Wall/Block tool not available yet', 'info')}>
                      Add Wall/Block
                    </button>
                  </div>
                  <div className="pd-floor-canvas">
                    {floorAreaId ? (
                      <div className="pd-table-grid is-floor">
                        {tables
                          .filter((t) => t.areaId === floorAreaId)
                          .map((t) => (
                            <TableCard key={t.id} label={t.name} seats={t.seats} status="free" />
                          ))}
                      </div>
                    ) : (
                      <p className="pd-cat-msg">Pick an Area to load its floor layout</p>
                    )}
                  </div>
                </>
              ) : null}

              {entryModal === 'stockAdjustment' ? (
                <>
                  <div className="pd-txn-head">
                    <div className="pd-txn-head-fields">
                      <div className="pd-form-grid-2">
                        <div className="pd-form-row">
                          <label>Stock Adj. No.</label>
                          <input value={ef('txnNo')} readOnly placeholder="Auto" />
                        </div>
                        <div className="pd-form-row">
                          <label>Date</label>
                          <DatePicker value={ef('txnDate')} onChange={(v) => setEf('txnDate', v)} />
                        </div>
                      </div>
                      <div className="pd-form-row">
                        <label>Remarks</label>
                        <input value={ef('txnRemarks')} onChange={(e) => setEf('txnRemarks', e.target.value)} />
                      </div>
                    </div>
                    <p className="pd-txn-status">Status : New Stock Entry</p>
                  </div>
                  <div className="pd-recipe-line-row">
                    <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
                    <input placeholder="Short Description" value={td('shortDesc')} onChange={(e) => setTd('shortDesc', e.target.value)} />
                    <input placeholder="Pkt Qty" value={td('pktQty')} onChange={(e) => setTd('pktQty', e.target.value)} />
                    <input placeholder="Pkt. details" value={td('pktDetails')} onChange={(e) => setTd('pktDetails', e.target.value)} />
                    <input placeholder="System Qty" value={td('systemQty')} onChange={(e) => setTd('systemQty', e.target.value)} />
                    <input placeholder="Adj. Qty" value={td('adjQty')} onChange={(e) => setTd('adjQty', e.target.value)} />
                    <input placeholder="Entered Qty" value={td('enteredQty')} onChange={(e) => setTd('enteredQty', e.target.value)} />
                    <input placeholder="Physical Qty" value={td('physicalQty')} onChange={(e) => setTd('physicalQty', e.target.value)} />
                    <select value={td('reason')} onChange={(e) => setTd('reason', e.target.value)}>
                      <option value="Opening Stock">Opening Stock</option>
                      <option value="Stock Count">Stock Count</option>
                      <option value="Wastage">Wastage</option>
                      <option value="Other">Other</option>
                    </select>
                    <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
                      ADD
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Barcode</th>
                          <th>Short Description</th>
                          <th>Packet Details</th>
                          <th>Present Qty</th>
                          <th>AdjustQty</th>
                          <th>EnteredQty</th>
                          <th>PhysicalQty</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnLines.length === 0 ? (
                          <tr>
                            <td colSpan={8}>No lines added</td>
                          </tr>
                        ) : (
                          txnLines.map((l, i) => (
                            <tr
                              key={i}
                              className={txnSelected === i ? 'is-selected' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setTxnSelected(i)}
                            >
                              <td>{l.barcode}</td>
                              <td>{l.shortDesc}</td>
                              <td>{l.pktDetails}</td>
                              <td>{l.systemQty}</td>
                              <td>{l.adjQty}</td>
                              <td>{l.enteredQty}</td>
                              <td>{l.physicalQty}</td>
                              <td>{l.reason}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'stockAdjustList' || entryModal === 'damageList' ? (
                <>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>From</label>
                      <DatePicker value={ef('listFrom')} onChange={(v) => setEf('listFrom', v)} max={ef('listTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('listTo')} onChange={(v) => setEf('listTo', v)} min={ef('listFrom')} />
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
                      Search
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Stock Adj No</th>
                          <th>Post Status</th>
                          <th>Reason</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'productionEntry' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Production No</label>
                      <input value={ef('txnNo')} onChange={(e) => setEf('txnNo', e.target.value)} placeholder="Auto" />
                    </div>
                    <div className="pd-form-row">
                      <label>Production Date</label>
                      <DatePicker value={ef('txnDate')} onChange={(v) => setEf('txnDate', v)} />
                    </div>
                  </div>
                  <div className="pd-recipe-line-row">
                    <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
                    <input placeholder="Short Description" value={td('shortDesc')} onChange={(e) => setTd('shortDesc', e.target.value)} />
                    <input placeholder="Qty" value={td('qty')} onChange={(e) => setTd('qty', e.target.value.replace(/[^\d.]/g, ''))} />
                    <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
                      Add
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={deleteSelectedTxnLine}>
                      Del
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Item Code</th>
                          <th>Item Name</th>
                          <th>Present Qty</th>
                          <th>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnLines.length === 0 ? (
                          <tr>
                            <td colSpan={4}>No items added</td>
                          </tr>
                        ) : (
                          txnLines.map((l, i) => (
                            <tr
                              key={i}
                              className={txnSelected === i ? 'is-selected' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setTxnSelected(i)}
                            >
                              <td>{l.barcode}</td>
                              <td>{l.shortDesc}</td>
                              <td>—</td>
                              <td>{l.qty}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'openingStock' ? (
                <>
                  <h3 className="pd-txn-title">Opening Stock Entry</h3>
                  <div className="pd-recipe-line-row">
                    <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
                    <input placeholder="Short Description" value={td('shortDesc')} onChange={(e) => setTd('shortDesc', e.target.value)} />
                    <input placeholder="Pkt Qty" value={td('pktQty')} onChange={(e) => setTd('pktQty', e.target.value)} />
                    <input placeholder="Pkt. details" value={td('pktDetails')} onChange={(e) => setTd('pktDetails', e.target.value)} />
                    <input
                      placeholder="Opening Stock"
                      value={td('openingStockQty')}
                      onChange={(e) => setTd('openingStockQty', e.target.value)}
                    />
                    <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
                      ADD
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Barcode</th>
                          <th>Short Description</th>
                          <th>Packet Details</th>
                          <th>Opening Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnLines.length === 0 ? (
                          <tr>
                            <td colSpan={4}>No lines added</td>
                          </tr>
                        ) : (
                          txnLines.map((l, i) => (
                            <tr
                              key={i}
                              className={txnSelected === i ? 'is-selected' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setTxnSelected(i)}
                            >
                              <td>{l.barcode}</td>
                              <td>{l.shortDesc}</td>
                              <td>{l.pktDetails}</td>
                              <td>{l.openingStockQty}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'stockReport' ? (
                <>
                  <div className="pd-form-row">
                    <label>Group</label>
                    <select value={ef('srGroup')} onChange={(e) => setEf('srGroup', e.target.value)}>
                      <option value="">All Groups</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-row">
                    <label>SubGroup</label>
                    <select value={ef('srSubGroup')} onChange={(e) => setEf('srSubGroup', e.target.value)}>
                      <option value="">All Sub Groups</option>
                      {allSubGroups.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-row">
                    <label>Product Type</label>
                    <select value={ef('srProductType')} onChange={(e) => setEf('srProductType', e.target.value)}>
                      <option value="">All</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="COMBO">COMBO</option>
                    </select>
                  </div>
                </>
              ) : null}

              {entryModal === 'movementReport' ? (
                <div className="pd-mr-body">
                  <div className="pd-mr-groups">
                    {groups.length === 0 ? (
                      <p className="pd-cat-msg">No groups loaded</p>
                    ) : (
                      groups.map((g) => (
                        <label key={g.id} className="pd-mr-group-row">
                          <input
                            type="checkbox"
                            checked={mrSelectedGroups.has(g.id)}
                            onChange={() =>
                              setMrSelectedGroups((prev) => {
                                const next = new Set(prev)
                                if (next.has(g.id)) next.delete(g.id)
                                else next.add(g.id)
                                return next
                              })
                            }
                          />
                          {g.name}
                        </label>
                      ))
                    )}
                  </div>
                  <div className="pd-mr-filters">
                    <div className="pd-form-row">
                      <label>Item Name</label>
                      <input value={ef('mrItem')} onChange={(e) => setEf('mrItem', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Invoice Date From</label>
                      <DatePicker value={ef('mrFrom')} onChange={(v) => setEf('mrFrom', v)} max={ef('mrTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('mrTo')} onChange={(v) => setEf('mrTo', v)} min={ef('mrFrom')} />
                    </div>
                  </div>
                </div>
              ) : null}

              {entryModal === 'productRequest' ? (
                <>
                  <div className="pd-form-grid-3">
                    <div className="pd-form-row">
                      <label>Request No</label>
                      <input value={ef('txnNo')} onChange={(e) => setEf('txnNo', e.target.value)} placeholder="Auto" />
                    </div>
                    <div className="pd-form-row">
                      <label>Request Date</label>
                      <DatePicker value={ef('txnDate')} onChange={(v) => setEf('txnDate', v)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Request To</label>
                      <select value={ef('txnToArea')} onChange={(e) => setEf('txnToArea', e.target.value)}>
                        <option value="">Select…</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Request From</label>
                    <input value={ef('txnFromArea')} readOnly />
                  </div>
                  {renderTxnItemBlock()}
                </>
              ) : null}

              {entryModal === 'productReceipt' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Receipt No</label>
                      <input value={ef('txnNo')} onChange={(e) => setEf('txnNo', e.target.value)} placeholder="Auto" />
                    </div>
                    <div className="pd-form-row">
                      <label>Receipt Date</label>
                      <DatePicker value={ef('txnDate')} onChange={(v) => setEf('txnDate', v)} />
                    </div>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Receipt From</label>
                      <select value={ef('txnFromArea')} onChange={(e) => setEf('txnFromArea', e.target.value)}>
                        <option value="">Select…</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Receipt To</label>
                      <select value={ef('txnToArea')} onChange={(e) => setEf('txnToArea', e.target.value)}>
                        <option value="">Select…</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Transfer No</label>
                    <input value={ef('txnRefNo')} onChange={(e) => setEf('txnRefNo', e.target.value)} />
                  </div>
                  {renderTxnItemBlock()}
                </>
              ) : null}

              {entryModal === 'productTransfer' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Transfer No</label>
                      <input value={ef('txnNo')} onChange={(e) => setEf('txnNo', e.target.value)} placeholder="Auto" />
                    </div>
                    <div className="pd-form-row">
                      <label>Transfer Date</label>
                      <DatePicker value={ef('txnDate')} onChange={(v) => setEf('txnDate', v)} />
                    </div>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Transfer From</label>
                      <input value={ef('txnFromArea')} readOnly />
                    </div>
                    <div className="pd-form-row">
                      <label>Transfer To</label>
                      <select value={ef('txnToArea')} onChange={(e) => setEf('txnToArea', e.target.value)}>
                        <option value="">Select…</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Request No</label>
                    <input value={ef('txnRefNo')} onChange={(e) => setEf('txnRefNo', e.target.value)} />
                  </div>
                  {renderTxnItemBlock()}
                </>
              ) : null}

              {entryModal === 'transferList' || entryModal === 'receiptList' ? (
                <>
                  <div className="pd-form-grid-3">
                    <div className="pd-form-row">
                      <label>Search Column</label>
                      <select value={ef('searchColumn')} onChange={(e) => setEf('searchColumn', e.target.value)}>
                        <option>Transfer No</option>
                        <option>Remarks</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Status</label>
                      <select value={ef('postStatus')} onChange={(e) => setEf('postStatus', e.target.value)}>
                        <option value="">All</option>
                        <option value="POSTED">POSTED</option>
                        <option value="PENDING">PENDING</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Search Value</label>
                      <input value={ef('searchValue')} onChange={(e) => setEf('searchValue', e.target.value)} />
                    </div>
                  </div>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>Transfer Date From</label>
                      <DatePicker value={ef('listFrom')} onChange={(v) => setEf('listFrom', v)} max={ef('listTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('listTo')} onChange={(v) => setEf('listTo', v)} min={ef('listFrom')} />
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
                      Search
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        {entryModal === 'receiptList' ? (
                          <tr>
                            <th>Transfer No</th>
                            <th>Transfer From</th>
                            <th>Transfer To</th>
                            <th>Transfer Date</th>
                            <th>Total Amount</th>
                            <th>Status</th>
                          </tr>
                        ) : (
                          <tr>
                            <th>Transfer No</th>
                            <th>Remarks</th>
                            <th>Transfer Date</th>
                            <th>Total Amount</th>
                            <th>Status</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={entryModal === 'receiptList' ? 6 : 5}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'supplierList' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Search Column</label>
                      <select value={ef('searchColumn')} onChange={(e) => setEf('searchColumn', e.target.value)}>
                        <option>Supplier Name</option>
                        <option>Supplier Code</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Search Value</label>
                      <input value={ef('searchValue')} onChange={(e) => setEf('searchValue', e.target.value)} />
                    </div>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>SupplierCode</th>
                          <th>SupplierName</th>
                          <th>Telephone</th>
                          <th>MobileNo</th>
                          <th>ContactPerson</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((s) => (
                          <tr
                            key={s.code}
                            className={ef('supplierPick') === s.code ? 'is-selected' : undefined}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setEf('supplierPick', s.code)}
                          >
                            <td>{s.code}</td>
                            <td>{s.name}</td>
                            <td>{s.phone}</td>
                            <td>{s.mobile}</td>
                            <td>{s.contact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'purchaseEntry' ? (
                <>
                  <div className="pd-txn-head">
                    <div className="pd-txn-head-fields">
                      <div className="pd-form-row">
                        <label>Purchase #</label>
                        <input value={ef('txnNo')} readOnly placeholder="Auto" />
                      </div>
                      <div className="pd-form-grid-2">
                        <div className="pd-form-row">
                          <label>Supplier Name</label>
                          <select value={ef('supplierName')} onChange={(e) => setEf('supplierName', e.target.value)}>
                            <option value="">Select…</option>
                            {suppliers.map((s) => (
                              <option key={s.code} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ alignSelf: 'end', height: 33, display: 'flex', alignItems: 'center' }}>
                          <Toggle
                            checked={efBool('itemWithSupplier')}
                            onChange={(v) => setEf('itemWithSupplier', v)}
                            label="Item With Supplier"
                          />
                        </div>
                      </div>
                      <div className="pd-form-grid-3">
                        <div className="pd-form-row">
                          <label>Purchase Date</label>
                          <DatePicker value={ef('purchaseDate')} onChange={(v) => setEf('purchaseDate', v)} />
                        </div>
                        <div className="pd-form-row">
                          <label>Pay Mode</label>
                          <select value={ef('payMode')} onChange={(e) => setEf('payMode', e.target.value)}>
                            <option value="CREDIT">CREDIT</option>
                            <option value="CASH">CASH</option>
                          </select>
                        </div>
                        <div className="pd-form-row">
                          <label>Entered Date</label>
                          <input value={ef('enteredDate')} readOnly />
                        </div>
                      </div>
                      <div className="pd-form-grid-2">
                        <div className="pd-form-row">
                          <label>Sup Inv #.</label>
                          <input value={ef('supInvNo')} onChange={(e) => setEf('supInvNo', e.target.value)} />
                        </div>
                        <div className="pd-form-row">
                          <label>LPO No.</label>
                          <input value={ef('lpoNo')} onChange={(e) => setEf('lpoNo', e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <p className="pd-txn-status">NEW PURCHASE</p>
                  </div>
                  <div className="pd-recipe-line-row">
                    <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
                    <input placeholder="Short Description" value={td('shortDesc')} onChange={(e) => setTd('shortDesc', e.target.value)} />
                    <input placeholder="Pack Qty" value={td('packQty')} onChange={(e) => setTd('packQty', e.target.value)} />
                    <input placeholder="Qty" value={td('qty')} onChange={(e) => setTd('qty', e.target.value.replace(/[^\d.]/g, ''))} />
                    <input placeholder="Unit Cost" value={td('unitCost')} onChange={(e) => setTd('unitCost', e.target.value.replace(/[^\d.]/g, ''))} />
                    <input
                      placeholder="Selling Price"
                      value={td('sellingPrice')}
                      onChange={(e) => setTd('sellingPrice', e.target.value.replace(/[^\d.]/g, ''))}
                    />
                    <input placeholder="Disc." value={td('disc')} onChange={(e) => setTd('disc', e.target.value.replace(/[^\d.]/g, ''))} />
                    <select value={td('vatPct')} onChange={(e) => setTd('vatPct', e.target.value)}>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                    </select>
                    <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
                      Add
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Barcode</th>
                          <th>Short Description</th>
                          <th>Pack Qty</th>
                          <th>Qty</th>
                          <th>Unit Cost</th>
                          <th>Selling Price</th>
                          <th>Disc</th>
                          <th>VAT%</th>
                          <th>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnLines.length === 0 ? (
                          <tr>
                            <td colSpan={9}>No lines added</td>
                          </tr>
                        ) : (
                          txnLines.map((l, i) => (
                            <tr
                              key={i}
                              className={txnSelected === i ? 'is-selected' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setTxnSelected(i)}
                            >
                              <td>{l.barcode}</td>
                              <td>{l.shortDesc}</td>
                              <td>{l.packQty}</td>
                              <td>{l.qty}</td>
                              <td>{l.unitCost}</td>
                              <td>{l.sellingPrice}</td>
                              <td>{l.disc}</td>
                              <td>{l.vatPct}</td>
                              <td>AED {money(txnLineTotal(l))}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pd-form-row">
                    <label>Remark</label>
                    <textarea rows={2} value={ef('txnRemarks')} onChange={(e) => setEf('txnRemarks', e.target.value)} />
                  </div>
                  <div className="pd-form-grid-3">
                    <div className="pd-form-row">
                      <label>Total</label>
                      <div className="pd-form-computed">AED {money(txnGrandTotal())}</div>
                    </div>
                    <div className="pd-form-row">
                      <label>Round Off Adjustment</label>
                      <input value={ef('roundOff')} onChange={(e) => setEf('roundOff', e.target.value.replace(/[^\d.-]/g, ''))} />
                    </div>
                    <div className="pd-form-row">
                      <label>Net Amount</label>
                      <div className="pd-form-computed">AED {money(txnGrandTotal() + (Number(ef('roundOff')) || 0))}</div>
                    </div>
                  </div>
                </>
              ) : null}

              {entryModal === 'purchaseList' || entryModal === 'purchaseReturnList' ? (
                <>
                  <div className="pd-form-grid-3">
                    <div className="pd-form-row">
                      <label>Search Column</label>
                      <select value={ef('searchColumn')} onChange={(e) => setEf('searchColumn', e.target.value)}>
                        <option>Purchase No</option>
                        <option>Supplier Name</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Post Status</label>
                      <select value={ef('postStatus')} onChange={(e) => setEf('postStatus', e.target.value)}>
                        <option value="">All</option>
                        <option value="POSTED">POSTED</option>
                        <option value="DRAFT">DRAFT</option>
                      </select>
                    </div>
                    {entryModal === 'purchaseList' ? (
                      <div className="pd-form-row">
                        <label>Payment Mode</label>
                        <select value={ef('paymentModeFilter')} onChange={(e) => setEf('paymentModeFilter', e.target.value)}>
                          <option value="">All</option>
                          <option value="CREDIT">CREDIT</option>
                          <option value="CASH">CASH</option>
                        </select>
                      </div>
                    ) : (
                      <div className="pd-form-row">
                        <label>Value</label>
                        <input value={ef('searchValue')} onChange={(e) => setEf('searchValue', e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="pd-form-grid-2">
                    {entryModal === 'purchaseList' ? (
                      <div className="pd-form-row">
                        <label>Value</label>
                        <input value={ef('searchValue')} onChange={(e) => setEf('searchValue', e.target.value)} />
                      </div>
                    ) : null}
                    <div className="pd-form-row">
                      <label>Supplier</label>
                      <select value={ef('supplierFilter')} onChange={(e) => setEf('supplierFilter', e.target.value)}>
                        <option value="">All</option>
                        {suppliers.map((s) => (
                          <option key={s.code} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>{entryModal === 'purchaseList' ? 'Purchase' : 'Return'} Date From</label>
                      <DatePicker value={ef('listFrom')} onChange={(v) => setEf('listFrom', v)} max={ef('listTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('listTo')} onChange={(v) => setEf('listTo', v)} min={ef('listFrom')} />
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
                      Search
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        {entryModal === 'purchaseList' ? (
                          <tr>
                            <th>Purchase No</th>
                            <th>Purchase Date</th>
                            <th>Supplier Name</th>
                            <th>Supplier Inv No</th>
                            <th>Invoice Amount</th>
                            <th>Payment Mode</th>
                            <th>Status</th>
                          </tr>
                        ) : (
                          <tr>
                            <th>Return No</th>
                            <th>Return Date</th>
                            <th>Purchase No</th>
                            <th>Supplier Inv No</th>
                            <th>Supplier Name</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={7}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="pd-txn-count">COUNT : 0 &nbsp; TOTAL AMOUNT : 0.00</p>
                </>
              ) : null}

              {entryModal === 'purchaseReturn' ? (
                <>
                  <div className="pd-txn-head">
                    <div className="pd-txn-head-fields">
                      <div className="pd-form-grid-2">
                        <div className="pd-form-row">
                          <label>Return No.</label>
                          <input value={ef('txnNo')} readOnly placeholder="Auto" />
                        </div>
                        <div className="pd-form-row">
                          <label>Supplier Name</label>
                          <select value={ef('supplierName')} onChange={(e) => setEf('supplierName', e.target.value)}>
                            <option value="">Select…</option>
                            {suppliers.map((s) => (
                              <option key={s.code} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="pd-form-grid-2">
                        <div className="pd-form-row">
                          <label>Purchase No.</label>
                          <input value={ef('purchaseRefNo')} onChange={(e) => setEf('purchaseRefNo', e.target.value)} />
                        </div>
                        <div className="pd-form-row">
                          <label>Return Type</label>
                          <select value={ef('returnType')} onChange={(e) => setEf('returnType', e.target.value)}>
                            <option value="With GRN">With GRN</option>
                            <option value="Without GRN">Without GRN</option>
                          </select>
                        </div>
                      </div>
                      <div className="pd-form-grid-3">
                        <div className="pd-form-row">
                          <label>Return Date</label>
                          <DatePicker value={ef('returnDate')} onChange={(v) => setEf('returnDate', v)} />
                        </div>
                        <div className="pd-form-row">
                          <label>Payment Mode</label>
                          <select value={ef('payMode')} onChange={(e) => setEf('payMode', e.target.value)}>
                            <option value="CREDIT">CREDIT</option>
                            <option value="CASH">CASH</option>
                          </select>
                        </div>
                        <div className="pd-form-row">
                          <label>Entered Date</label>
                          <input value={ef('enteredDate')} readOnly />
                        </div>
                      </div>
                      <div className="pd-form-grid-2">
                        <div className="pd-form-row">
                          <label>Sup Inv No.</label>
                          <input value={ef('supInvNo')} onChange={(e) => setEf('supInvNo', e.target.value)} />
                        </div>
                        <div style={{ alignSelf: 'end', height: 33, display: 'flex', alignItems: 'center' }}>
                          <Toggle
                            checked={efBool('itemWithSupplier')}
                            onChange={(v) => setEf('itemWithSupplier', v)}
                            label="Item With Supplier"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="pd-txn-status">PURCHASE RETURN</p>
                  </div>
                  <div className="pd-recipe-line-row">
                    <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
                    <input placeholder="Short Description" value={td('shortDesc')} onChange={(e) => setTd('shortDesc', e.target.value)} />
                    <input placeholder="Qty" value={td('qty')} onChange={(e) => setTd('qty', e.target.value.replace(/[^\d.]/g, ''))} />
                    <input
                      placeholder="Return Qty"
                      value={td('returnQty')}
                      onChange={(e) => setTd('returnQty', e.target.value.replace(/[^\d.]/g, ''))}
                    />
                    <input
                      placeholder="Actual Cost"
                      value={td('unitCost')}
                      onChange={(e) => setTd('unitCost', e.target.value.replace(/[^\d.]/g, ''))}
                    />
                    <input
                      placeholder="Selling Price"
                      value={td('sellingPrice')}
                      onChange={(e) => setTd('sellingPrice', e.target.value.replace(/[^\d.]/g, ''))}
                    />
                    <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
                      Add
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Barcode</th>
                          <th>Short Description</th>
                          <th>Qty</th>
                          <th>Return Qty</th>
                          <th>Actual Cost</th>
                          <th>Selling Price</th>
                          <th>Return Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnLines.length === 0 ? (
                          <tr>
                            <td colSpan={7}>No lines added</td>
                          </tr>
                        ) : (
                          txnLines.map((l, i) => (
                            <tr
                              key={i}
                              className={txnSelected === i ? 'is-selected' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setTxnSelected(i)}
                            >
                              <td>{l.barcode}</td>
                              <td>{l.shortDesc}</td>
                              <td>{l.qty}</td>
                              <td>{l.returnQty}</td>
                              <td>{l.unitCost}</td>
                              <td>{l.sellingPrice}</td>
                              <td>AED {money((Number(l.returnQty) || 0) * (Number(l.sellingPrice) || 0))}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pd-form-row">
                    <label>Remark</label>
                    <textarea rows={2} value={ef('txnRemarks')} onChange={(e) => setEf('txnRemarks', e.target.value)} />
                  </div>
                  <p className="pd-txn-count">Purchase Bill Total : AED {money(txnGrandTotal())}</p>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>RoundOff Adj.</label>
                      <input value={ef('roundOff')} onChange={(e) => setEf('roundOff', e.target.value.replace(/[^\d.-]/g, ''))} />
                    </div>
                    <div className="pd-form-row">
                      <label>Net Amount</label>
                      <div className="pd-form-computed">AED {money(txnGrandTotal() + (Number(ef('roundOff')) || 0))}</div>
                    </div>
                  </div>
                </>
              ) : null}

              {entryModal === 'damageEntry' ? (
                <div className="pd-dmg">
                  <div className="pd-dmg-head">
                    <div className="pd-form-row">
                      <label>Damage No.</label>
                      <input value={ef('txnNo')} readOnly placeholder="Auto" />
                    </div>
                    <div className="pd-form-row">
                      <label>Date</label>
                      <DatePicker value={ef('txnDate')} onChange={(v) => setEf('txnDate', v)} />
                    </div>
                    <div className="pd-form-row pd-dmg-remarks">
                      <label>Remarks</label>
                      <input value={ef('txnRemarks')} onChange={(e) => setEf('txnRemarks', e.target.value)} />
                    </div>
                  </div>
                  <div className="pd-dmg-line">
                    <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
                    <input
                      className="pd-dmg-desc"
                      placeholder="Item"
                      value={td('shortDesc')}
                      onChange={(e) => setTd('shortDesc', e.target.value)}
                    />
                    <input
                      className="pd-dmg-qty"
                      placeholder="Qty"
                      inputMode="decimal"
                      value={td('adjQty')}
                      onChange={(e) => setTd('adjQty', e.target.value.replace(/[^\d.]/g, ''))}
                    />
                    <select value={td('reason')} onChange={(e) => setTd('reason', e.target.value)}>
                      <option value="Damage">Damage</option>
                      <option value="Expiry">Expiry</option>
                      <option value="Breakage">Breakage</option>
                    </select>
                    <button type="button" className="pd-dmg-add" onClick={addTxnLine}>
                      Add
                    </button>
                  </div>
                  <div className="pd-dmg-list">
                    <table>
                      <thead>
                        <tr>
                          <th>Barcode</th>
                          <th>Item</th>
                          <th className="is-num">Qty</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnLines.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="pd-dmg-empty">No items added</td>
                          </tr>
                        ) : (
                          txnLines.map((l, i) => (
                            <tr
                              key={i}
                              className={txnSelected === i ? 'is-selected' : undefined}
                              onClick={() => setTxnSelected(i)}
                            >
                              <td>{l.barcode}</td>
                              <td>{l.shortDesc}</td>
                              <td className="is-num">{l.adjQty}</td>
                              <td>{l.reason}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {entryModal === 'advancePayment' ? (
                <>
                  <div className="pd-form-row">
                    <label>Customer</label>
                    <input value={ef('apCustomer')} onChange={(e) => setEf('apCustomer', e.target.value)} placeholder="Customer name or code" />
                  </div>
                  <div className="pd-form-row">
                    <label>Advance Amount</label>
                    <input value={ef('apAmount')} onChange={(e) => setEf('apAmount', e.target.value.replace(/[^\d.]/g, ''))} />
                  </div>
                </>
              ) : null}

              {entryModal === 'paymentList' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Customer Code</label>
                      <input value={ef('pvCustomerCode')} readOnly placeholder="—" />
                    </div>
                    <div className="pd-form-row">
                      <label>Customer Name</label>
                      <input value={ef('pvCustomerName')} readOnly placeholder="—" />
                    </div>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Customer Code</th>
                          <th>Customer Name</th>
                          <th>Advance</th>
                          <th>Payment Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'osBalanceList' ? (
                <>
                  <div className="pd-entry-radio-row">
                    <label className="pd-entry-radio">
                      <input type="radio" name="obMode" checked={ef('obMode') === 'all'} onChange={() => setEf('obMode', 'all')} />
                      All
                    </label>
                    <label className="pd-entry-radio">
                      <input type="radio" name="obMode" checked={ef('obMode') === 'filter'} onChange={() => setEf('obMode', 'filter')} />
                      Filter
                    </label>
                  </div>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>From</label>
                      <DatePicker value={ef('obFrom')} onChange={(v) => setEf('obFrom', v)} max={ef('obTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('obTo')} onChange={(v) => setEf('obTo', v)} min={ef('obFrom')} />
                    </div>
                    <div className="pd-form-row" style={{ flex: 2 }}>
                      <label>Customer Name</label>
                      <input value={ef('obCustomerName')} onChange={(e) => setEf('obCustomerName', e.target.value)} />
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={displayCreditList}>
                      Select
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Customer Name</th>
                          <th>Bill Count</th>
                          <th>Bill Total</th>
                          <th>O/S Amount</th>
                          <th>0 - 30</th>
                          <th>30 - 60</th>
                          <th>60 - 120</th>
                          <th>120 and above</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={8}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'creditReceiptList'
                ? renderDisplayListBody(['Sl No', 'TransactionDate', 'CustomerCode', 'CustomerName', 'PreviousOSBalance', 'Paid Amount', 'NewOsBalance'])
                : null}

              {entryModal === 'advanceViewer'
                ? renderDisplayListBody(['Sl No', 'TransactionDate', 'CustomerCode', 'CustomerName', 'Cust Pay.Mode', 'EnteredBy', 'Amount'])
                : null}

              {entryModal === 'messBillViewer'
                ? renderDisplayListBody(['Sl No', 'MessBillDate', 'CustomerCode', 'CustomerName', 'MessItemName'])
                : null}

              {entryModal === 'billReprint' ? (
                <div className="pd-bill-reprint-body">
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Bill No</th>
                          <th>KOT No</th>
                          <th>BillTime</th>
                          <th>Payment Mode</th>
                          <th>TotalAmount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={5}>No bills found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>SL</th>
                          <th>BarCode</th>
                          <th>Short Description</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={6}>Select a bill</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {entryModal === 'areaWiseReportRP' || entryModal === 'groupWiseRP' || entryModal === 'itemWiseRP' ? (
                <>
                  {entryModal === 'itemWiseRP' ? (
                    <div className="pd-form-grid-2">
                      <div className="pd-form-row">
                        <label>Counter No</label>
                        <input value={ef('rCounterNo')} onChange={(e) => setEf('rCounterNo', e.target.value)} />
                      </div>
                      <div className="pd-form-row">
                        <label>Group</label>
                        <select value={ef('rGroup')} onChange={(e) => setEf('rGroup', e.target.value)}>
                          <option value="">All Groups</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.name}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                  <div className="pd-form-row">
                    <label>Report with</label>
                    <div className="pd-entry-radio-row">
                      <label className="pd-entry-radio">
                        <input type="radio" name="rMode" checked={ef('rMode') === 'date'} onChange={() => setEf('rMode', 'date')} />
                        Date
                      </label>
                      <label className="pd-entry-radio">
                        <input
                          type="radio"
                          name="rMode"
                          checked={ef('rMode') === 'counterClose'}
                          onChange={() => setEf('rMode', 'counterClose')}
                        />
                        Counter Close No.
                      </label>
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Counter Close No</label>
                    <input
                      value={ef('rCounterCloseNo')}
                      onChange={(e) => setEf('rCounterCloseNo', e.target.value)}
                      disabled={ef('rMode') !== 'counterClose'}
                    />
                  </div>
                  <Toggle checked={efBool('rCounterCloseWise')} onChange={(v) => setEf('rCounterCloseWise', v)} label="Counter Close Wise" />
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Report Date From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Report Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                </>
              ) : null}

              {entryModal === 'itemVoidReportRP' || entryModal === 'itemVoidA4' || entryModal === 'salesmanWise' ? (
                <>
                  <div className="pd-form-grid-2">
                    {entryModal === 'salesmanWise' ? (
                      <div className="pd-form-row">
                        <label>Counter No</label>
                        <input value={ef('rCounterNo')} onChange={(e) => setEf('rCounterNo', e.target.value)} />
                      </div>
                    ) : null}
                    <div className="pd-form-row">
                      <label>{entryModal === 'salesmanWise' ? 'SalesMan Name' : 'Cashier Name'}</label>
                      <input
                        value={ef('rCashierName')}
                        onChange={(e) => setEf('rCashierName', e.target.value)}
                        placeholder={entryModal === 'salesmanWise' ? undefined : 'All'}
                      />
                    </div>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>{entryModal === 'salesmanWise' ? 'Reoprt Date From' : 'Report Date From'}</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Report Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                </>
              ) : null}

              {entryModal === 'cancelBillDetails' ? (
                <>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>Report From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Report To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
                      Search
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Kot</th>
                          <th>Cashier Name</th>
                          <th>Waiter Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={3}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'cancelBillSummary' ||
              entryModal === 'salesBillWiseRP' ||
              entryModal === 'dayWiseRP' ||
              entryModal === 'counterCloseDetailsA4' ||
              entryModal === 'incomeExpense' ||
              entryModal === 'productionReport' ? (
                <>
                  {entryModal === 'counterCloseDetailsA4' || entryModal === 'incomeExpense' || entryModal === 'productionReport' ? (
                    <div className="pd-form-grid-2">
                      <div className="pd-form-row">
                        <label>Counter No</label>
                        <input value={ef('rCounterNo')} onChange={(e) => setEf('rCounterNo', e.target.value)} />
                      </div>
                      <div className="pd-form-row">
                        <label>Cashier Name</label>
                        <input value={ef('rCashierName')} onChange={(e) => setEf('rCashierName', e.target.value)} />
                      </div>
                    </div>
                  ) : null}
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Report Date From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Report Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                </>
              ) : null}

              {entryModal === 'counterCloseReportsRP' ? (
                <>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>Counter No</label>
                      <input value={ef('rCounterNo')} onChange={(e) => setEf('rCounterNo', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
                      Search
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>CounterNo</th>
                          <th>CloseDate</th>
                          <th>CloseTime</th>
                          <th>BillCount</th>
                          <th>CashSale</th>
                          <th>CreditSale</th>
                          <th>TotalOnline</th>
                          <th>TotalDiscount</th>
                          <th>TotalSale</th>
                          <th>CashToBeCollected</th>
                          <th>CollectedCash</th>
                          <th>CashDifference</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={12}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'pendingOrderList' ? (
                <>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Order Status</label>
                      <select value={ef('rOrderStatus') || 'PENDING'} onChange={(e) => setEf('rOrderStatus', e.target.value)}>
                        <option value="PENDING">PENDING</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="ALL">ALL</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Area</label>
                      <select value={ef('rArea') || 'ALL'} onChange={(e) => setEf('rArea', e.target.value)}>
                        <option value="ALL">ALL</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
                      Search
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Order No</th>
                          <th>Order Time</th>
                          <th>Table</th>
                          <th>Area</th>
                          <th>Waiter</th>
                          <th>Guests</th>
                          <th>SubTotal</th>
                          <th>Discount</th>
                          <th>Tax</th>
                          <th>Amount</th>
                          <th>Order Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={11}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'counterWiseA4' || entryModal === 'counterWiseTimewise' ? (
                <>
                  <div className="pd-form-row">
                    <label>Counter No</label>
                    <input value={ef('rCounterNo')} onChange={(e) => setEf('rCounterNo', e.target.value)} />
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Sales Date From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Sales Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                  {entryModal === 'counterWiseTimewise' ? (
                    <div className="pd-form-grid-2">
                      <div className="pd-form-row">
                        <label>From Time</label>
                        <input value={ef('rFromTime') || '5:00:00 AM'} onChange={(e) => setEf('rFromTime', e.target.value)} />
                      </div>
                      <div className="pd-form-row">
                        <label>To Time</label>
                        <input value={ef('rToTime') || '5:00:00 AM'} onChange={(e) => setEf('rToTime', e.target.value)} />
                      </div>
                    </div>
                  ) : null}
                  <Toggle checked={efBool('rSummaryOnly')} onChange={(v) => setEf('rSummaryOnly', v)} label="Sales Summary Only" />
                  <Toggle checked={efBool('rCashierWise')} onChange={(v) => setEf('rCashierWise', v)} label="Cashier Wise" />
                  <Toggle checked={efBool('rCounterOnly')} onChange={(v) => setEf('rCounterOnly', v)} label="Counter Only" />
                </>
              ) : null}

              {entryModal === 'itemwiseSummary' || entryModal === 'itemwiseDetails' ? (
                <>
                  <div className="pd-form-row">
                    <label>Group</label>
                    <select value={ef('rGroup')} onChange={(e) => setEf('rGroup', e.target.value)}>
                      <option value="">All Groups</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-row">
                    <label>SubGroup</label>
                    <select value={ef('rSubGroup')} onChange={(e) => setEf('rSubGroup', e.target.value)}>
                      <option value="">All Sub Groups</option>
                      {allSubGroups.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Report Date From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Report Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                  <Toggle checked={efBool('rCashierWise')} onChange={(v) => setEf('rCashierWise', v)} label="Cashier Wise" />
                  <Toggle checked={efBool('rReceiptPrinter')} onChange={(v) => setEf('rReceiptPrinter', v)} label="Receipt Printer" />
                </>
              ) : null}

              {entryModal === 'areawiseA4' ? (
                <>
                  <div className="pd-form-row">
                    <label>Location</label>
                    <select value={ef('rArea') || 'ALL'} onChange={(e) => setEf('rArea', e.target.value)}>
                      <option value="ALL">ALL</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Report Date from</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Report Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                  <Toggle checked={efBool('rSummaryOnly')} onChange={(v) => setEf('rSummaryOnly', v)} label="Summary" />
                </>
              ) : null}

              {entryModal === 'waiterwise' ? (
                <>
                  <div className="pd-form-row">
                    <label>Waiter</label>
                    <input value={ef('rWaiterName')} onChange={(e) => setEf('rWaiterName', e.target.value)} />
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Report Date From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Report date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                  <div className="pd-entry-radio-row">
                    <label className="pd-entry-radio">
                      <input
                        type="radio"
                        name="rDetailMode"
                        checked={ef('rDetailMode') === 'detailed'}
                        onChange={() => setEf('rDetailMode', 'detailed')}
                      />
                      Detailed
                    </label>
                    <label className="pd-entry-radio">
                      <input
                        type="radio"
                        name="rDetailMode"
                        checked={ef('rDetailMode') === 'summary'}
                        onChange={() => setEf('rDetailMode', 'summary')}
                      />
                      Summary
                    </label>
                  </div>
                </>
              ) : null}

              {entryModal === 'customerAnalysisDetailed' || entryModal === 'customerAnalysisSummary' ? (
                <>
                  <div className="pd-form-row">
                    <label>Area</label>
                    <select value={ef('rArea')} onChange={(e) => setEf('rArea', e.target.value)}>
                      <option value="">Select…</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Date From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                  {entryModal === 'customerAnalysisSummary' ? (
                    <Toggle checked={efBool('rSummaryOnly')} onChange={(v) => setEf('rSummaryOnly', v)} label="Summary" />
                  ) : null}
                </>
              ) : null}

              {entryModal === 'graphReport' ? (
                <>
                  <div className="pd-form-row">
                    <label>Counter No</label>
                    <input value={ef('rCounterNo')} onChange={(e) => setEf('rCounterNo', e.target.value)} />
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Sales Date From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Sales Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Report by</label>
                    <div className="pd-entry-radio-row">
                      {(['Hour', 'Day', 'Month'] as const).map((m) => (
                        <label key={m} className="pd-entry-radio">
                          <input
                            type="radio"
                            name="rReportBy"
                            checked={(ef('rReportBy') || 'Hour') === m}
                            onChange={() => setEf('rReportBy', m)}
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {entryModal === 'itemwiseViewer' ? (
                <>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>Counter No</label>
                      <select value={ef('rCounterNo')} onChange={(e) => setEf('rCounterNo', e.target.value)}>
                        <option value="">All</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={displayCreditList}>
                      Display
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Sl No</th>
                          <th>Barcode</th>
                          <th>Item Name</th>
                          <th>Group</th>
                          <th>SaleQty</th>
                          <th>TotalUnitPrice</th>
                          <th>Discount</th>
                          <th>SubTotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={8}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'delBoyCommission' ? (
                <div className="pd-mr-body">
                  <div className="pd-mr-groups">
                    {groups.length === 0 ? (
                      <p className="pd-cat-msg">No groups loaded</p>
                    ) : (
                      groups.map((g) => (
                        <label key={g.id} className="pd-mr-group-row">
                          <input
                            type="checkbox"
                            checked={mrSelectedGroups.has(g.id)}
                            onChange={() =>
                              setMrSelectedGroups((prev) => {
                                const next = new Set(prev)
                                if (next.has(g.id)) next.delete(g.id)
                                else next.add(g.id)
                                return next
                              })
                            }
                          />
                          {g.name}
                        </label>
                      ))
                    )}
                  </div>
                  <div className="pd-mr-filters">
                    <div className="pd-form-row">
                      <label>Commission %</label>
                      <div className="pd-form-computed">{ef('rCommission') || '3.5'}</div>
                    </div>
                    <div className="pd-form-row">
                      <label>Delivery Boy</label>
                      <select value={ef('rDeliveryBoy')} onChange={(e) => setEf('rDeliveryBoy', e.target.value)}>
                        <option value="">Select…</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Sales Date From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Sales Date To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                  </div>
                </div>
              ) : null}

              {entryModal === 'productMovementFast' || entryModal === 'productMovementSlow' ? (
                <>
                  <div className="pd-txn-search-row">
                    <div className="pd-form-row">
                      <label>From</label>
                      <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To</label>
                      <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Min</label>
                      <input value={ef('rMin')} onChange={(e) => setEf('rMin', e.target.value.replace(/[^\d]/g, ''))} />
                    </div>
                    <button type="button" className="pd-form-code-btn pd-txn-search-btn" onClick={searchTxnList}>
                      Search
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Group</th>
                          <th>Item Description</th>
                          <th>Unit Price</th>
                          <th>Total Qty Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'dayCloseReport' ? (
                <div className="pd-form-grid-2">
                  <div className="pd-form-row">
                    <label>Report Date From</label>
                    <DatePicker value={ef('rFrom')} onChange={(v) => setEf('rFrom', v)} max={ef('rTo')} />
                  </div>
                  <div className="pd-form-row">
                    <label>Report Date To</label>
                    <DatePicker value={ef('rTo')} onChange={(v) => setEf('rTo', v)} min={ef('rFrom')} />
                  </div>
                </div>
              ) : null}

              {entryModal === 'incomeExpenseEntry' ? (
                <>
                  <div className="pd-recipe-line-row">
                    <input placeholder="Account Name" value={td('accountName')} onChange={(e) => setTd('accountName', e.target.value)} />
                    <input placeholder="Remarks" value={td('remarks')} onChange={(e) => setTd('remarks', e.target.value)} />
                    <input placeholder="Taxable Amount" value={td('taxableAmount')} onChange={(e) => setTd('taxableAmount', e.target.value.replace(/[^\d.]/g, ''))} />
                    <select value={ef('ieTaxRate')} onChange={(e) => setEf('ieTaxRate', e.target.value)}>
                      <option value="0.00">0.00</option>
                      <option value="5.00">5.00</option>
                    </select>
                    <select value={ef('iePayType')} onChange={(e) => setEf('iePayType', e.target.value)}>
                      <option value="CASH">CASH</option>
                      <option value="CREDIT">CREDIT</option>
                    </select>
                    <select value={ef('ieType')} onChange={(e) => setEf('ieType', e.target.value)}>
                      <option value="INCOME">INCOME</option>
                      <option value="EXPENSE">EXPENSE</option>
                    </select>
                    <DatePicker value={ef('ieDate')} onChange={(v) => setEf('ieDate', v)} />
                    <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
                      Add
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Account Name</th>
                          <th>Remarks</th>
                          <th>Date</th>
                          <th>Pay Type</th>
                          <th>Taxable Amount</th>
                          <th>Tax Amt</th>
                          <th>{ef('ieType') === 'EXPENSE' ? 'Expence' : 'Income'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txnLines.length === 0 ? (
                          <tr>
                            <td colSpan={7}>No entries added</td>
                          </tr>
                        ) : (
                          txnLines.map((l, i) => {
                            const taxAmt = (Number(l.taxableAmount) || 0) * (Number(ef('ieTaxRate')) / 100)
                            return (
                              <tr
                                key={i}
                                className={txnSelected === i ? 'is-selected' : undefined}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setTxnSelected(i)}
                              >
                                <td>{l.accountName}</td>
                                <td>{l.remarks}</td>
                                <td>{ef('ieDate')}</td>
                                <td>{ef('iePayType')}</td>
                                <td>{l.taxableAmount}</td>
                                <td>{money(taxAmt)}</td>
                                <td>{money((Number(l.taxableAmount) || 0) + taxAmt)}</td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="pd-form-row">
                    <label>Total</label>
                    <div className="pd-form-computed">
                      AED {money(txnLines.reduce((sum, l) => sum + (Number(l.taxableAmount) || 0), 0))}
                    </div>
                  </div>
                </>
              ) : null}

              {entryModal === 'discountEntry' || entryModal === 'discountList' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Supplier</label>
                      <input value={ef('discSupplier')} onChange={(e) => setEf('discSupplier', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Product Brand</label>
                      <input value={ef('discBrand')} onChange={(e) => setEf('discBrand', e.target.value)} />
                    </div>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Group</label>
                      <select value={ef('discGroup')} onChange={(e) => setEf('discGroup', e.target.value)}>
                        <option value="">All Groups</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.name}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>SubGroup</label>
                      <select value={ef('discSubGroup')} onChange={(e) => setEf('discSubGroup', e.target.value)}>
                        <option value="">All Sub Groups</option>
                        {allSubGroups.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {entryModal === 'discountEntry' ? (
                    <div className="pd-form-grid-2">
                      <div className="pd-form-row">
                        <label>Discount Date From</label>
                        <DatePicker value={ef('discFrom')} onChange={(v) => setEf('discFrom', v)} max={ef('discTo')} />
                      </div>
                      <div className="pd-form-row">
                        <label>Discount Date To</label>
                        <DatePicker value={ef('discTo')} onChange={(v) => setEf('discTo', v)} min={ef('discFrom')} />
                      </div>
                    </div>
                  ) : null}
                  <div className="pd-form-code">
                    {entryModal === 'discountEntry' ? (
                      <input
                        placeholder="Discount Percentage"
                        value={ef('discPercent')}
                        onChange={(e) => setEf('discPercent', e.target.value.replace(/[^\d.]/g, ''))}
                      />
                    ) : null}
                    <button
                      type="button"
                      className="pd-form-code-btn"
                      onClick={entryModal === 'discountEntry' ? applyDiscountRange : searchTxnList}
                    >
                      {entryModal === 'discountEntry' ? 'Apply' : 'Search'}
                    </button>
                  </div>
                  {entryModal === 'discountEntry' ? (
                    <div className="pd-recipe-line-row">
                      <input placeholder="Barcode" value={td('barcode')} onChange={(e) => setTd('barcode', e.target.value)} />
                      <input placeholder="Short Description" value={td('shortDesc')} onChange={(e) => setTd('shortDesc', e.target.value)} />
                      <input placeholder="Pack Qty" value={td('packQty')} onChange={(e) => setTd('packQty', e.target.value)} />
                      <input placeholder="Selling Price" value={td('sellingPrice')} onChange={(e) => setTd('sellingPrice', e.target.value.replace(/[^\d.]/g, ''))} />
                      <input placeholder="Dis. Amt" value={td('disAmt')} onChange={(e) => setTd('disAmt', e.target.value.replace(/[^\d.]/g, ''))} />
                      <input placeholder="Disc. %" value={td('discPct')} onChange={(e) => setTd('discPct', e.target.value.replace(/[^\d.]/g, ''))} />
                      <button type="button" className="pd-form-code-btn" onClick={addTxnLine}>
                        Add
                      </button>
                    </div>
                  ) : null}
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Barcode</th>
                          <th>Short Description</th>
                          <th>Sell Price</th>
                          <th>Dis. Amt</th>
                          <th>Disc. %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entryModal === 'discountList' || txnLines.length === 0 ? (
                          <tr>
                            <td colSpan={5}>No discounts found</td>
                          </tr>
                        ) : (
                          txnLines.map((l, i) => (
                            <tr
                              key={i}
                              className={txnSelected === i ? 'is-selected' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setTxnSelected(i)}
                            >
                              <td>{l.barcode}</td>
                              <td>{l.shortDesc}</td>
                              <td>{l.sellingPrice}</td>
                              <td>{l.disAmt}</td>
                              <td>{l.discPct}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'changeSettlement' ? (
                <>
                  <div className="pd-form-grid-3">
                    <div className="pd-form-row">
                      <label>Bill No</label>
                      <input value={ef('csBillNo')} onChange={(e) => setEf('csBillNo', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Payment Mode</label>
                      <select value={ef('csPaymentMode')} onChange={(e) => setEf('csPaymentMode', e.target.value)}>
                        <option value="">Select…</option>
                        <option value="CASH">CASH</option>
                        <option value="CREDIT CARD">CREDIT CARD</option>
                        <option value="CREDIT">CREDIT</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Bill Date</label>
                      <DatePicker value={ef('csDate')} onChange={(v) => setEf('csDate', v)} />
                    </div>
                  </div>
                  <button type="button" className="pd-form-code-btn" onClick={searchTxnList}>
                    Search
                  </button>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Bill No</th>
                          <th>Bill Date</th>
                          <th>Bill Time</th>
                          <th>Payment Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4}>No records found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'vatActivation' ? (
                <div className="pd-vat-body">
                  <p className="pd-cat-msg">Click Setup VAT button to start VAT service</p>
                  <button type="button" className="pd-mod-foot-btn is-ok" onClick={setupVat}>
                    Setup VAT
                  </button>
                </div>
              ) : null}

              {entryModal === 'productListEdit' ? (
                <>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Group</label>
                      <select value={ef('pleGroup')} onChange={(e) => setEf('pleGroup', e.target.value)}>
                        <option value="">All Groups</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.name}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Sub Group</label>
                      <select value={ef('pleSubGroup')} onChange={(e) => setEf('pleSubGroup', e.target.value)}>
                        <option value="">All Sub Groups</option>
                        {allSubGroups.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pd-form-grid-2">
                    <div className="pd-form-row">
                      <label>Search Column</label>
                      <select value={ef('searchColumn')} onChange={(e) => setEf('searchColumn', e.target.value)}>
                        <option>Short Description</option>
                        <option>Barcode</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Search Value</label>
                      <input value={ef('searchValue')} onChange={(e) => setEf('searchValue', e.target.value)} />
                    </div>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Bar Code</th>
                          <th>Short Description</th>
                          <th>Qty on Hand</th>
                          <th>Unit Price</th>
                          <th>VAT (5%)</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allProducts
                          .filter((p) => !ef('pleGroup') || groups.find((g) => g.name === ef('pleGroup'))?.id === p.groupId)
                          .filter((p) => !ef('searchValue') || p.name.toLowerCase().includes(ef('searchValue').toLowerCase()))
                          .slice(0, 100)
                          .map((p) => (
                            <tr
                              key={p.id}
                              className={txnSelected === p.id ? 'is-selected' : undefined}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setTxnSelected(p.id)}
                            >
                              <td>—</td>
                              <td>{p.name}</td>
                              <td>—</td>
                              <td>{money(p.price)}</td>
                              <td>{money(p.taxAmount)}</td>
                              <td>{money(p.price + p.taxAmount)}</td>
                            </tr>
                          ))}
                        {allProducts.length === 0 ? (
                          <tr>
                            <td colSpan={6}>No products loaded</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'changeDiscountPercent' ? (
                <div className="pd-cdp-body">
                  <div className="pd-cdp-fields">
                    <div className="pd-form-row">
                      <label>Total Amount</label>
                      <input value={ef('cdpTotal')} onChange={(e) => setEf('cdpTotal', e.target.value.replace(/[^\d.]/g, ''))} />
                    </div>
                    <div className="pd-form-row">
                      <label>Discount Amount</label>
                      <input value={ef('cdpAmount')} readOnly />
                    </div>
                    <div className="pd-form-row">
                      <label>Disc Percentage</label>
                      <input value={ef('cdpPercent')} onChange={(e) => setEf('cdpPercent', e.target.value.replace(/[^\d.]/g, ''))} />
                    </div>
                    <div className="pd-form-row">
                      <label>Net Amount</label>
                      <div className="pd-form-computed">
                        AED {money((Number(ef('cdpTotal')) || 0) - (Number(ef('cdpAmount')) || 0))}
                      </div>
                    </div>
                  </div>
                  <div className="pd-cdp-presets">
                    {[5, 10, 25].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        className={`pd-cdp-preset${Number(ef('cdpPercent')) === pct ? ' is-on' : ''}`}
                        onClick={() => applyDiscountPercentPreset(pct)}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {entryModal === 'eventLogs' ? (
                <>
                  <div className="pd-el-stats">
                    <div className="pd-el-stat">
                      <span>Total Logs</span>
                      <strong>0</strong>
                    </div>
                    <div className="pd-el-stat">
                      <span>Success</span>
                      <strong>0</strong>
                    </div>
                    <div className="pd-el-stat">
                      <span>Failed</span>
                      <strong>0</strong>
                    </div>
                    <div className="pd-el-stat">
                      <span>Today</span>
                      <strong>0</strong>
                    </div>
                  </div>
                  <div className="pd-form-grid-3">
                    <div className="pd-form-row">
                      <label>From Date</label>
                      <DatePicker value={ef('elFrom')} onChange={(v) => setEf('elFrom', v)} max={ef('elTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>To Date</label>
                      <DatePicker value={ef('elTo')} onChange={(v) => setEf('elTo', v)} min={ef('elFrom')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Staff</label>
                      <input value={ef('elStaff')} onChange={(e) => setEf('elStaff', e.target.value)} />
                    </div>
                  </div>
                  <div className="pd-form-grid-3">
                    <div className="pd-form-row">
                      <label>Action</label>
                      <select value={ef('elAction')} onChange={(e) => setEf('elAction', e.target.value)}>
                        <option value="ALL">ALL</option>
                        <option value="CREATE">CREATE</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Source</label>
                      <select value={ef('elSource')} onChange={(e) => setEf('elSource', e.target.value)}>
                        <option value="ALL">ALL</option>
                        <option value="POS">POS</option>
                        <option value="BACKOFFICE">BACKOFFICE</option>
                      </select>
                    </div>
                    <div className="pd-form-row">
                      <label>Status</label>
                      <select value={ef('elStatus')} onChange={(e) => setEf('elStatus', e.target.value)}>
                        <option value="ALL">ALL</option>
                        <option value="SUCCESS">SUCCESS</option>
                        <option value="FAILED">FAILED</option>
                      </select>
                    </div>
                  </div>
                  <div className="pd-form-code">
                    <SearchBar
                      size="sm"
                      placeholder="Search logs"
                      value={ef('elSearch')}
                      onValueChange={(v) => setEf('elSearch', v)}
                      onSubmit={() => searchEventLogs()}
                    />
                    <button type="button" className="pd-form-code-btn" onClick={searchEventLogs}>
                      Search
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => setEntryForm({})}>
                      Clear
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => toast('Logs refreshed', 'success')}>
                      Refresh
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={() => toast('Exported', 'success')}>
                      Export
                    </button>
                    <button type="button" className="pd-form-code-btn" onClick={printReport}>
                      Print
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>LogID</th>
                          <th>LoggedAt</th>
                          <th>ActionCode</th>
                          <th>ActionLabel</th>
                          <th>EntityType</th>
                          <th>CounterNo</th>
                          <th>StaffName</th>
                          <th>Success</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={8}>No log entries found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'printerSetup' ? (
                <>
                  <div className="pd-recipe-line-row">
                    <input placeholder="Counter No" value={td('counterNo')} onChange={(e) => setTd('counterNo', e.target.value)} />
                    <input placeholder="Kitchen Loc Name" value={td('kitchenLoc')} onChange={(e) => setTd('kitchenLoc', e.target.value)} />
                    <input placeholder="Printer Name" value={td('printerName')} onChange={(e) => setTd('printerName', e.target.value)} />
                    <button type="button" className="pd-form-code-btn" onClick={addPrinterRow}>
                      Add
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>Counter No</th>
                          <th>Kitchen Loc Name</th>
                          <th>Printer Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printerRows.length === 0 ? (
                          <tr>
                            <td colSpan={3}>No printers configured</td>
                          </tr>
                        ) : (
                          printerRows.map((r, i) => (
                            <tr key={i}>
                              <td>{r.counterNo}</td>
                              <td>{r.kitchenLoc}</td>
                              <td>{r.printerName}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="pd-txn-count">
                    NOPRINTER—ID Will be (99)
                    <br />
                    SEPERATE KOT PRINTER FOR DELIVERY—ID Will be (98)
                    <br />
                    DUPLICATE KOT PRINTER—ID Will be (97)
                    <br />
                    Seperate KOT PRINTER for TakeAway—ID Will be (96)
                  </p>
                </>
              ) : null}

              {entryModal === 'userList' || entryModal === 'activateAccessCard' ? (
                <div className="pd-grid-wrap">
                  <table className="pd-grid">
                    <thead>
                      {entryModal === 'activateAccessCard' ? (
                        <tr>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Login</th>
                          <th>Card</th>
                        </tr>
                      ) : (
                        <tr>
                          <th>User Code</th>
                          <th>User Name</th>
                          <th>User Role</th>
                          <th>Login Name</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {(entryModal === 'activateAccessCard' ? userListRows.filter((u) => u.role === 'ADMIN') : userListRows).map(
                        (u) => (
                          <tr
                            key={u.code}
                            className={userListSelected === u.code ? 'is-selected' : undefined}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setUserListSelected(u.code)}
                          >
                            <td>{u.code}</td>
                            <td>{u.name}</td>
                            <td>{u.role}</td>
                            <td>{u.login}</td>
                            {entryModal === 'activateAccessCard' ? <td>{u.card}</td> : null}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                  {entryModal === 'activateAccessCard' ? (
                    <p className="pd-txn-count">
                      Select an ADMIN / CHIEF CASHIER, then tap the access card. Card number is never shown.
                      <br />
                      Selected: {userListRows.find((u) => u.code === userListSelected)?.name ?? '—'} — Card:{' '}
                      {userListRows.find((u) => u.code === userListSelected)?.card ?? '—'}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {entryModal === 'privilegeSetup' ? (
                <>
                  <div className="pd-form-row">
                    <label>User Name</label>
                    <select value={ef('privUser')} onChange={(e) => setEf('privUser', e.target.value)}>
                      {userListRows.map((u) => (
                        <option key={u.code} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-priv-tree">
                    {[
                      'Masters', 'Amentment', 'Transaction', 'Reprint', 'Credit',
                      'Reports', 'ReportsA4', 'Admin', 'Settings', 'Purchase',
                    ].map((page) => (
                      <label key={page} className="pd-priv-row">
                        <input type="checkbox" checked={privilegeChecks.has(page)} onChange={() => togglePrivilege(page)} />
                        Menu Page - {page}
                      </label>
                    ))}
                    <label className="pd-priv-row">
                      <input type="checkbox" checked={privilegeChecks.has('Main Page')} onChange={() => togglePrivilege('Main Page')} />
                      Main Page
                    </label>
                  </div>
                </>
              ) : null}

              {entryModal === 'controlPanel' ? (
                <>
                  <div className="pd-cp-tabs">
                    {['Company Details', 'Main Form', 'KOT', 'Bill', 'Mail Sending', 'General', 'Game Zone', 'Tax Settings'].map(
                      (tab) => (
                        <button
                          key={tab}
                          type="button"
                          className={`pd-cp-tab${controlPanelTab === tab ? ' is-on' : ''}`}
                          onClick={() => setControlPanelTab(tab)}
                        >
                          {tab}
                        </button>
                      ),
                    )}
                  </div>
                  {controlPanelTab === 'Company Details' ? (
                    <>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div className="pd-form-row" key={n}>
                          <label>Heading{n}</label>
                          <input value={ef(`cpHeading${n}`)} onChange={(e) => setEf(`cpHeading${n}`, e.target.value)} />
                        </div>
                      ))}
                      <div className="pd-form-row">
                        <label>Tax Reg. No</label>
                        <input value={ef('cpTaxRegNo')} onChange={(e) => setEf('cpTaxRegNo', e.target.value)} />
                      </div>
                      <div className="pd-form-row">
                        <label>Footer1</label>
                        <input value={ef('cpFooter1')} onChange={(e) => setEf('cpFooter1', e.target.value)} />
                      </div>
                      <div className="pd-form-row">
                        <label>Footer2</label>
                        <input value={ef('cpFooter2')} onChange={(e) => setEf('cpFooter2', e.target.value)} />
                      </div>
                    </>
                  ) : (
                    <p className="pd-cat-msg">{controlPanelTab} settings — coming soon</p>
                  )}
                </>
              ) : null}

              {entryModal === 'passwordChange' ? (
                <>
                  <div className="pd-form-row">
                    <label>Login Name</label>
                    <input value={ef('pcLogin')} onChange={(e) => setEf('pcLogin', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Password</label>
                    <input type="password" value={ef('pcPassword')} onChange={(e) => setEf('pcPassword', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>New Password</label>
                    <input type="password" value={ef('pcNewPassword')} onChange={(e) => setEf('pcNewPassword', e.target.value)} />
                  </div>
                  <div className="pd-form-row">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      value={ef('pcConfirmPassword')}
                      onChange={(e) => setEf('pcConfirmPassword', e.target.value)}
                    />
                  </div>
                </>
              ) : null}

              {entryModal === 'langSetup' ? (
                <>
                  <div className="pd-recipe-line-row">
                    <input
                      placeholder="English Description"
                      value={td('enText')}
                      onChange={(e) => setTdWithArabicAutoFill('enText', 'arText', e.target.value)}
                    />
                    <ArabicInput placeholder="Arabic Description" value={td('arText')} onValueChange={(v) => setTd('arText', v)} source={td('enText')} onTranslateError={notifyTranslateDown} />
                    <button type="button" className="pd-form-code-btn" onClick={addLangRow}>
                      Add
                    </button>
                  </div>
                  <div className="pd-grid-wrap">
                    <table className="pd-grid">
                      <thead>
                        <tr>
                          <th>English Description</th>
                          <th>Arabic Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {langRows.length === 0 ? (
                          <tr>
                            <td colSpan={2}>No entries added</td>
                          </tr>
                        ) : (
                          langRows.map((r, i) => (
                            <tr key={i}>
                              <td>{r.en}</td>
                              <td dir="rtl">{r.ar}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {entryModal === 'partyOrderList' ? (
                <div className="pd-poi-body">
                  <div className="pd-poi-main">
                    <div className="pd-grid-wrap">
                      <table className="pd-grid">
                        <thead>
                          <tr>
                            <th>Order No.</th>
                            <th>Order Date</th>
                            <th>Customer Name</th>
                            <th>Amount</th>
                            <th>Advance Paid</th>
                            <th>Balance Amount</th>
                            <th>Delivery Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan={8}>No party orders found</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="pd-txn-search-row">
                      <button type="button" className="pd-form-code-btn" onClick={() => toast('Refreshed', 'success')}>
                        Refresh
                      </button>
                      <div className="pd-form-row">
                        <label>Order Status</label>
                        <select value={ef('poiStatus')} onChange={(e) => setEf('poiStatus', e.target.value)}>
                          <option value="">All</option>
                          <option value="PENDING">PENDING</option>
                          <option value="READY">READY</option>
                        </select>
                      </div>
                      <button type="button" className="pd-form-code-btn" onClick={searchTxnList}>
                        Search
                      </button>
                    </div>
                  </div>
                  <div className="pd-poi-side">
                    <p className="pd-poi-title">Customer Details</p>
                    <div className="pd-form-row">
                      <label>Name</label>
                      <input value={ef('poiName')} onChange={(e) => setEf('poiName', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Address</label>
                      <input value={ef('poiAddress')} onChange={(e) => setEf('poiAddress', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Area</label>
                      <input value={ef('poiArea')} onChange={(e) => setEf('poiArea', e.target.value)} />
                    </div>
                    <div className="pd-form-row">
                      <label>Phone No</label>
                      <input value={ef('poiPhone')} onChange={(e) => setEf('poiPhone', e.target.value)} />
                    </div>
                    <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Order marked ready', 'success')}>
                      Order Ready
                    </button>
                    <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Settlement — coming soon', 'info')}>
                      Settlement
                    </button>
                    <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
                      Bill Reprint
                    </button>
                  </div>
                </div>
              ) : null}

              {entryModal === 'multiSupplierSetup' ? (
                <p className="pd-cat-msg">No additional suppliers configured yet</p>
              ) : null}

              {entryModal === 'vatCorrectionUtility' ? (
                <div className="pd-vcu-body">
                  <div className="pd-vcu-fields">
                    <div className="pd-form-row">
                      <label>Date From</label>
                      <DatePicker value={ef('vcFrom')} onChange={(v) => setEf('vcFrom', v)} max={ef('vcTo')} />
                    </div>
                    <div className="pd-form-row">
                      <label>Date To</label>
                      <DatePicker value={ef('vcTo')} onChange={(v) => setEf('vcTo', v)} min={ef('vcFrom')} />
                    </div>
                    <p className="pd-vcu-warn">Delete Trigger From Sales Child And purchase Child</p>
                  </div>
                  <div className="pd-vcu-actions">
                    <button type="button" className="pd-mod-foot-btn is-ok" onClick={deliveryZeroClear}>
                      Delivery Zero Clear
                    </button>
                    <button type="button" className="pd-mod-foot-btn is-ok" onClick={salesVariationCorrection}>
                      Sales Variation Correction
                    </button>
                  </div>
                </div>
              ) : null}

              {entryModal === 'cashInOut' && cashMode === 'pick' ? (
                <div className="pd-cash-pick">
                  <button type="button" className="pd-cash-pick-btn" onClick={() => openCashMode('in')}>
                    CASH IN
                  </button>
                  <button type="button" className="pd-cash-pick-btn" onClick={() => openCashMode('out')}>
                    CASH OUT
                  </button>
                </div>
              ) : null}

              {entryModal === 'cashInOut' && cashMode !== 'pick' ? (
                <div className="pd-cash-entry">
                  <h3 className="pd-cash-entry-title">{cashMode === 'in' ? 'Cash IN Entry' : 'Cash Out Entry'}</h3>
                  <div className="pd-cash-entry-top">
                    <div className="pd-form-row" style={{ flex: 1 }}>
                      <label>Type Description</label>
                      <input value={ef('cashDesc')} onChange={(e) => setEf('cashDesc', e.target.value)} />
                    </div>
                    <span className="pd-cash-tag">Cash</span>
                  </div>
                  <div className="pd-cash-entry-body">
                    <div className="pd-grid-wrap pd-cash-list">
                      <table className="pd-grid">
                        <thead>
                          <tr>
                            <th>Account Name</th>
                            <th>{cashMode === 'in' ? 'Cash In Amount' : 'CashOut Amount'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashRows.length === 0 ? (
                            <tr>
                              <td colSpan={2}>No entries yet</td>
                            </tr>
                          ) : (
                            cashRows.map((r, i) => (
                              <tr key={i}>
                                <td>{r.desc || '—'}</td>
                                <td>{money(r.amount)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="pd-cash-quick">
                      {Array.from(new Set(cashRows.map((r) => r.desc).filter(Boolean)))
                        .slice(0, 8)
                        .map((d) => (
                          <button key={d} type="button" className="pd-cash-quick-btn" onClick={() => setEf('cashDesc', d)}>
                            {d}
                          </button>
                        ))}
                      {cashRows.length === 0 ? <p className="pd-cat-msg">No recent descriptions yet</p> : null}
                    </div>
                    <div className="pd-cash-keys">
                      <input className="pd-cash-amount-display" value={ef('cashAmount')} readOnly placeholder="0" />
                      <NumberKeypad className="pd-keys" onKey={onCashKey} />
                      <button type="button" className="pd-cash-enter" onClick={() => void addCashMovement()}>
                        Enter
                      </button>
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Total Amount</label>
                    <div className="pd-form-computed">AED {money(cashRows.reduce((sum, r) => sum + r.amount, 0))}</div>
                  </div>
                </div>
              ) : null}
            </div>

            {(() => {
              const foot = renderEntryFooter()
              return foot ? <div className="pd-mod-foot">{foot}</div> : null
            })()}
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
              <div className="pd-ord-toolbar">
                <div className="pd-ord-tabs" role="tablist" aria-label="Order type">
                  {([
                    ['ALL', 'All Orders', ClipboardList],
                    ['DINE IN', 'Dine In', Utensils],
                    ['TAKEAWAY', 'Takeaway', ShoppingBag],
                    ['DELIVERY', 'Delivery', Truck],
                  ] as const).map(([s, label, Icon]) => (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={orderListSupply === s}
                      className={`pd-ord-tab${orderListSupply === s ? ' is-on' : ''}`}
                      onClick={() => {
                        setOrderListSupply(s)
                        void loadOrderList(s, orderListSearch)
                      }}
                    >
                      <Icon size={14} strokeWidth={2.2} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <SearchBar
                  size="sm"
                  className="pd-ord-search"
                  value={orderListSearch}
                  onValueChange={setOrderListSearch}
                  onSubmit={(v) => void loadOrderList(orderListSupply, v)}
                  onClear={() => void loadOrderList(orderListSupply, '')}
                  placeholder="Search KOT number"
                />
              </div>

              {orderListState === 'idle' && orderListRows.length > 0 ? (
                <div className="pd-ord-summary">
                  <span>
                    <b>{orderListRows.length}</b> open {orderListRows.length === 1 ? 'order' : 'orders'}
                  </span>
                  <span>
                    Total <b>AED {money(orderListRows.reduce((sum, r) => sum + r.amount, 0))}</b>
                  </span>
                </div>
              ) : null}

              <div className="pd-ord-grid">
                {orderListState === 'loading' ? <p className="pd-ord-empty">Loading orders…</p> : null}
                {orderListState === 'error' ? <p className="pd-ord-empty is-error">{orderListError}</p> : null}
                {orderListState === 'idle' && orderListRows.length === 0 ? (
                  <div className="pd-ord-empty">
                    <ClipboardList size={28} strokeWidth={1.6} />
                    <b>No open orders</b>
                    <span>{orderListSearch.trim() ? 'Nothing matches that KOT number.' : 'Saved KOTs will show up here.'}</span>
                  </div>
                ) : null}
                {orderListRows.map((row) => {
                  const mins = kotAgeMinutes(row.kotTime)
                  const SupplyIcon = row.supplyType === 'DELIVERY' ? Truck : row.supplyType === 'TAKEAWAY' ? ShoppingBag : Utensils
                  return (
                    <button
                      key={row.kotMasterId}
                      type="button"
                      className={`pd-ord-card${mins != null && mins >= 30 ? ' is-late' : ''}`}
                      disabled={loadingKot}
                      onClick={() => void takeOrder(row.kotMasterId, false)}
                    >
                      <span className="pd-ord-top">
                        <span className="pd-ord-kot">
                          <small>KOT</small>
                          {row.kotNo}
                        </span>
                        <span className="pd-ord-type">
                          <SupplyIcon size={12} strokeWidth={2.4} />
                          {row.supplyType === 'TAKEAWAY' ? 'Takeaway' : row.supplyType === 'DELIVERY' ? 'Delivery' : 'Dine In'}
                        </span>
                      </span>

                      <span className="pd-ord-time">
                        <Clock size={12} />
                        {mins == null ? formatKotClock(row.kotTime) : mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`}
                      </span>

                      <span className="pd-ord-info">
                        <span>
                          <MapPinned size={12} />
                          {row.tableName ? `Table ${row.tableName}` : 'No table'}
                          {row.areaName ? <em> · {row.areaName}</em> : null}
                        </span>
                        <span>
                          <Users size={12} />
                          {row.pax || 0} pax
                        </span>
                        <span>
                          <User size={12} />
                          {row.waiterName || waiter}
                        </span>
                      </span>

                      {row.remarks ? (
                        <span className="pd-ord-note">
                          <MessageSquare size={11} />
                          {row.remarks}
                        </span>
                      ) : null}

                      <span className="pd-ord-foot">
                        <span className="pd-ord-amt">
                          <small>AED</small>
                          {money(row.amount)}
                        </span>
                        <span className="pd-ord-open">
                          Open <ArrowRight size={13} strokeWidth={2.4} />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
