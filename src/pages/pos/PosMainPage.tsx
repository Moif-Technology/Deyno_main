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
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Hash, Home, LogOut, Search, StickyNote, Tag, Trash2, X, Printer, Save, MessageSquare, Percent, FileText, Ban, CircleOff, RotateCcw, MinusCircle, Receipt, MapPinned, Utensils, ShoppingBag, Truck, CreditCard, SlidersHorizontal, Plus, ClipboardList, Users } from 'lucide-react'
import { SessionManager } from '../../utils/sessionManager'
import { clearStaffSession } from '../../utils/pinLoginSession'
import { getEnrollment } from '../../utils/deviceEnrollment'
import { getPosSession } from '../../utils/posSession'
import { apiService, ApiError } from '../../api/apiService'
import './posMain.css'

const NAV = ['New Sale', 'Transactions', 'Credit', 'Reports', 'Admin', 'Settings'] as const
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
type ModifierPreset = { id: number; name: string; arabic: string }
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

  const [nav] = useState<(typeof NAV)[number]>('New Sale')
  const [groups, setGroups] = useState<Cat[]>([])
  const [allSubGroups, setAllSubGroups] = useState<SubCat[]>([])
  const [allSubSubGroups, setAllSubSubGroups] = useState<SubSubCat[]>([])
  const [allProducts, setAllProducts] = useState<ProductTile[]>([])
  const [modifiers, setModifiers] = useState<ModifierPreset[]>([])
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesText, setNotesText] = useState('')
  const [notesLineKey, setNotesLineKey] = useState<number | null>(null)
  const [notesHint, setNotesHint] = useState<string | null>(null)
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; key: number } | null>(null)
  const [qtyChangeOpen, setQtyChangeOpen] = useState(false)
  const [qtyChangeKey, setQtyChangeKey] = useState<number | null>(null)
  const [qtyChangeNew, setQtyChangeNew] = useState('')
  const qtyChangeRef = useRef<HTMLInputElement | null>(null)
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
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentsDraft, setCommentsDraft] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerRows, setCustomerRows] = useState<{ id: number; name: string; mobile: string }[]>([])
  const [customerState, setCustomerState] = useState<'idle' | 'loading'>('idle')
  const [isTablePopup, setIsTablePopup] = useState(0)
  const [isTablesBasedOnWaiter, setIsTablesBasedOnWaiter] = useState(0)
  const [defaultAreaName, setDefaultAreaName] = useState(1)
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

  const summary = useMemo(() => {
    const qty = lines.reduce((n, l) => n + l.qty, 0)
    const subtotal = round2(lines.reduce((n, l) => n + l.price * l.qty, 0))
    const discount = round2(lines.reduce((n, l) => n + l.disc, 0))
    const tax = round2(lines.reduce((n, l) => n + l.tax, 0))
    return {
      itemCount: lines.length,
      qty,
      subtotal,
      discount,
      tax,
      total: round2(subtotal - discount + tax),
    }
  }, [lines])

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

  function deleteSelected() {
    if (selectedLine == null) return
    const line = lines.find((l) => l.key === selectedLine)
    if (line && !line.kotPending) {
      setNotesHint('Use Item Cancel...')
      return
    }
    setLines((prev) => prev.filter((l) => l.key !== selectedLine))
    setSelectedLine(null)
  }

  const notesLine = notesLineKey == null ? null : lines.find((l) => l.key === notesLineKey) ?? null

  function openModifierForm(ticketKey: number) {
    const line = lines.find((l) => l.key === ticketKey)
    if (!line) {
      setNotesHint('No Item Found...')
      return
    }
    setRowMenu(null)
    setSelectedLine(ticketKey)
    setNotesLineKey(ticketKey)
    setNotesText(line.modifiers ?? '')
    setNotesHint(null)
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
      setNotesHint('No Item Found...')
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
      setNotesHint('No Item Found...')
      return
    }
    const line = lines.find((l) => l.key === key)
    if (!line) {
      setNotesHint('No Item Found...')
      return
    }
    if (!line.kotPending) {
      setNotesHint('Change Qty From Item Cancel...')
      return
    }
    if (line.productType === 'COMBO') {
      setNotesHint('Change Qty Of Combo item.......')
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
      setNotesHint('Qty Price Not Acceptable.........')
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
      if (isTablePopup === 1) setTableFloorOpen(true)
      else setTablePopupOpen(true)
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
      setService('DINE IN')
      toast('DINE IN Area Not Found........')
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

  function toast(msg: string) {
    setNotesHint(msg)
  }

  /** DisplayKOT — AppendItems=0 replaces the grid; =1 keeps NEW lines then adds KOT lines. */
  function applyKotDetails(payload: unknown, productTiles: ProductTile[], append = false) {
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
    return true
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
   */
  async function onSaveKot() {
    if (savingKot) return
    if (lines.length === 0) {
      toast('Enter Atleast One Item details...........')
      return
    }
    const resolvedArea = pickAreaForService(service, areaId) ?? (areaId > 0 ? currentArea : null)
    if (!resolvedArea) {
      toast('Please Select An Area...........')
      setAreaOpen(true)
      return
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
      return
    }
    if (supply === 'DINE IN' && waiterMandatory === 1 && waiterId <= 0) {
      toast('Select a Waiter. . . .')
      return
    }
    let saveTableId = needsTable ? tableId : 0
    let saveChairNo = needsTable ? (chairNo > 0 ? chairNo : 1) : 0
    if (needsTable && saveTableId <= 0) {
      toast('Please Select A Table...........')
      void areaClickToPopulationTable(resolvedArea)
      return
    }
    if (needsTable && saveChairNo < 0) {
      toast('Please Select A Chair...........')
      void areaClickToPopulationTable(resolvedArea)
      return
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
        txtDiscount: summary.discount,
        lblSubTotalAmt: summary.subtotal,
        lblTax1Total: summary.tax,
        lblRound: 0,
        lblBillTotal: summary.total,
        txtNoofCustomer: covers,
        txtRemarks: remarks,
        mfKotPrefix: resolvedArea.kotPrefix || kotPrefix,
        CurrentKOTID: currentKotId > 0 ? currentKotId : 0,
        btnname: 'KotSave',
        Items: buildKotItems(lines),
      })
      const kotId = num(result.CurrentKOTID ?? result.jobId)
      if (kotId > 0) setCurrentKotId(kotId)
      let details = result.kotDetails
      if (!kotDetailsRows(details).length && kotId > 0) {
        details = await apiService.fetchKotDetails(String(kotId))
      }
      const savedNo = `${String(result.KotPrefix ?? kotPrefix)}${String(result.KotNumber ?? kotNo)}`
      toast(`Kot ${savedNo} Saved. . . `)
      if (clearAfterKotSave === 1) {
        clearData()
      } else if (details) {
        applyKotDetails(details, allProducts, false)
      }
    } catch (err) {
      toast(errMessage(err, 'Unable To Save'))
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

  /** DisplayKOT — Order List and table load. AppendItems=0 replaces; =1 keeps NEW lines. */
  async function takeOrder(kotMasterId: number, append = false) {
    if (kotMasterId <= 0 || loadingKot) return
    setLoadingKot(true)
    try {
      const details = await apiService.fetchKotDetails(String(kotMasterId))
      const ok = applyKotDetails(details, allProducts, append)
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
          MOIF<span>DEYNO PRO</span>
        </div>
        <nav className="pd-nav">
          {NAV.map((item) => (
            <button key={item} type="button" className={`pd-nav-btn${item === nav ? ' is-active' : ''}`}>
              {item}
            </button>
          ))}
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
                onClick={() => {
                  setCustomerOpen(true)
                  void loadCustomers()
                }}
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
                        className="col-qty num pd-qty-cell"
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
              <span className="val">{money(summary.subtotal)}</span>
              <span className="label">Discount</span>
              <span className="val">{money(summary.discount)}</span>
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
              <button type="button" className="pd-chip is-amber">
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

          {crumb ? <div className="pd-crumb">{crumb}</div> : null}

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
                    className="pd-act"
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
                  <button type="button" className="pd-act is-amber">
                    <BtnIcon icon={Percent} /> <span>Discount</span>
                  </button>
                  <button type="button" className="pd-act is-blue">
                    <BtnIcon icon={Printer} /> <span>Print Bill</span>
                  </button>
                  <button type="button" className="pd-act is-blue">
                    <BtnIcon icon={FileText} /> <span>Dummy Bill</span>
                  </button>
                  <button type="button" className="pd-act is-danger">
                    <BtnIcon icon={Ban} /> <span>Cancel Bill</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pd-entry">
              <span className="pd-entry-qty">QTY {padQty}</span>
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
                <button type="button" className="pd-act is-amber">
                  <BtnIcon icon={RotateCcw} /> <span>Return</span>
                </button>
                <button type="button" className="pd-act is-danger">
                  <BtnIcon icon={MinusCircle} /> <span>Item Cancel</span>
                </button>
                <button type="button" className="pd-act is-blue">
                  <BtnIcon icon={Receipt} /> <span>Receipts</span>
                </button>
                <button type="button" className="pd-act" onClick={() => setAreaOpen(true)}>
                  <BtnIcon icon={MapPinned} /> <span>Area Change</span>
                </button>
              </div>
            </div>

            <button type="button" className="pd-pay">
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

      {notesHint ? <div className="pd-toast">{notesHint}</div> : null}

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
                    <button
                      key={t.id}
                      type="button"
                      className={`pd-seat pd-seat-table${occupied ? ' is-busy' : ' is-free'}`}
                      onClick={() => void tableBtnClick(t, true)}
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
