

/** A nav dropdown item is either a plain leaf, a leaf that shows a chevron
 * but has no known submenu yet (so no flyout box), or a real flyout parent —
 * whose children can themselves be any of these, for multi-level flyouts. */
export type NavMenuEntry = string | { label: string; arrow: true } | { label: string; children: readonly NavMenuEntry[] }

export type Cat = { id: number; name: string; code: string }

export type SubCat = { id: number; name: string; groupId: number }

export type SubSubCat = { id: number; name: string; subGroupId: number }

export type ProductTile = {
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
  applyDiscount: boolean
}

/** "Add New Item" / edit-product modal draft — all number-ish fields stay
 * as strings while editing so the input can be blank/partial mid-type. */
export type ProductForm = {
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
  /** Price levels 1–5, entered VAT-inclusive. */
  priceLevels: string[]
  /** Edit only: saved fields this modal doesn't show, sent back unchanged on update. */
  keep: Record<string, unknown>
}

export type TicketLine = {
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
  applyDiscount: boolean
}

export type ModifierPreset = { id: number; name: string; arabic: string }

/** One variant type of a product (e.g. "Size") and its options (Small, Medium, Large). */
export type VariantGroup = { type: string; options: string[] }

export type AreaRow = {
  id: number
  name: string
  supplyType: string
  kotPrefix: string
  tableCreationType: number
}

export type TableRow = { id: number; name: string; areaId: number; seats: number; waiterId: number; tableNo?: number; format?: string }

/** Nav-menu entries under "Creation"/"Transactions" that open a simple
 * master-entry modal instead of a bespoke screen. 'product' (Product Entry)
 * reuses the existing Add New Item modal and isn't part of this generic set. */
export type EntryKey =
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
  | 'productionList'
  | 'comboEdit'
  | 'messList'
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
  | 'taxReport'
  | 'vatSale'
  | 'vatPurchase'
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

export type RecipeLine = {
  code: string
  name: string
  packDetails: string
  cost: string
  packQty: string
  qty: string
  unit: string
}

export type BookingRow = {
  id: number
  area: string
  customer: string
  mobile: string
  partySize: string
  advance: string
  date: string
}

export type OrderRow = {
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

export type OccupiedKot = {
  kotMasterId: number
  tableId: number
  chairNo: number
  kotNo: string
  waiterId: number
  pax: number
  remarks: string
}

export type ServiceKind = 'DINE IN' | 'TAKEAWAY' | 'DELIVERY'

export type CustomerPick = {
  id: number
  name: string
  mobile: string
  telephone: string
  code: string
  city?: string
  address?: string
}

export type AdminCreds = { username: string; password: string }

export type AdminNext = 'item-remove' | 'bill-confirm' | 'return' | 'item-qty' | 'counter-close-all' | 'price-change' | 'area-change' | 'discount' | 'bill-print' | 'kot-join'

export type AlertKind = 'info' | 'success' | 'warning' | 'question'

export type AlertBox = { kind: AlertKind; title: string; message: string }
