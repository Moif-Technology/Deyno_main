import { type ComponentType } from 'react'
import {
  Plus,
  Pencil,
  Factory,
  ArrowLeftRight,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Settings as SettingsIcon,
  MapPinned,
  Utensils,
  Tag,
  Hash,
  SeparatorHorizontal,
  MessageSquare,
  Merge,
  ClipboardList,
  ScanBarcode,
  FileText,
  Globe,
  Wallet,
  Users,
  Gift,
  CircleCheck,
  Repeat,
  SlidersHorizontal,
  RotateCcw,
  Package,
  ShoppingBag,
  Truck,
  User,
  Ban,
  Banknote,
  Printer,
  Receipt,
  Percent,
} from 'lucide-react'
import { type NavMenuEntry, type EntryKey } from './posTypes'

export const NAV = ['Creation', 'Edit', 'Manufacturing', 'Transactions', 'Credit', 'Reports', 'Admin', 'Settings'] as const

export const NAV_ICON: Record<(typeof NAV)[number], ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Creation: Plus,
  Edit: Pencil,
  Manufacturing: Factory,
  Transactions: ArrowLeftRight,
  Credit: CreditCard,
  Reports: BarChart3,
  Admin: ShieldCheck,
  Settings: SettingsIcon,
}

export const NAV_MENUS: Partial<Record<(typeof NAV)[number], readonly NavMenuEntry[]>> = {
  Creation: [
    'Product Entry',
    'Area Entry',
    'Table Entry',
    'Main Group Entry',
    'Group Entry',
    'Sub Group Entry',
    'Kitchen Message',
    'Combo',
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
    'Mess List',
  ],
  Manufacturing: [
    'Recipe Entry',
    'Recipe List',
    'Production Entry',
    'Production List',
  ],
  Transactions: [
    'Stock Adjustment',
    'Stock Adjust List',
    'Opening Stock Entry',
    'Stock report',
    'Movement Report',
    {
      label: 'Product Transfer/Receive',
      children: ['Product Request', 'Product receipt', 'Product Transfer', 'Transfer List', 'Receipt List'],
    },
    { label: 'Purchase', children: ['SupplierList', 'Purchase entry', 'Purchase List', 'Purchase Return', 'Purchase ReturnList'] },
    'Damage Entry',
    'Damage List',
    'Additional Stock Entry',
    'Additional Stock List',
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

/** The side-nav section (Creation, Transactions, …) a menu label lives
 * under, for modal header kickers. Falls back to 'Creation'. */
export function navSectionOf(label: string): string {
  const has = (entries: readonly NavMenuEntry[]): boolean =>
    entries.some((e) =>
      typeof e === 'string' ? e === label : e.label === label || ('children' in e && has(e.children)),
    )
  const hit = NAV.find((section) => {
    const menu = NAV_MENUS[section]
    return menu ? has(menu) : false
  })
  return hit ?? 'Creation'
}

/** Backing config for the generic master-entry modals opened from the
 * "Creation" side-nav (everything except Product Entry, which reuses the
 * dedicated Add New Item modal). Header icon + title come from here so the
 * modal heading always matches the side-menu label that opened it. */
export const ENTRY_DEFS: { key: EntryKey; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
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
  { key: 'productionList', label: 'Production List', icon: ClipboardList },
  { key: 'comboEdit', label: 'Combo Edit', icon: Pencil },
  { key: 'messList', label: 'Mess List', icon: ClipboardList },
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
  { key: 'taxReport', label: 'Tax Report', icon: Percent },
  { key: 'vatSale', label: 'Vat Sale', icon: Percent },
  { key: 'vatPurchase', label: 'Vat Purchase', icon: Percent },
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
export const AMBIGUOUS_LABELS = new Set(['Summary'])

export const LABEL_TO_ENTRY: Partial<Record<string, EntryKey>> = {
  ...Object.fromEntries(ENTRY_DEFS.filter((d) => !AMBIGUOUS_LABELS.has(d.label)).map((d) => [d.label, d.key])),
  // The "Production" submenu's child is just "Entry" in the nav tree — the
  // modal heading reads "Production Entry" (ENTRY_DEFS.label above) for
  // clarity, but the click target's actual text is the bare word.
  Entry: 'productionEntry',
}

/** Resolves an ambiguous leaf label (in AMBIGUOUS_LABELS) using a substring
 * of its full nav path instead. Checked before the plain LABEL_TO_ENTRY
 * lookup whenever the label alone isn't enough to know which screen. */
export const AMBIGUOUS_LABEL_ROUTES: { label: string; pathIncludes: string; key: EntryKey }[] = [
  { label: 'Summary', pathIncludes: 'Itemwise', key: 'itemwiseSummary' },
  { label: 'Summary', pathIncludes: 'Customer Analysis', key: 'customerAnalysisSummary' },
]

export const ENTRY_META: Record<EntryKey, (typeof ENTRY_DEFS)[number]> = Object.fromEntries(
  ENTRY_DEFS.map((d) => [d.key, d]),
) as Record<EntryKey, (typeof ENTRY_DEFS)[number]>
