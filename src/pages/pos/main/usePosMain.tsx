import { useUiZoom, uiZoom } from '../../../utils/useUiZoom'
import { useNavigate } from 'react-router-dom'
import { getEnrollment } from '../../../utils/deviceEnrollment'
import { SessionManager } from '../../../utils/sessionManager'
import { useRef, useState, useMemo, useEffect, type KeyboardEvent } from 'react'
import { type StockDocType } from '../StockEntryDialog'
import { type ToastKind } from '../../../components/common/Toast'
import { getPosSession } from '../../../utils/posSession'
import { type SearchSelectOption } from '../../../components/common/SearchSelect'
import { type SettlementBill, type SettlementDone } from '../SettlementScreen'
import { apiService } from '../../../api/apiService'
import { printSettlementBill, printViewerBill } from '../../../lib/printSettlementBill'
import { decimal, phoneError } from '../../../utils/validate'
import { translateToArabic } from '../../../utils/translate'
import { type GlobalSearchItem } from '../../../components/common/GlobalSearch'
import { MapPinned, Receipt, ClipboardList, Users, Plus, ChevronRight, Search } from 'lucide-react'
import { DateRangePicker } from '../../../components/common/DateRangePicker'
import { NAV, AMBIGUOUS_LABELS, AMBIGUOUS_LABEL_ROUTES, LABEL_TO_ENTRY, NAV_MENUS, NAV_ICON } from './posMenu'
import {
  type ProductTile,
  type VariantGroup,
  type Cat,
  type SubCat,
  type SubSubCat,
  type ModifierPreset,
  type AlertBox,
  type TicketLine,
  type ServiceKind,
  type AreaRow,
  type TableRow,
  type OrderRow,
  type AdminNext,
  type AdminCreds,
  type CustomerPick,
  type ProductForm,
  type EntryKey,
  type RecipeLine,
  type BookingRow,
  type OccupiedKot,
  type NavMenuEntry,
} from './posTypes'
import {
  loadVariantMap,
  BLANK_PRODUCT_FORM,
  PRIVILEGE_PAGES,
  mapGroups,
  mapProducts,
  mapSubGroups,
  mapSubSubGroups,
  mapAreas,
  asRow,
  num,
  areaNameKey,
  normalizeSupply,
  isoDate,
  calcKotTotals,
  round2,
  notAllowedItemDiscountCount,
  isFlpArea,
  kotPrintStatus,
  reapplyLineDiscount,
  calcLine,
  mapModifiers,
  money,
  isChiefCashierOrAdmin,
  itemDiscountAllowed,
  errMessage,
  flagApplyDiscount,
  kotDetailsRows,
  areaMatchesService,
  pickDefaultTable,
  mapOrderRows,
  inferAlertTitle,
  kotHeaderRemarks,
  taxRatesDiffer,
  allowedItemDiscountCount,
  allowedItemDiscountTotal,
  currentItemDiscountPercent,
  clearAllItemDiscountRows,
  splitDiscountAmountToItems,
  AREA_PALETTE,
  areaSwatch,
  prefillFromCustomerSearch,
  formNum,
  menuGroupCode,
  VARIANT_STORE,
  categoryIcon,
} from './posHelpers'
import { NavMenuInline } from './posWidgets'

/** Everything the POS main page knows and can do: its state, derived values and
 * handlers. The screens (home/, order/, side-menu/) only render what this returns. */
export function usePosMain() {
  useUiZoom()
  const navigate = useNavigate()
  const enrollment = getEnrollment()
  const waiter = SessionManager.staffName || 'ADMIN'
  const counter = enrollment?.stationName || 'Counter 01'
  const lineKey = useRef(1)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const modifierTextRef = useRef<HTMLTextAreaElement | null>(null)

  const [nav, setNav] = useState<(typeof NAV)[number]>('Creation')
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false)
  const [, setReportViewersOpen] = useState(false)
  const [salesViewerOpen, setSalesViewerOpen] = useState(false)
  const [variantFor, setVariantFor] = useState<{ p: ProductTile; x: number; y: number; step: number; picked: string[] } | null>(null)
  const [variantMap, setVariantMap] = useState<Record<string, VariantGroup[]>>(loadVariantMap)
  const [variantDraft, setVariantDraft] = useState<VariantGroup[]>([])
  const [stockReportOpen, setStockReportOpen] = useState(false)
  const [movementReportOpen, setMovementReportOpen] = useState(false)
  const [stockDocType, setStockDocType] = useState<StockDocType>('ADJ')
  const [stockEntryOpen, setStockEntryOpen] = useState(false)
  const [stockListOpen, setStockListOpen] = useState(false)
  const [stockEntryId, setStockEntryId] = useState<number | null>(null)
  const [recipeEntryOpen, setRecipeEntryOpen] = useState(false)
  const [productionEntryOpen, setProductionEntryOpen] = useState(false)
  const [openingStockOpen, setOpeningStockOpen] = useState(false)
  /** Product Request / Receipt / Transfer dialog (TransferDocDialog), or null when closed. */
  const [transferDoc, setTransferDoc] = useState<'request' | 'receipt' | 'transfer' | null>(null)
  /** Purchase Entry / Return dialog (PurchaseEntryDialog), or null when closed. */
  const [purchaseMode, setPurchaseMode] = useState<'purchase' | 'return' | null>(null)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [discountEntryOpen, setDiscountEntryOpen] = useState(false)
  const [recipeListOpen, setRecipeListOpen] = useState(false)
  const [recipeProductId, setRecipeProductId] = useState<number | null>(null)
  const [productListOpen, setProductListOpen] = useState(false)
  const [counterCloseOpen, setCounterCloseOpen] = useState(false)
  const [counterCloseMode, setCounterCloseMode] = useState<'cashier' | 'admin'>('cashier')
  const [entryMenuOpen, setEntryMenuOpen] = useState(false)
  const [areaMasterOpen, setAreaMasterOpen] = useState(false)
  const [tableMasterOpen, setTableMasterOpen] = useState(false)
  const [floorDesignOpen, setFloorDesignOpen] = useState(false)
  const [groupEditOpen, setGroupEditOpen] = useState(false)
  const [subGroupEditOpen, setSubGroupEditOpen] = useState(false)
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
  const [discChangeOpen, setDiscChangeOpen] = useState(false)
  const [discChangeKey, setDiscChangeKey] = useState<number | null>(null)
  const [discChangeNew, setDiscChangeNew] = useState('')
  const discChangeRef = useRef<HTMLInputElement | null>(null)
  const [movePicker, setMovePicker] = useState<{ key: number } | null>(null)
  const [moving, setMoving] = useState(false)
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
  const printBillRef = useRef<() => void>(() => {})
  const adminPasswordRef = useRef<HTMLInputElement | null>(null)
  const customerSearchRef = useRef<HTMLInputElement | null>(null)
  const orderListSearchRef = useRef<HTMLInputElement | null>(null)
  const customerMobileRef = useRef<HTMLInputElement | null>(null)
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const [kotTime, setKotTime] = useState('')
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
  const [customerCode, setCustomerCode] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [customerTelephone, setCustomerTelephone] = useState('')
  const [customerCity, setCustomerCity] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [orderWaiterName, setOrderWaiterName] = useState('')
  const [waiterId, setWaiterId] = useState(() => getPosSession().staffId)
  const [clearAfterKotSave, setClearAfterKotSave] = useState(0)
  const [waiterMandatory, setWaiterMandatory] = useState(0)
  const [savingKot, setSavingKot] = useState(false)
  const [loadingKot, setLoadingKot] = useState(false)
  const [orderListOpen, setOrderListOpen] = useState(false)
  const deliveryPickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [kotJoinOpen, setKotJoinOpen] = useState(false)
  const [orderListRows, setOrderListRows] = useState<OrderRow[]>([])
  const [orderListState, setOrderListState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [orderListError, setOrderListError] = useState<string | null>(null)
  const [orderListSearch, setOrderListSearch] = useState('')
  const [orderListSupply, setOrderListSupply] = useState<'ALL' | ServiceKind>('ALL')
  const [orderListAreaId, setOrderListAreaId] = useState(0)
  const [orderListSelectedId, setOrderListSelectedId] = useState(0)
  // Order List drag-to-join: drag one KOT card onto another to join it.
  const [dragJoin, setDragJoin] = useState<{ sourceId: number; x: number; y: number; overId: number } | null>(null)
  const dragJoinStart = useRef<{ id: number; x: number; y: number; pointerId: number } | null>(null)
  const [dragJoinPlan, setDragJoinPlan] = useState<{ source: OrderRow; target: OrderRow; pax: string } | null>(null)
  const [dragJoinConfirm, setDragJoinConfirm] = useState(false)
  const [dragJoinBusy, setDragJoinBusy] = useState(false)
  const [areaOpen, setAreaOpen] = useState(false)
  const [areaChangeOpen, setAreaChangeOpen] = useState(false)
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)
  // True while the More modal plays its zoom-out, before it unmounts.
  const [moreClosing, setMoreClosing] = useState(false)
  const moreBtnRef = useRef<HTMLButtonElement | null>(null)
  /** Offset of the More tile from the screen centre — the menu animates from / to it. */
  const [moreFrom, setMoreFrom] = useState({ dx: 0, dy: 0 })
  const moreCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const [productTab, setProductTab] = useState(0)
  /** Product modal was opened from Product List's Edit — go back to the list after. */
  const [productFromList, setProductFromList] = useState(false)
  const productSaveRef = useRef<HTMLButtonElement | null>(null)
  /** Last Enter/Tab typed in Item Description — a repeat of the same key moves on. */
  const productDescKey = useRef('')
  const [productForm, setProductForm] = useState<ProductForm>(BLANK_PRODUCT_FORM)
  const [productSaving, setProductSaving] = useState(false)
  // Options for Add New Item's Group / SubGroup search dropdowns.
  const [groupOptions, setGroupOptions] = useState<SearchSelectOption[]>([])
  const [subgroupOptions, setSubgroupOptions] = useState<SearchSelectOption[]>([])
  const [groupOptionsLoading, setGroupOptionsLoading] = useState<'group' | 'subgroup' | null>(null)
  const [addingProductGroup, setAddingProductGroup] = useState(false)
  const [newProductGroupName, setNewProductGroupName] = useState('')
  const [newProductGroupArabic, setNewProductGroupArabic] = useState('')
  const [productGroupSaving, setProductGroupSaving] = useState(false)

  // Generic "Creation" master-entry modals (Area/Table/Group/etc.) — one
  // shared string|boolean bag keyed by field name, since only one of these
  // is ever open at a time and each modal only reads its own keys.
  const [entryModal, setEntryModal] = useState<EntryKey | null>(null)
  const [reprintBills, setReprintBills] = useState<
    { salesId: string; billNo: string; billTime: string; paymentMode: string; total: number }[]
  >([])
  const [reprintItems, setReprintItems] = useState<
    { sl: number; barcode: string; name: string; qty: number; unitPrice: number; lineTotal: number }[]
  >([])
  const [reprintPick, setReprintPick] = useState('')
  const [reprintRaw, setReprintRaw] = useState<Record<string, unknown> | null>(null)
  const [reprintState, setReprintState] = useState<'idle' | 'loading' | 'error'>('idle')
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
  /** Discount List rows, filtered live by the search box and the group / subgroup dropdowns. */
  const shownDiscounts = useMemo(() => {
    const q = String(entryForm.searchValue ?? '').trim().toLowerCase()
    const g = String(entryForm.discGroup ?? '')
    const sg = String(entryForm.discSubGroup ?? '')
    return txnLines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => {
        if (q && !`${l.barcode ?? ''} ${l.shortDesc ?? ''}`.toLowerCase().includes(q)) return false
        if (g && l.group && l.group !== g) return false
        if (sg && l.subGroup && l.subGroup !== sg) return false
        return true
      })
  }, [txnLines, entryForm.searchValue, entryForm.discGroup, entryForm.discSubGroup])

  /** ProductList Edit rows — filtered live by search (name / barcode), group and subgroup. */
  const shownEditProducts = useMemo(() => {
    const q = String(entryForm.searchValue ?? '').trim().toLowerCase()
    const gId = groups.find((g) => g.name === entryForm.pleGroup)?.id
    const sgId = allSubGroups.find((sg) => sg.name === entryForm.pleSubGroup && (gId == null || sg.groupId === gId))?.id
    return allProducts.filter((p) => {
      if (gId != null && p.groupId !== gId) return false
      if (sgId != null && p.subgroupId !== sgId) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.barcode.toLowerCase().includes(q)) return false
      return true
    })
  }, [allProducts, groups, allSubGroups, entryForm.searchValue, entryForm.pleGroup, entryForm.pleSubGroup])

  const shownSuppliers = useMemo(() => {
    const q = String(entryForm.searchValue ?? '').trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => [s.code, s.name, s.phone, s.mobile, s.contact].some((v) => v.toLowerCase().includes(q)))
  }, [suppliers, entryForm.searchValue])

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
  /** Lang Setup rows (with their original index), filtered live by the search box. */
  const shownLangRows = useMemo(() => {
    const q = String(entryForm.searchValue ?? '').trim().toLowerCase()
    return langRows.map((r, i) => ({ r, i })).filter(({ r }) => !q || r.en.toLowerCase().includes(q) || r.ar.includes(q))
  }, [langRows, entryForm.searchValue])

  /** User List rows, filtered live by the search box (every column). */
  const shownUsers = useMemo(() => {
    const q = String(entryForm.searchValue ?? '').trim().toLowerCase()
    if (!q) return userListRows
    return userListRows.filter((u) => [u.code, u.name, u.role, u.login].some((v) => v.toLowerCase().includes(q)))
  }, [userListRows, entryForm.searchValue])

  const [printerRows, setPrinterRows] = useState<{ counterNo: string; kitchenLoc: string; printerName: string }[]>([])
  const [controlPanelTab, setControlPanelTab] = useState('Company Details')
  /** Privileges are kept per user (by user code). A user with no saved set yet
   * starts from their role: ADMIN → every page, anyone else → Main Page only. */
  const [privilegesByUser, setPrivilegesByUser] = useState<Record<string, string[]>>({})
  const privUserCode = String(entryForm.privUser ?? '')
  const privilegeChecks = useMemo(() => {
    const saved = privilegesByUser[privUserCode]
    if (saved) return new Set(saved)
    const role = userListRows.find((u) => u.code === privUserCode)?.role
    return new Set(role === 'ADMIN' ? PRIVILEGE_PAGES : ['Main Page'])
  }, [privilegesByUser, privUserCode, userListRows])
  /** Updates only the selected user's privileges. */
  const setPrivilegeChecks = (next: Set<string>) => {
    if (!privUserCode) return
    setPrivilegesByUser((prev) => ({ ...prev, [privUserCode]: [...next] }))
  }

  // Cash In / Cash Out — real backend (fetchCashInOut/addCashInOut) already
  // exists for the counter's cash-drawer movements.
  const [cashMode, setCashMode] = useState<'pick' | 'in' | 'out'>('pick')
  /** Every description used before (Cash In and Cash Out) — the quick-pick column. */
  const [cashDescs, setCashDescs] = useState<string[]>([])
  /** Entries of the open type (Cash In or Cash Out) — the list on the left. */
  const [cashRows, setCashRows] = useState<{ desc: string; amount: number }[]>([])
  /** Totals of every Cash In and Cash Out entry — balance = in − out. */
  const [cashTotals, setCashTotals] = useState({ in: 0, out: 0 })

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
  /** Dine-in floor view zoom (1 = fit). Resets each time the floor opens. */
  const [floorZoom, setFloorZoom] = useState(1)
  useEffect(() => {
    if (tableFloorOpen) setFloorZoom(1)
  }, [tableFloorOpen])
  const zoomFloor = (delta: number) =>
    setFloorZoom((z) => Math.min(2.5, Math.max(0.5, Math.round((z + delta) * 100) / 100)))
  const floorCanvasRef = useRef<HTMLDivElement | null>(null)
  // Ctrl + wheel zooms the floor only — non-passive so the whole window doesn't zoom too.
  useEffect(() => {
    const el = floorCanvasRef.current
    if (!tableFloorOpen || !el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      zoomFloor(e.deltaY < 0 ? 0.1 : -0.1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [tableFloorOpen])
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
  const [settleQuick, setSettleQuick] = useState(false)
  const [settleOpening, setSettleOpening] = useState(false)
  const [lastInfo, setLastInfo] = useState<SettlementDone | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  // Ctrl+K (⌘K on Mac) opens the side menu with its search box focused.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
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
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'F6') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      printBillRef.current()
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
  }, [groupId, subGroupId])

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

  // Size popup: any tap elsewhere (or a scroll) closes it. Bound on the next tick
  // so the tap that opened it doesn't close it straight away.
  useEffect(() => {
    if (!variantFor) return
    const close = () => setVariantFor(null)
    const t = window.setTimeout(() => {
      window.addEventListener('click', close)
      window.addEventListener('scroll', close, true)
    }, 0)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [variantFor])

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
    // Where the More tile sits relative to the screen centre, so the menu can
    // grow out of it (and shrink back into it). Rects are on-screen px; the
    // menu's own px are multiplied by the page zoom, so convert.
    const r = moreBtnRef.current?.getBoundingClientRect()
    if (r) {
      const z = uiZoom()
      setMoreFrom({
        dx: (r.left + r.width / 2 - window.innerWidth / 2) / z,
        dy: (r.top + r.height / 2 - window.innerHeight / 2) / z,
      })
    }
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
    }, 220)
  }

  useEffect(() => {
    if (!moreActionsOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeMoreActions()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => () => {
    if (moreCloseTimer.current) clearTimeout(moreCloseTimer.current)
  }, [])

  const [catalogueNonce, setCatalogueNonce] = useState(0)
  const catalogueReady = useRef(false)

  useEffect(() => {
    let alive = true
    const first = !catalogueReady.current
    if (first) setCatalogueState('loading')
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
        if (first) {
        setGroupId(null)
        setSubGroupId(null)
        setSubSubGroupId(null)
        setCatalogueState('ready')
          catalogueReady.current = true
        } else {
          setGroupId((cur) => (cur != null && cats.some((c) => c.id === cur) ? cur : null))
        }
      })
      .catch((err) => {
        if (!alive) return
        setCatalogueError(err instanceof Error ? err.message : 'Could not load menu')
        setCatalogueState('error')
      })
    return () => {
      alive = false
    }
  }, [catalogueNonce])

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
      setCustomerCode('')
      setCustomerMobile('')
      setCustomerTelephone('')
      setOrderWaiterName('')
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

  useEffect(() => {
    if (entryModal !== 'billReprint') return
    let alive = true
    setReprintPick('')
    setReprintRaw(null)
    setReprintItems([])
    setReprintState('loading')
    const today = isoDate(new Date())
    apiService
      .fetchSalesViewer({ dateFrom: today, dateTo: today })
      .then((rows) => {
        if (!alive) return
        setReprintBills(
          rows.map((r) => ({
            salesId: String(r.salesId ?? r.SalesID ?? ''),
            billNo: String(r.billNo ?? r.BillNo ?? ''),
            billTime: String(r.billTime ?? r.BillTime ?? r.billDate ?? ''),
            paymentMode: String(r.paymentMode ?? r.PaymentMode ?? ''),
            total: Number(r.total ?? r.Total ?? r.amount ?? 0) || 0,
          })),
        )
        setReprintState('idle')
      })
      .catch(() => {
        if (!alive) return
        setReprintBills([])
        setReprintState('error')
      })
    return () => {
      alive = false
    }
  }, [entryModal])

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
  const orderListSelected = orderListRows.find((r) => r.kotMasterId === orderListSelectedId) ?? null
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
    el.scrollTop += dy / uiZoom()
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
    dismissTableSelectionUi()
    setGroupId(id)
    setSubGroupId(null)
    setSubSubGroupId(null)
  }

  function onSubGroupClick(id: number) {
    setTopMoveActive(false)
    dismissTableSelectionUi()
    setSubGroupId(id)
    setSubSubGroupId(null)
  }

  function onSubSubClick(id: number) {
    setTopMoveActive(false)
    dismissTableSelectionUi()
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

  /** The variant types set on this item in the Product Master (Variants tab). */
  function variantsOf(p: ProductTile): VariantGroup[] {
    const groups = variantMap[`id:${p.id}`] ?? variantMap[`name:${p.name.trim().toUpperCase()}`] ?? []
    return groups.filter((g) => g.options.length > 0)
  }

  /** Popup tap: remember the option, ask the next variant type, or add the item. */
  function pickVariant(option: string) {
    if (!variantFor) return
    const picked = [...variantFor.picked, option]
    if (variantFor.step + 1 < variantsOf(variantFor.p).length) {
      setVariantFor({ ...variantFor, step: variantFor.step + 1, picked })
    } else {
      onItemClick(variantFor.p, picked.join(', '))
    }
  }

  function onItemClick(p: ProductTile, size?: string, at?: { x: number; y: number }) {
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
    if (size === undefined && variantsOf(p).length > 0) {
      // Same radial popup as the order row menu, centred on the tap and kept on-screen.
      const z = uiZoom()
      const margin = 110
      const x = at?.x ?? window.innerWidth / 2
      const y = at?.y ?? window.innerHeight / 2
      setVariantFor({
        p,
        step: 0,
        picked: [],
        x: Math.min(Math.max(x / z, margin), window.innerWidth / z - margin),
        y: Math.min(Math.max(y / z, margin), window.innerHeight / z - margin),
      })
      return
    }
    setVariantFor(null)
    const price = round2(p.price)
    const existing = lines.find(
      (l) =>
        l.productId === p.id &&
        round2(l.price) === price &&
        (size === undefined || l.modifiers === size) &&
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
          modifiers: size ?? '',
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
          applyDiscount: p.applyDiscount,
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

  // Kitchen Message box: when the text outgrows the box, keep the latest part in view.
  useEffect(() => {
    if (!notesOpen) return
    const el = modifierTextRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [notesText, notesOpen])

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
    // Messages are joined with a comma: "No onion, Less spicy".
    setNotesText((prev) => (prev.trim() ? `${prev.trim().replace(/,$/, '')}, ${label}` : label))
  }

  /** Quick message tap: adds it, or removes it when it is already in the message. */
  function toggleModifier(name: string) {
    const label = name.trim()
    if (!label) return
    const parts = notesText.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.includes(label)) setNotesText(parts.filter((p) => p !== label).join(', '))
    else appendModifier(label)
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

  /** Opens the radial row menu centred on (x, y), clamped so its buttons never
   * render off-screen near a viewport edge. */
  function openRowMenuAt(x: number, y: number, key: number) {
    // Mouse coordinates are on-screen pixels; the menu's own px are zoomed.
    const z = uiZoom()
    const margin = 90
    const cx = Math.min(Math.max(x / z, margin), window.innerWidth / z - margin)
    const cy = Math.min(Math.max(y / z, margin), window.innerHeight / z - margin)
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
    if (!itemDiscountAllowed(line)) {
      toast('Discount not allowed for this item')
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
      const savedOriginalId = (await saveKotInternal({ ticket: remaining }))?.kotId ?? null
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
      const savedTargetId = (await saveKotInternal({ ticket: appended }))?.kotId ?? null
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
      else if (next === 'counter-close-all') {
        setCounterCloseMode('admin')
        setCounterCloseOpen(true)
      }
      else if (next === 'kot-join') setDragJoinConfirm(true)
      else if (next === 'price-change') showPriceChangeDialog(priceChangeKey ?? selectedLine ?? -1)
      else if (next === 'area-change') setAreaChangeOpen(true)
      else if (next === 'discount') openDiscountDialog()
      else if (next === 'bill-print') void printLastCounterBill()
      return
    }
    setAdminNext(next)
    setAdminLogin('')
    setAdminPassword('')
    setAdminFocus('login')
    setAdminError(null)
    setAdminOpen(true)
  }

  printBillRef.current = () => requestAdmin('bill-print')

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
        applyDiscount: tile?.applyDiscount ?? flagApplyDiscount(row.applyDiscount ?? row.ApplyDiscount, num(row.groupId ?? row.GroupID) || tile?.groupId || 0),
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
    setCustomerCode(String(payload.customerCode ?? payload.CustomerCode ?? ''))
    setCustomerMobile(String(payload.mobileNo ?? payload.MobileNo ?? ''))
    setCustomerTelephone(String(payload.telephone ?? payload.Telephone ?? ''))
    const loadedWaiter = num(payload.waiterId ?? payload.WaiterID)
    setWaiterId(loadedWaiter > 0 ? loadedWaiter : getPosSession().staffId)
    setOrderWaiterName(String(payload.waiterName ?? payload.WaiterName ?? ''))
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
      else if (next === 'counter-close-all') {
        setCounterCloseMode('admin')
        setCounterCloseOpen(true)
      }
      else if (next === 'kot-join') setDragJoinConfirm(true)
      else if (next === 'price-change') showPriceChangeDialog(priceChangeKey ?? selectedLine ?? -1)
      else if (next === 'area-change') setAreaChangeOpen(true)
      else if (next === 'discount') openDiscountDialog()
      else if (next === 'bill-print') await printLastCounterBill()
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
      const byTables = match.find((a) => a.tableCreationType === 0) ?? areas.find((a) => a.tableCreationType === 0)
      if (byTables) return byTables
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
    setSelectedKeys(new Set())
    setSeparatorAfterKeys(new Set())
    setCurrentKotId(0)
    setKotNo('')
    setKotPrefix('')
    setCustomerId(0)
    setCustomerName('')
    setCustomerCode('')
    setCustomerMobile('')
    setCustomerTelephone('')
    setOrderWaiterName('')
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
    setAreaId(area.id)
    setKotPrefix(area.kotPrefix)
    setService(normalizeSupply(area.supplyType))
    setIsTablePopup(0)
    setTableId(0)
    setTableName('')
    setChairNo(0)
    setKotNo('')
    setRemarks('')
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
        // Company IsTablePopup: 1 = TableFloorRuntimeFrm, 0 = flpTable grid over items
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
    // applyArea infers the active tab from the area's own supplyType, which
    // can disagree with pickAreaForService's more lenient name-based match
    // (e.g. an area named "Takeaway" but tagged with a blank/other supply
    // type) — set it explicitly so the TAKEAWAY tab actually highlights.
    setService('TAKEAWAY')
    setRemarks('')
    hideTablePopup(true)
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
    hideTablePopup(true)
    resetOpenKotTicket()
    if (askCustomer) openCustomerSelect()
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
  async function tableBtnClick(table: TableRow, fromFloor = false) {
    if (fromFloor && isTablePopup === 1) {
      await floorTableClick(table)
      return
    }
    setIsTablePopup(0)
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
    const seats = Math.max(0, Math.trunc(table.seats))
    const firstOccupied =
      occ.find((k) => k.chairNo > 0)?.chairNo
      ?? (occ[0] ? Math.max(1, occ[0].chairNo) : 0)
    const chairSlots = seats > 0 ? seats : Math.max(occ.length, 1)
    const freeChair = Array.from({ length: chairSlots }, (_, i) => i + 1).find((n) => !occ.some((k) => k.chairNo === n)) ?? 0

    // FirstAllocatedChair = 0 → vacant table: chair 1, hide popup (VB TableBtnClick)
    if (occ.length === 0) {
      setChairNo(1)
      setChairPromptOpen(false)
      hideTablePopup()
      clearQty()
      return
    }

    // Occupied: floor origin shows chairs only; grid keeps tables + chairs
    if (fromFloor) {
      setTablePopupOpen(true)
      setTablePopupMode('tables')
    }
    setChairPromptOpen(true)

    if (ticketHasItems) {
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

    // DisplayKOT edit mode — load the first occupied chair's KOT
    const chair = firstOccupied || 1
    setChairNo(chair)
    const kot = occ.find((k) => k.chairNo === chair) ?? occ[0]
    if (kot) await takeOrder(kot.kotMasterId, false)
    if (occ.length <= 1) hideTablePopup()
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
    if (ticketHasItems && kot) {
      const ok = await ask(`Do You Want To Add Selected Item With KOT ${kot.kotNo}`)
      if (ok) {
        await takeOrder(kot.kotMasterId, true)
      } else {
        setTableId(0)
        setTableName('')
        setChairNo(0)
        setIsTablePopup(0)
      }
    } else if (kot) {
      await takeOrder(kot.kotMasterId, false)
    }
    hideTablePopup()
    clearQty()
  }

  /** Tapping a chair dot directly on a table card — picks that table + chair
   * in one step instead of the table-then-chair two-screen flow. */
  async function dotChairClick(table: TableRow, chair: number, fromFloor = false) {
    if (fromFloor) {
      setIsTablePopup(1)
      setTableFloorOpen(false)
    }
    setTableId(table.id)
    setTableName(table.name)
    await chairBtnClick(chair, table)
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
    setSelectedKeys(new Set())
    setSeparatorAfterKeys(new Set())
    setCurrentKotId(0)
    setKotNo('')
    setKotTime('')
    setRemarks('')
    setBillDiscount(0)
    setDiscountType(0)
    setDiscountOpen(false)
    setCustomerId(0)
    setCustomerName('')
    setCustomerCode('')
    setCustomerMobile('')
    setCustomerTelephone('')
    setCustomerCity('')
    setCustomerAddress('')
    setOrderWaiterName('')
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

  function toast(msg: string, kind: ToastKind = 'error') {
    setNotesHint(msg)
    setNotesKind(kind)
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
        applyDiscount:
          tile?.applyDiscount
          ?? flagApplyDiscount(
            row.ApplyDiscount ?? row.applyDiscount,
            num(row.GroupID ?? row.groupID ?? row.dgvGrpID) || tile?.groupId || 0,
          ),
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
    setKotTime(String(first.KotTime ?? first.KOTTime ?? first.kotTime ?? ''))
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
    setCustomerCode(String(first.CustomerCode ?? first.customerCode ?? ''))
    setCustomerMobile(String(first.MobileNo ?? first.mobileNo ?? ''))
    setCustomerTelephone(String(first.Telephone ?? first.telephone ?? ''))
    setCustomerCity(String(first.City ?? first.city ?? ''))
    setCustomerAddress(String(first.Address ?? first.address ?? ''))
    const loadedWaiter = num(first.WaiterID ?? first.waiterID)
    setWaiterId(loadedWaiter > 0 ? loadedWaiter : getPosSession().staffId)
    setOrderWaiterName(String(first.WaiterName ?? first.waiterName ?? ''))
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
        DiscPerc: line.discPerc,
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
   *
   * `linesOverride` lets a caller save an explicit array instead of live `lines` state —
   * needed when orchestrating a multi-step flow (e.g. moving a line to another KOT) where
   * the next step can't wait a render for `setLines` to land. Context fields (area/table/
   * customer/waiter/covers) still come from component state, since by the time an override
   * is used the state has already been switched to the right ticket via `takeOrder`.
   * Returns the saved/kept KOT id, or null if validation blocked the save or it failed.
   */
  async function saveKotInternal(opts?: {
    forSettlement?: boolean
    forDiscount?: boolean
    forDummy?: boolean
    ticket?: TicketLine[]
    billDisc?: number
    discType?: 0 | 2
  }): Promise<{
    kotId: number
    lines: TicketLine[]
    kotLabel: string
  } | null> {
    if (savingKot && !opts?.forSettlement && !opts?.forDiscount && !opts?.forDummy) return null
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
        btnname: opts?.forDummy ? 'DummyBill' : opts?.forSettlement ? 'Settlement' : opts?.forDiscount ? 'Discount' : 'KotSave',
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
      else if (!opts?.forSettlement && !opts?.forDummy) toast(`Kot ${savedNo} Saved. . . `)
      let savedLines: TicketLine[] = ticket
      if (clearAfterKotSave === 1 && !opts?.forSettlement && !opts?.forDiscount && !opts?.forDummy) {
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

  /** btnDummyBill_Click — save the open KOT, then print the pre-settlement dummy slip. */
  async function onDummyBill() {
    if (currentKotId <= 0) {
      toast('Select a Bill...')
      return
    }
    const saved = await saveKotInternal({ forDummy: true })
    if (!saved) return
    const ticket = saved.lines
    const totals = calcKotTotals(ticket, billDiscount, defaultTax1, 0)
    const session = getPosSession()
    const waiterLabel =
      orderWaiterName || (waiterId > 0 && waiterId === session.staffId ? session.staffName : '')
    try {
      await printSettlementBill({
        dummy: true,
        billNo: '',
        billTime: kotTime || new Date(),
        kotNo: saved.kotLabel,
        supplyType: service,
        counterNo: String(session.counterNo ?? ''),
        cashier: session.staffName || waiter,
        tableName,
        waiterName: waiterLabel,
        guests: String(covers),
        comments: remarks,
        paymentMode: '',
        customerId,
        customerCode,
        customerName,
        customerMobile,
        customerTelephone,
        customerCity,
        customerAddress,
        discount: discountType === 2 ? 0 : totals.billDiscount,
        roundOff: totals.roundOff,
        paid: 0,
        balance: 0,
        taxPct: defaultTax1,
        taxName: tax1Name,
        itemWise: discountType === 2,
        lines: ticket.map((line) => ({
          name: line.item,
          qty: line.qty,
          unitPrice: line.price,
          lineTotal: line.total,
          taxRate: line.taxRate,
          taxAmt: line.tax,
          exclusive: round2(line.price * line.qty - line.disc),
          itemDisc: line.disc,
        })),
      })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Dummy bill print failed')
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
    hideTablePopup()
    setMoreActionsOpen(false)
    setOrderListSearch('')
    setOrderListSupply(supply)
    setOrderListAreaId(0)
    setOrderListSelectedId(0)
    setOrderListOpen(true)
    void loadOrderList(supply, '', 0).then(() => {
      window.setTimeout(() => orderListSearchRef.current?.focus(), 50)
    })
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
    if (currentKotId <= 0) {
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
    const billAllowed = notAllowedItemDiscountCount(lines) <= 0
    let mode: -1 | 0 | 2 = oldDiscount > 0 ? currentType : -1
    if (mode === 0 && !billAllowed) mode = -1
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
    const next = decimal(raw).slice(0, 12)
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
    const next = decimal(raw).slice(0, 12)
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
      if (discountBase - (Number.isFinite(newDiscount) ? newDiscount : 0) < 0) {
        toast('Discount Amount Not Acceptable.........')
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
  /** PAY opens the full Settlement screen; Quick Cash opens its small cash-only version. */
  async function onSettlementClick(quick = false) {
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
      setSettleQuick(quick)
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
    const snapshot = settleBill
    const session = getPosSession()
    const waiterLabel =
      orderWaiterName || (waiterId > 0 && waiterId === session.staffId ? session.staffName : '')
    setSettleOpen(false)
    setSettleBill(null)
    setLastInfo(info)
    toast('Transaction Completed. . . ')
    if (snapshot) {
      const lines = (snapshot.items ?? []).map((row) => row as Record<string, unknown>)
      void printSettlementBill({
        billNo: info.billNo,
        billTime: new Date(),
        kotNo: snapshot.kotLabel,
        supplyType: service,
        counterNo: String(session.counterNo ?? ''),
        cashier: session.staffName || waiter,
        tableName,
        waiterName: waiterLabel,
        guests: String(snapshot.covers ?? ''),
        comments: snapshot.remarks || '',
        paymentMode: info.paymentMode,
        customerId,
        customerCode,
        customerName,
        customerMobile,
        customerTelephone,
        discount: snapshot.discount,
        roundOff: 0,
        paid: info.paid,
        balance: info.change,
        taxPct: defaultTax1,
        taxName: tax1Name,
        itemWise: discountType === 2,
        lines: lines.map((row) => ({
          name: String(row.shortDescription ?? row.ShortDescription ?? ''),
          qty: Number(row.qty ?? row.Qty) || 0,
          unitPrice: Number(row.unitPrice ?? row.UnitPrice) || 0,
          lineTotal: Number(row.lineTotal ?? row.LineTotal) || 0,
          taxRate: Number(row.tax1RateC ?? row.Tax1RateC) || 0,
          taxAmt: Number(row.tax1AmountC ?? row.Tax1AmountC) || 0,
          exclusive: Number(row.subTotalC ?? row.SubTotalC) || 0,
          itemDisc: Number(row.discount ?? row.ItemDisc) || 0,
        })),
        splits:
          info.paymentMode === 'SPLITPAY'
            ? [
                { label: 'CASH', amount: info.cash },
                { label: 'CREDIT CARD', amount: info.card },
                { label: 'ONLINE', amount: info.online },
              ]
            : [],
      }).catch((err) => {
        toast(err instanceof Error ? err.message : 'Bill print failed')
      })
    }
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

  function orderListAreaColor(listAreaId: number, areaName: string) {
    const i = areas.findIndex((a) => a.id === listAreaId)
    if (i >= 0) return AREA_PALETTE[i % AREA_PALETTE.length]
    return areaSwatch(listAreaId, areaName)
  }

  function orderListWaiterBlocked(row: OrderRow) {
    const logged = getPosSession().staffId
    return row.waiterId > 0 && logged > 0 && row.waiterId !== logged
  }

  /** OrderListFrm.DisplayOrderList — open KOTs, optional supply / area / exact KOT. */
  async function loadOrderList(
    supply: 'ALL' | ServiceKind = orderListSupply,
    search = orderListSearch,
    filterAreaId = orderListAreaId,
    kotExact = false,
  ): Promise<OrderRow[]> {
    setOrderListState('loading')
    setOrderListError(null)
    try {
      const rows = mapOrderRows(await apiService.fetchOrderList({
        search: search.trim() || undefined,
        supplyType: supply === 'ALL' ? undefined : supply === 'TAKEAWAY' ? 'PARCEL' : supply,
        areaId: filterAreaId > 0 ? filterAreaId : undefined,
        kotExact,
      }))
      setOrderListRows(rows)
      setOrderListSelectedId((cur) => (rows.some((r) => r.kotMasterId === cur) ? cur : 0))
      setOrderListState('idle')
      return rows
    } catch (err) {
      setOrderListError(errMessage(err, 'Could not load order list'))
      setOrderListState('error')
      return []
    }
  }

  /** Mainfrm.btnOrderList_Click → OrderListFrm.ShowDialog */
  /**
   * OrderListFrm.kotNumberButton_Click / OrderPanel_DoubleClick then
   * Mainfrm.btnOrderList_Click DisplayKOT(..., 0) — always load as NEW.
   */
  async function openOrderFromList(row: OrderRow, checkWaiter = true) {
    if (checkWaiter && orderListWaiterBlocked(row)) {
      toast('This table has an active KOT under another waiter.')
      return
    }
    if (!row.kotMasterId) return
    hideTablePopup()
    await takeOrder(row.kotMasterId, false)
  }

  /** OrderListFrm.OrderPanel_Click — highlight only. */
  function selectOrderCard(row: OrderRow) {
    setOrderListSelectedId(row.kotMasterId)
  }

  /* ── Order List drag-to-join ───────────────────────────────────────────
     Pointer events (not HTML5 drag) so it works on touch tills too. A press
     only becomes a drag after moving 8px, so tap/double-tap still work. */
  function orderCardUnder(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-kot-id]')
    return el ? Number(el.dataset.kotId) || 0 : 0
  }

  function onOrderCardPointerDown(e: React.PointerEvent<HTMLDivElement>, row: OrderRow) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    dragJoinStart.current = { id: row.kotMasterId, x: e.clientX, y: e.clientY, pointerId: e.pointerId }
  }

  function onOrderCardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragJoinStart.current
    if (!start || start.pointerId !== e.pointerId) return
    if (!dragJoin) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const overId = orderCardUnder(e.clientX, e.clientY)
    setDragJoin({ sourceId: start.id, x: e.clientX, y: e.clientY, overId: overId === start.id ? 0 : overId })
  }

  function onOrderCardPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragJoinStart.current
    dragJoinStart.current = null
    const drag = dragJoin
    setDragJoin(null)
    if (!start || !drag) return
    const targetId = orderCardUnder(e.clientX, e.clientY)
    if (!targetId || targetId === start.id) return
    const source = orderListRows.find((r) => r.kotMasterId === start.id)
    const target = orderListRows.find((r) => r.kotMasterId === targetId)
    if (!source || !target) return
    setDragJoinPlan({ source, target, pax: String((source.pax || 0) + (target.pax || 0) || 1) })
    requestAdmin('kot-join')
  }

  function cancelDragJoin() {
    setDragJoinConfirm(false)
    setDragJoinPlan(null)
  }

  async function runDragJoin() {
    const plan = dragJoinPlan
    if (!plan) return
    const finalPax = Math.trunc(Number(plan.pax))
    if (!Number.isFinite(finalPax) || finalPax <= 0) {
      toast('Enter the number of guests')
      return
    }
    setDragJoinBusy(true)
    try {
      const out = await apiService.joinKots({
        targetKotId: plan.target.kotMasterId,
        sourceKotIds: [plan.source.kotMasterId],
        targetAreaId: plan.target.areaId,
        targetTableId: plan.target.tableId,
        finalPax,
      })
      toast(String(out.msg || `${plan.source.kotNo} joined into ${plan.target.kotNo}`), 'success')
      onKotJoined(plan.target.kotMasterId, [plan.source.kotMasterId])
      setOrderListSelectedId(plan.target.kotMasterId)
      cancelDragJoin()
      await loadOrderList(orderListSupply, orderListSearch, orderListAreaId)
    } catch (err) {
      const msg = errMessage(err, 'JOIN Failed')
      toast(msg.startsWith('JOIN Failed') ? msg : `JOIN Failed: ${msg}`)
    } finally {
      setDragJoinBusy(false)
    }
  }

  /** OrderListFrm.txtKOTNo_KeyDown Enter — unique exact match auto-loads. */
  async function onOrderListKotSearch() {
    const q = orderListSearch.trim()
    if (!q) {
      await loadOrderList('ALL', '', 0)
      return
    }
    setOrderListSupply('ALL')
    setOrderListAreaId(0)
    const rows = await loadOrderList('ALL', q, 0, true)
    if (rows.length === 1) await openOrderFromList(rows[0], false)
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
    setOrderListSearch('')
    setOrderListSupply(s)
    setOrderListAreaId(0)
    void loadOrderList(s, '', 0)
  }

  function onOrderListArea(clickedAreaId: number) {
    setOrderListSearch('')
    setOrderListAreaId(clickedAreaId)
    setOrderListSupply('ALL')
    void loadOrderList('ALL', '', clickedAreaId)
  }

  /** DisplayKOT — Order List and table load. AppendItems=0 replaces; =1 keeps NEW lines.
   *  Returns the freshly-loaded lines so a caller mid-orchestration (e.g. moving a line
   *  to another KOT) can use them directly instead of racing the `lines` state update. */
  async function takeOrder(kotMasterId: number, append = false): Promise<TicketLine[] | null> {
    if (kotMasterId <= 0) return null
    if (loadingKot) {
      await new Promise((r) => window.setTimeout(r, 50))
    }
    setLoadingKot(true)
    try {
      const details = await apiService.fetchKotDetails(String(kotMasterId))
      const listedRemarks =
        orderListRows.find((r) => r.kotMasterId === kotMasterId)?.remarks
        || occupiedKots.find((k) => k.kotMasterId === kotMasterId)?.remarks
        || ''
      const result = applyKotDetails(details, allProducts, append, listedRemarks)
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
          telephone: String(c.telephone ?? c.Telephone ?? '').trim(),
          code: String(c.customerCode ?? c.CustomerCode ?? '').trim(),
          city: String(c.city ?? c.City ?? '').trim(),
          address: String(c.address ?? c.Address ?? '').trim(),
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
    setCustomerCode(c.code)
    setCustomerMobile(c.mobile)
    setCustomerTelephone(c.telephone)
    setCustomerCity(c.city ?? '')
    setCustomerAddress(c.address ?? '')
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
    const phoneErr = phoneError(mobile, 'Mobile number') ?? phoneError(telephone, 'Telephone')
    if (phoneErr) {
      setCustomerEntryError(phoneErr)
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

  /** Empties the Product Master form: fields, tab, and the "New group" row. */
  function resetProductDraft() {
    setProductForm(BLANK_PRODUCT_FORM)
    setVariantDraft([])
    setProductTab(0)
    setSubgroupOptions([])
    setAddingProductGroup(false)
    setNewProductGroupName('')
    setNewProductGroupArabic('')
  }

  function openNewProductModal() {
    resetProductDraft()
    setProductFromList(false)
    setProductOpen(true)
  }

  /** Product List → Edit: load the product into the same Product Master modal. */
  async function openEditProductModal(productId: number) {
    try {
      const p = await apiService.fetchProduct(productId)
      const inv = asRow(p.inventory)
      const groupId = num(p.groupId)
      const subgroupId = num(p.subgroupId ?? p.subGroupId)
      let groupName = String(p.groupName ?? p.groupDescription ?? '').trim()
      let subgroupName = String(p.subgroupName ?? p.subGroupName ?? p.subGroupDescription ?? p.subgroupDescription ?? '').trim()
      // The product row may carry only ids — look the names up for the pickers.
      if (groupId && !groupName) {
        const rows = await apiService.fetchGroups().catch(() => [])
        const g = rows.find((r) => num(r.groupId ?? r.GroupID) === groupId)
        groupName = String(g?.groupDescription ?? g?.GroupDescription ?? '').trim()
      }
      if (subgroupId && !subgroupName) {
        const rows = await apiService.fetchSubGroups({ groupId }).catch(() => [])
        const sg = rows.find((r) => num(r.subGroupId ?? r.SubGroupID) === subgroupId)
        subgroupName = String(sg?.subGroupDescription ?? sg?.SubGroupDescription ?? '').trim()
      }
      const cost = formNum(inv.averageCost ?? inv.lastPurchaseCost)
      setProductForm({
        id: productId,
        code: String(p.productCode ?? ''),
        description: String(p.productName ?? p.description ?? ''),
        arabicDescription: String(p.descriptionArabic ?? ''),
        groupId,
        groupName,
        subgroupId,
        subgroupName,
        kitchenLocation: String(inv.locationCode ?? '') === 'Main' ? '' : String(inv.locationCode ?? ''),
        kotPriority: 'NORMAL',
        unitCost: cost,
        vatIn: formNum(inv.inputTax1Rate) || String(defaultTax1),
        unitPrice: formNum(inv.unitPrice),
        vatOut: formNum(inv.outputTax1Rate) || String(defaultTax1),
        packQty: formNum(inv.packQty ?? p.packQty) || '1',
        unit: String(p.unitName || p.unit || 'PCS'),
        qtyOnHand: formNum(inv.qtyOnHand),
        productType: String(p.productType || 'NORMAL'),
        itemDescription: String(p.remarks ?? ''),
        priceLevels: [1, 2, 3, 4, 5].map((n) => formNum(inv[`priceLevel${n}`])),
        keep: {
          newBarcode: false,
          ...(String(p.barcode ?? '').trim() ? { barcode: String(p.barcode).trim() } : {}),
          makeType: String(p.makeType || 'Standard'),
          productBrand: String(p.brandName ?? ''),
          stockType: String(p.stockType || 'Normal'),
          productIdentity: Number(p.productIdentity) === 1 ? 'Yes' : 'No',
          lastPurchCost: formNum(inv.lastPurchaseCost) || cost || '0',
          minUnitPrice: formNum(inv.minimumRetailPrice),
          discountPct: formNum(inv.discountPercentage),
          marginPct: formNum(inv.minimumMarginPercentage),
          reorderLevel: formNum(inv.reorderLevel),
          reorderQty: formNum(inv.reorderQty),
          packetDetails: String(p.packDescription ?? ''),
          supplierRefNo: String(p.supplierRefNo ?? ''),
          origin: String(p.countryOfOrigin ?? ''),
        },
      })
      setVariantDraft(
        variantMap[`id:${productId}`] ??
          variantMap[`name:${String(p.productName ?? p.description ?? '').trim().toUpperCase()}`] ??
          [],
      )
      setSubgroupOptions([])
      setAddingProductGroup(false)
      setProductTab(0)
      setProductFromList(true)
      setProductListOpen(false)
      setProductOpen(true)
    } catch (err) {
      toast(errMessage(err, 'Could not load product'))
    }
  }

  /** ProductList Edit → open that product in the Product Master modal. */
  function editListedProduct(productId: number) {
    closeEntryModal()
    void openEditProductModal(productId)
  }

  /** Closes the modal (Save, ✕ or backdrop) and clears it, so nothing is left
   * behind for the next time — including an open "New group" row. */
  function closeProductModal() {
    setProductOpen(false)
    resetProductDraft()
    if (productFromList) setProductListOpen(true)
    setProductFromList(false)
  }

  /** "New Code" — no next-code endpoint exists yet, so this is a simple
   * timestamp-based placeholder the user can still edit by hand. */
  function generateNewProductCode() {
    setProductForm((f) => ({ ...f, code: `ITM${Date.now().toString().slice(-8)}` }))
  }

  /** Product modal keyboard flow: Tab / Enter jump field to field (Shift+Tab goes back).
   * Starts on Item Code, then the New Code button (a second Enter / Tab there moves on
   * without pressing it), then the inputs; the group New and tab buttons are skipped.
   * Item Description is multi-line, so it needs Enter Enter (or Tab Tab) to move on to
   * Price Levels; a single Enter is still a new line. Then it stops on Save. */
  function onProductFormKey(e: KeyboardEvent<HTMLDivElement>) {
    const el = e.target
    if (el instanceof HTMLTextAreaElement && !e.shiftKey && e.key !== 'Shift') {
      if (e.key !== 'Enter' && e.key !== 'Tab') {
        productDescKey.current = ''
        return
      }
      if (productDescKey.current !== e.key) {
        // First press: Enter types its new line as usual, Tab just waits for the second.
        productDescKey.current = e.key
        if (e.key === 'Tab') e.preventDefault()
        return
      }
      productDescKey.current = ''
      if (e.key === 'Enter') {
        // Drop the blank line the first Enter left behind.
        const pos = el.selectionStart
        if (pos > 0 && el.value[pos - 1] === '\n') {
          const trimmed = el.value.slice(0, pos - 1) + el.value.slice(pos)
          setProductForm((f) => ({ ...f, itemDescription: trimmed }))
        }
      }
    }
    if (e.key !== 'Enter' && e.key !== 'Tab') return
    const isNavButton = el instanceof HTMLButtonElement && el.hasAttribute('data-nav')
    if (!(isNavButton || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return
    // Shift+Enter is left alone (a new line in Item Description).
    if (e.key === 'Enter' && e.shiftKey) return
    const isPicker = el.classList.contains('ui-ss-input')
    // Enter on a closed group picker opens its list — let the user pick first.
    if (isPicker && e.key === 'Enter' && el.getAttribute('aria-expanded') !== 'true') return
    // Something else already used this key (e.g. Enter saves the new group).
    if (e.defaultPrevented && !isPicker) return
    e.preventDefault()
    const body = e.currentTarget
    const back = e.key === 'Tab' && e.shiftKey
    const move = () => {
      const fields = Array.from(body.querySelectorAll<HTMLInputElement>('input, select, textarea, [data-nav]')).filter(
        (f) => !f.disabled && !f.readOnly && f.offsetParent !== null,
      )
      const next = fields[fields.indexOf(el as HTMLInputElement) + (back ? -1 : 1)]
      if (next) {
        next.focus()
        if (next instanceof HTMLInputElement) next.select()
        return
      }
      if (back) return
      if (productTab === 0) {
        setProductTab(1)
        setTimeout(() => body.querySelector<HTMLInputElement>('.pd-pf-levels input')?.focus(), 0)
        return
      }
      productSaveRef.current?.focus()
    }
    // The picker applies its choice on this same Enter; move once that has rendered.
    if (isPicker && e.key === 'Enter') setTimeout(move, 0)
    else move()
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

  /** btnBillreprint_Click → OldBillPrint Task=DirectPrint: last bill of this counter today. */
  async function printLastCounterBill() {
    const session = getPosSession()
    const today = isoDate(new Date())
    try {
      const rows = await apiService.fetchSalesViewer({
        dateFrom: today,
        dateTo: today,
        counterNo: session.counterNo,
      })
      let best: { salesId: string; billNo: number } | null = null
      for (const row of rows) {
        const billNo = Number(row.billNo ?? row.BillNo)
        const salesId = String(row.salesId ?? row.SalesID ?? '')
        if (!salesId || !Number.isFinite(billNo)) continue
        if (!best || billNo > best.billNo) best = { salesId, billNo }
      }
      if (!best) {
        toast('No Data found..............')
        return
      }
      await printViewerBill(await apiService.fetchSalesViewerBill(best.salesId))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No Data found..............')
    }
  }

  async function openReprintBill(salesId: string, andPrint = false) {
    if (!salesId) return
    setReprintPick(salesId)
    try {
      const raw = await apiService.fetchSalesViewerBill(salesId)
      setReprintRaw(raw)
      const list = Array.isArray(raw.items) ? raw.items : []
      setReprintItems(
        list.map((it, i) => {
          const row = it as Record<string, unknown>
          return {
            sl: Number(row.slNo) || i + 1,
            barcode: String(row.barcode ?? row.BarCode ?? ''),
            name: String(row.shortDescription ?? row.ShortDescription ?? ''),
            qty: Number(row.qty ?? row.Qty) || 0,
            unitPrice: Number(row.unitPrice ?? row.UnitPrice) || 0,
            lineTotal: Number(row.lineTotal ?? row.LineTotal) || 0,
          }
        }),
      )
      if (andPrint) await printViewerBill(raw)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not print bill')
    }
  }

  function openEntryModal(key: EntryKey) {
    // Production Entry has its own dialog (Recipe Entry layout).
    if (key === 'productionEntry') {
      setProductionEntryOpen(true)
      setSideNavHidden(true)
      return
    }
    // Opening Stock Entry too.
    if (key === 'openingStock') {
      setOpeningStockOpen(true)
      setSideNavHidden(true)
      return
    }
    // Discount Entry has its own dialog (Recipe Entry layout).
    if (key === 'discountEntry') {
      setDiscountEntryOpen(true)
      setSideNavHidden(true)
      return
    }
    // Advance Payment has its own big-screen dialog.
    if (key === 'advancePayment') {
      setAdvanceOpen(true)
      setSideNavHidden(true)
      return
    }
    // Purchase Entry / Return too.
    if (key === 'purchaseEntry' || key === 'purchaseReturn') {
      setPurchaseMode(key === 'purchaseEntry' ? 'purchase' : 'return')
      setSideNavHidden(true)
      return
    }
    // Product Request / Receipt / Transfer too.
    if (key === 'productRequest' || key === 'productReceipt' || key === 'productTransfer') {
      setTransferDoc(key === 'productRequest' ? 'request' : key === 'productReceipt' ? 'receipt' : 'transfer')
      setSideNavHidden(true)
      return
    }
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
    if (key === 'stockAdjustment' || key === 'damageEntry') {
      setEf('txnDate', today)
      if (key === 'stockAdjustment') setTd('reason', 'Opening Stock')
      if (key === 'damageEntry') setTd('reason', 'Damage')
    }
    if (
      key === 'stockAdjustList' ||
      key === 'productionList' ||
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
      'salesBillWiseRP', 'dayWiseRP', 'taxReport', 'vatSale', 'vatPurchase', 'pendingOrderList', 'counterWiseA4',
      'counterWiseTimewise', 'itemwiseSummary', 'itemwiseDetails', 'areawiseA4',
      'waiterwise', 'salesmanWise', 'customerAnalysisDetailed', 'customerAnalysisSummary',
      'counterCloseDetailsA4', 'incomeExpense', 'productionReport', 'itemVoidA4',
      'graphReport', 'itemwiseViewer', 'delBoyCommission', 'productMovementFast', 'productMovementSlow',
    ]
    if (reportKeys.includes(key)) {
      setEf('rFrom', today)
      setEf('rTo', today)
      setEf('rMode', 'date')
      setEf('rDetailMode', key === 'vatSale' ? 'summary' : 'detailed')
      if (key === 'vatPurchase') {
        setEf('rSupplier', '')
        setEf('rPurchaseType', 'ALL')
      }
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
      setEf('cdpTotal', '')
      setEf('cdpPercent', '')
      setEf('cdpField', 'percent')
    }
    if (key === 'controlPanel') {
      setControlPanelTab('Company Details')
      setEf('cpHeading2', 'Khalifa st. beside Mediclinic,Abu Dhabi , UAE')
      setEf('cpHeading3', 'Ph: 024441125, Mob : 0503071522')
      setEf('cpTaxRegNo', '100233883600003')
      setEf('cpFooter1', 'Thank You...Visit Again')
    }
    if (key === 'privilegeSetup') {
      setEf('privUser', userListRows[0]?.code ?? '')
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
      const groupName = ef('mgDescription').trim()
      const typedCode = ef('mgCode').trim()
      const useOwnCode = groups.some((g) => g.code.toUpperCase().startsWith('MOH-'))
      const groupCode = typedCode || (useOwnCode
        ? menuGroupCode(groupName, new Set(groups.map((g) => g.code.toUpperCase())))
        : undefined)
      await apiService.createGroup({
        groupCode,
        groupDescription: groupName,
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

  function addMessLine(name: string) {
    const item = name.trim()
    if (!item) return
    if (messLines.includes(item)) {
      toast(`${item} is already added`, 'info')
      return
    }
    setMessLines((prev) => [...prev, item])
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
    const mobileErr = phoneError(ef('bookMobile'), 'Mobile')
    if (mobileErr) {
      toast(mobileErr)
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

  function searchTxnList() {
    toast('No records found for this range', 'info')
  }

  function selectTxnRow() {
    toast('No row selected')
  }

  function displayCreditList() {
    toast('No records found for this range', 'info')
  }

  function printReport() {
    toast('Sent to printer', 'success')
  }

  function removeSelectedDiscount() {
    toast('Pick a discount row first')
  }

  function setupVat() {
    toast('VAT setup — coming soon', 'info')
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
    if (!td('printerName').trim()) {
      toast('Enter a Printer Name')
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
    activateCardFor(userListSelected)
  }

  /** Double-click on an admin's row: activate, or deactivate if already active. */
  function toggleCardFor(code: string) {
    const active = userListRows.find((u) => u.code === code)?.card === 'Active'
    if (!active) {
      activateCardFor(code)
      return
    }
    setUserListSelected(code)
    setUserListRows((prev) => prev.map((u) => (u.code === code ? { ...u, card: 'Not Set' } : u)))
    toast('Card deactivated', 'success')
  }

  /** Activate button, or a double-click on an inactive row. */
  function activateCardFor(code: string) {
    setUserListSelected(code)
    setUserListRows((prev) => prev.map((u) => (u.code === code ? { ...u, card: 'Active' } : u)))
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
    const next = new Set(privilegeChecks)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setPrivilegeChecks(next)
  }

  function savePrivileges() {
    const who = userListRows.find((u) => u.code === privUserCode)?.name ?? 'user'
    // Keep this user's set even if nothing was toggled (it may still be the role default).
    setPrivilegeChecks(privilegeChecks)
    toast(`Privileges saved for ${who}`, 'success')
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
      const seen = new Set<string>()
      const descs: string[] = []
      for (const r of rows) {
        const d = String(r.remarks ?? r.Remarks ?? '').trim()
        if (!d || seen.has(d.toUpperCase())) continue
        seen.add(d.toUpperCase())
        descs.push(d)
      }
      setCashDescs(descs)
      let totIn = 0
      let totOut = 0
      for (const r of rows) {
        const amt = Number(r.amount ?? r.Amount) || 0
        const type = String(r.transactionType ?? r.TransactionType ?? '').toUpperCase()
        if (type === 'CASH_IN') totIn += amt
        else if (type === 'CASH_OUT') totOut += amt
      }
      setCashTotals({ in: round2(totIn), out: round2(totOut) })
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
      setCashDescs([])
      setCashTotals({ in: 0, out: 0 })
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
        setGroupOptions(mapGroups(rows))
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

  async function saveProductGroup() {
    const groupDescription = newProductGroupName.trim()
    if (!groupDescription) {
      toast('Enter a Group Name')
      return
    }
    const useOwnCode = groupOptions.some((g) => (g.code ?? '').toUpperCase().startsWith('MOH-')) || groups.some((g) => g.code.toUpperCase().startsWith('MOH-'))
    const taken = new Set([
      ...groupOptions.map((g) => (g.code ?? '').toUpperCase()),
      ...groups.map((g) => g.code.toUpperCase()),
    ])
    const groupCode = useOwnCode ? menuGroupCode(groupDescription, taken) : undefined
    setProductGroupSaving(true)
    try {
      const created = await apiService.createGroup({
        groupDescription,
        groupDescriptionArabic: newProductGroupArabic.trim(),
        ...(groupCode ? { groupCode } : {}),
      })
      const id = Number(created.groupId) || 0
      if (id < 1) throw new Error('Group was not created')
      const opt = {
        id,
        name: String(created.groupDescription ?? groupDescription),
        code: String(created.groupCode ?? groupCode ?? ''),
      }
      setGroupOptions((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))
      setProductForm((f) => ({
        ...f,
        groupId: id,
        groupName: opt.name,
        subgroupId: 0,
        subgroupName: '',
      }))
      setAddingProductGroup(false)
      setNewProductGroupName('')
      setNewProductGroupArabic('')
      void reloadGroups()
      toast('Group saved', 'success')
    } catch (err) {
      toast(errMessage(err, 'Could not create group'))
    } finally {
      setProductGroupSaving(false)
    }
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
      const description = productForm.description.trim()
      const cost = productForm.unitCost || '0'
      const derivedCode = description.toUpperCase().replace(/\s+/g, '-').slice(0, 20)
      const payload = {
        productCode: productForm.code.trim() || derivedCode || `PRD-${Date.now() % 1000000}`,
        newBarcode: true,
        description,
        shortDescription: description,
        descriptionArabic: productForm.arabicDescription.trim(),
        groupId: productForm.groupId,
        subGroupId: productForm.subgroupId || undefined,
        unitCost: cost,
        averageCost: cost,
        lastPurchCost: cost,
        baseCost: cost,
        vatInPct: productForm.vatIn,
        unitPrice: productForm.unitPrice,
        vatOutPct: productForm.vatOut,
        packQty: productForm.packQty || '1',
        qtyOnHand: productForm.qtyOnHand,
        unit: productForm.unit,
        productType: productForm.productType,
        location: productForm.kitchenLocation.trim() || 'Main',
        remark: productForm.itemDescription.trim(),
        makeType: 'Standard',
        priceLevel1: productForm.priceLevels[0],
        priceLevel2: productForm.priceLevels[1],
        priceLevel3: productForm.priceLevels[2],
        priceLevel4: productForm.priceLevels[3],
        priceLevel5: productForm.priceLevels[4],
      }
      let savedId = productForm.id
      if (productForm.id > 0) {
        await apiService.updateProduct(productForm.id, { ...payload, ...productForm.keep })
      } else {
        const created = asRow(await apiService.createProduct(payload))
        savedId = num(created.productId ?? created.ProductID ?? created.id)
      }
      // Variants (mock): kept in this browser, under the product id — or its name
      // when the save did not return an id.
      const variantKey = savedId > 0 ? `id:${savedId}` : `name:${description.toUpperCase()}`
      const variants = variantDraft
        .map((g) => ({ type: g.type.trim() || 'Variant', options: g.options }))
        .filter((g) => g.options.length > 0)
      const nextMap = { ...variantMap }
      if (variants.length > 0) nextMap[variantKey] = variants
      else delete nextMap[variantKey]
      setVariantMap(nextMap)
      try {
        localStorage.setItem(VARIANT_STORE, JSON.stringify(nextMap))
      } catch {
        // Storage blocked — the variants still work until the page is reloaded.
      }
      toast(productForm.id > 0 ? 'Item updated' : 'Item saved', 'success')
      closeProductModal()
      setCatalogueNonce((n) => n + 1)
      void reloadProducts()
    } catch (err) {
      toast(errMessage(err, 'Could not save the item'))
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
    // Transactions / Manufacturing screens backed by Sonu's real dialogs.
    const openStock = (docType: StockDocType, list: boolean) => {
      setStockDocType(docType)
      if (list) setStockListOpen(true)
      else {
        setStockEntryId(null)
        setStockEntryOpen(true)
      }
      setSideNavHidden(true)
    }
    if (label === 'Stock Adjustment') return openStock('ADJ', false)
    if (label === 'Stock Adjust List') return openStock('ADJ', true)
    if (label === 'Damage Entry') return openStock('DMG', false)
    if (label === 'Damage List') return openStock('DMG', true)
    if (label === 'Additional Stock Entry') return openStock('ASE', false)
    if (label === 'Additional Stock List') return openStock('ASE', true)
    if (label === 'Stock report') {
      setStockReportOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Movement Report') {
      setMovementReportOpen(true)
      setSideNavHidden(true)
      return
    }
    // Edit screens + floor designer come from Sonu's dialogs (Swetha had
    // no edit screens, and her Floor Design modal only saved an empty map).
    if (label === 'Group Edit') {
      setGroupEditOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'SubGroup Edit') {
      setSubGroupEditOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Area Edit') {
      setAreaMasterOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Table Edit') {
      setTableMasterOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Product Edit') {
      setProductListOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Floor Design') {
      setFloorDesignOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Recipe Entry') {
      setRecipeProductId(null)
      setRecipeEntryOpen(true)
      setSideNavHidden(true)
      return
    }
    if (label === 'Recipe List') {
      setRecipeListOpen(true)
      setSideNavHidden(true)
      return
    }
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
      setCounterCloseMode('cashier')
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
      setCounterCloseMode('admin')
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
  /** Shared minimal viewer body (Receipt List / Advance Viewer / Mess Bill
   * Viewer): date range · customer search · Show, then the common table. All
   * three only differ in their columns; numeric ones are right-aligned. */
  function renderDisplayListBody(columns: { label: string; num?: boolean }[]) {
    return (
      <>
        <div className="lst-bar">
          <div className="lst-range">
            <DateRangePicker
              from={ef('vFrom')}
              to={ef('vTo')}
              onChange={(from, to) => {
                setEf('vFrom', from)
                setEf('vTo', to)
              }}
            />
          </div>
          <span className="lst-search">
            <Search size={14} />
            <input
              value={ef('vSearch')}
              onChange={(e) => setEf('vSearch', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') displayCreditList()
              }}
              placeholder="Search customer"
            />
          </span>
          <button type="button" className="lst-btn is-primary" onClick={displayCreditList}>
            Show
          </button>
        </div>
        <div className="pd-grid-wrap">
          <table className="pd-grid">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.label} className={c.num ? 'num' : undefined}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={columns.length}>No records in this date range</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    )
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

  return {
    activateSelectedCard, addCashMovement, addLangRow, addMessLine, addOns, addPrinterRow,
    addRecipeLine, addTxnLine, addingProductGroup, adminBusy, adminCreds, adminError, adminFocus,
    adminLogin, adminLoginRef, adminOpen, adminPassword, adminPasswordRef, advanceOpen, alertBox,
    alertOkRef, allProducts, allSubGroups, applyArea, applyDiscountDone, applyLineDiscount,
    applyModifier, applyPriceChange, applyQtyChange, arabicAutoLast, arabicAutoTimers,
    areaButtonClick, areaChangeOpen, areaId, areaMasterOpen, areaNeedsTable, areaOpen, areas,
    billConfirmOpen, bookingAreaTab, bookings, buildSearchItems, cancelBusy, cancelDragJoin,
    cancelLineDiscount, cancelPriceChange, cancelQtyChange, cashDescs, cashMode, cashRows,
    cashTotals, catalogueError, catalogueState, chairBtnClick, chairNo, chairPromptOpen,
    clearAccessCard, clearData, closeAdminDialog, closeAlert, closeDiscountDialog, closeEntryModal,
    closeItemCancel, closeModifierForm, closeMoreActions, closeProductModal, closeSettlement,
    comboGroupInput, comboGroups, commentsDraft, commentsOpen, confirmAlert, confirmBooking,
    confirmCovers, controlPanelTab, counter, counterCloseMode, counterCloseOpen, covers, coversDraft,
    coversPrompt, crumb, currentArea, currentKotId, customerEntryAddress, customerEntryError,
    customerEntryMobile, customerEntryName, customerEntryOpen, customerEntryTel, customerId,
    customerMobileRef, customerName, customerOpen, customerRows, customerSaving, customerSearch,
    customerSearchRef, customerState, deleteKitchenMessage, deleteLine, deleteNote,
    deleteSelectedLines, deleteSelectedTxnLine, deleteSelectedUser, deliveryClick,
    deliveryPickerTimer, deliveryZeroClear, discBillAllowed, discButtons, discChangeLine,
    discChangeNew, discChangeOpen, discChangeRef, discModeOn, discNet, discTax, discTaxLabel,
    discTaxable, discountAmount, discountAmountRef, discountBase, discountEntryOpen, discountError,
    discountFocus, discountMode, discountOpen, discountPercent, discountPercentRef,
    dismissTableSelectionUi, displayCreditList, dotChairClick, dragJoin, dragJoinBusy,
    dragJoinConfirm, dragJoinPlan, dragJoinStart, editListedProduct, ef, efBool, emptyHint, entry,
    entryModal, entrySaving, entryWaiters, floorAreaId, floorBusy, floorCanvasRef, floorDesignOpen,
    floorMap, floorTableClick, floorZoom, flpAreas, generateNewProductCode, gridWrapRef,
    groupEditOpen, groupId, groupOptions, groupOptionsLoading, groupStripRef, groupSubs, groups,
    isTablePopup, itemCancelCoversDraft, itemCancelCoversOpen, itemCancelIds, itemCancelOpen,
    itemCancelQtyLine, itemCancelQtyNew, itemCancelQtyOpen, kitchenMessages, kitchenMsgSelected,
    kotJoinOpen, kotLabel, kotSelectOpen, kotTileClick, langRows, lastInfo, lines, loadCustomers,
    loadFloorDesign, loadGroupOptions, loadReceiptCustomers, loadingKot, messItemOptions, messLines,
    modifierTextRef, modifiers, moreActionsOpen, moreBtnRef, moreClosing, moreFrom, moveLineToKot,
    movePicker, movementReportOpen, moving, mrSelectedGroups, navSearchRef, navSearching, navigate,
    newProductGroupArabic, newProductGroupName, notesHint, notesKind, notesLine, notesList,
    notesOpen, notesSelected, notesText, notifyTranslateDown, now, occupiedByTable, occupiedKots,
    onAdminLoginKeyDown, onAdminPadKey, onAdminPasswordKeyDown, onAreaChanged, onBillCancelClick,
    onCashKey, onCustomerQueryChange, onDiscChangeKey, onDiscountAmountChange, onDiscountClick,
    onDiscountPadKey, onDiscountPercentChange, onDummyBill, onGroupClick, onGroupStripPointerDown,
    onGroupStripPointerMove, onGroupStripPointerUp, onItemCancelClick, onItemCancelQtyDone,
    onItemCancelQtyKey, onItemClick, onItemRemoveClick, onKey, onKotJoinClick, onKotJoined,
    onKotSplit, onOrderCardPointerDown, onOrderCardPointerMove, onOrderCardPointerUp,
    onOrderListArea, onOrderListClick, onOrderListKotSearch, onOrderListSupply, onPricePadKey,
    onProductFormKey, onQtyChangeKey, onQtyClick, onReturnClick, onSaveKot, onServiceClick,
    onSettlementAlreadySettled, onSettlementClick, onSettlementCompleted, onStripTap,
    onSubGroupClick, onSubSubClick, onTopMoveClick, openCashMode, openCustomerSelect,
    openEditProductModal, openEntryModal, openItemCancelQty, openLineDiscount,
    openModifierForSelection, openMoreActions, openMovePicker, openNewCustomer, openNewProductModal,
    openOrderFromList, openOrderListFor, openPriceChange, openQtyChange, openReprintBill,
    openRowMenuAt, openingStockOpen, orderListAreaColor, orderListAreaId, orderListError,
    orderListOpen, orderListRows, orderListSearch, orderListSearchRef, orderListSelected,
    orderListSelectedId, orderListState, orderListSupply, padQty, paymentModes, pickAreaForService,
    pickCustomer, pickKotToCombine, pickVariant, priceChangeLine, priceChangeOpen, priceError,
    priceFocus, priceUnit, priceUnitRef, priceVatPerc, priceVatRef, priceWithVat, printBarcode,
    printReport, printerRows, privUserCode, privilegeChecks, productDescKey, productForm,
    productGroupSaving, productListOpen, productOpen, productSaveRef, productSaving, productTab,
    productionEntryOpen, products, purchaseMode, qtyChangeLine, qtyChangeNew, qtyChangeOpen,
    qtyChangeRef, query, receiptBills, receiptCustomerId, receiptCustomerName, receiptCustomers,
    receiptCustomersState, receiptDetailState, receiptHistory, receiptOpen, receiptSearch,
    recipeDraft, recipeEntryOpen, recipeLines, recipeListOpen, recipeProductId, recipeUnitCost,
    reloadFloorMasters, reloadGroups, remarks, removeSelectedDiscount, renderDisplayListBody,
    renderNavItem, reprintBills, reprintItems, reprintPick, reprintRaw, reprintState, requestAdmin,
    rowMenu, runBillCancel, runDragJoin, salesVariationCorrection, salesViewerOpen, saveAddOn,
    saveAreaEntry, saveCombo, saveControlPanel, saveDiscountPercent, saveFloorDesignEntry,
    saveGroupEntry, saveItemCancelCovers, saveKitchenMessage, saveMainGroupEntry, saveMessMaster,
    saveMultiSupplierSetup, saveNewCustomer, saveNote, saveOnlineSource, savePassword,
    savePaymentMode, savePrivileges, saveProductForm, saveProductGroup, saveRecipe,
    saveSubGroupEntry, saveTableEntry, saveTxn, savedKotLines, savingKot, searchEventLogs,
    searchInputRef, searchTxnList, selectDiscountMode, selectOrderCard, selectReceiptCustomer,
    selectTxnRow, selectedKeys, selectedLine, separatorAfterKeys, service, setAddingProductGroup,
    setAdminFocus, setAdminLogin, setAdminPassword, setAdvanceOpen, setAreaChangeOpen,
    setAreaMasterOpen, setAreaOpen, setBillConfirmOpen, setBookingAreaTab, setCashMode,
    setComboGroupInput, setComboGroups, setCommentsDraft, setCommentsOpen, setConfirmAlert,
    setControlPanelTab, setCounterCloseOpen, setCoversDraft, setCoversPrompt,
    setCustomerEntryAddress, setCustomerEntryMobile, setCustomerEntryName, setCustomerEntryOpen,
    setCustomerEntryTel, setCustomerOpen, setDiscChangeNew, setDiscountEntryOpen, setDiscountFocus,
    setDragJoin, setDragJoinPlan, setEf, setEfWithArabicAutoFill, setEntryForm, setFloorAreaId,
    setFloorDesignOpen, setFloorZoom, setGroupEditOpen, setItemCancelCoversDraft,
    setItemCancelCoversOpen, setItemCancelIds, setItemCancelQtyNew, setItemCancelQtyOpen,
    setKitchenMessages, setKitchenMsgSelected, setKotJoinOpen, setLangRows, setMessLines,
    setMovePicker, setMovementReportOpen, setMrSelectedGroups, setNavSearching,
    setNewProductGroupArabic, setNewProductGroupName, setNotesSelected, setNotesText,
    setOpeningStockOpen, setOrderListOpen, setOrderListSearch, setPriceFocus, setPrinterRows,
    setPrivilegeChecks, setProductForm, setProductListOpen, setProductTab, setProductionEntryOpen,
    setPurchaseMode, setQtyChangeNew, setQuery, setReceiptOpen, setReceiptSearch, setRecipeDraft,
    setRecipeEntryOpen, setRecipeListOpen, setRecipeProductId, setRemarks, setSalesViewerOpen,
    setSelectedKeys, setSelectedLine, setSideNavHidden, setStockEntryId, setStockEntryOpen,
    setStockListOpen, setStockReportOpen, setSubGroupEditOpen, setSubgroupOptions,
    setTableMasterOpen, setTd, setTdWithArabicAutoFill, setTransferDoc, setTxnSelected,
    setUserListSelected, setVariantDraft, settleBill, settleOpen, settleOpening, settleQuick,
    setupVat, shownDiscounts, shownEditProducts, shownLangRows, shownSuppliers, shownUsers,
    sideNavHidden, stockDocType, stockEntryId, stockEntryOpen, stockListOpen, stockReportOpen,
    subGroupEditOpen, subGroupId, subSubGroupId, subSubs, subgroupOptions, submitAdminLogin, summary,
    suppliers, syncFromUnit, syncFromWithVat, tableBtnClick, tableFloorOpen, tableId,
    tableMasterOpen, tableName, tablePopupMode, tablePopupOpen, tables, tablesForArea, tablesInArea,
    td, toast, toggleCardFor, toggleLineSelect, toggleModifier, togglePrivilege,
    toggleSeparatorAfterSelected, topMoveActive, topMoveLoading, transferDoc, txnLines, txnSelected,
    userListRows, userListSelected, variantDraft, variantFor, variantsOf, waiter, withVat, zoomFloor,
  }
}

export type PosCtx = ReturnType<typeof usePosMain>
