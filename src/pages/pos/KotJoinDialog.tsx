/**
 * KotJoinFrm — Button1_Click opens this screen. Join follows btnJoin_Click
 * then Join_Save_OldStyle. Layout matches KotJoinFrm.Designer.vb.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { SessionManager } from '../../utils/sessionManager'
import { getPosSession } from '../../utils/posSession'
import KotSplitDialog, { type SplitSource } from './KotSplitDialog'

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

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const
const PAX_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0'] as const

type AreaRow = { id: number; name: string; supplyType: string; tableCreationType: number }
type TableRow = { id: number; name: string; areaId: number; seats: number; tableNo?: number }
type JoinCard = {
  kotMasterId: number
  kotNo: string
  kotTime: string
  areaId: number
  areaName: string
  tableName: string
  tableId: number
  tableNo: number
  chairNo: number
  supplyType: string
  remarks: string
  pax: number
  waiterName: string
  amount: number
}
type ConfirmKind = 'table' | 'final' | 'vacant-table'
type AdminNext = 'join' | 'split'
type JoinPlan = {
  target: JoinCard
  newAreaId: number
  newTableId: number
  paxSum: number
  finalPax: number
}

type Props = {
  areas: AreaRow[]
  tables: TableRow[]
  waiter: string
  onClose: () => void
  onJoined: (targetKotId: number, sourceKotIds: number[]) => void
  onSplit?: (info: {
    sourceKotId: number
    newKotId: number
    sourceEmptyAfterSplit: boolean
    msg?: string
  }) => void
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(n: number) {
  return n.toFixed(2)
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function areaSwatch(areaId: number, areaName = '') {
  const seed =
    areaId > 0 ? areaId : [...String(areaName)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AREA_PALETTE[Math.abs(seed) % AREA_PALETTE.length]
}

function isChiefCashierOrAdmin() {
  const session = getPosSession()
  const designation = String(session.designation || '').trim().toUpperCase()
  const roleName = String(session.roleName || SessionManager.roleName || '').trim().toUpperCase()
  if (designation === 'CHIEF CASHIER' || designation === 'ADMIN') return true
  if (roleName === 'CHIEF CASHIER' || roleName === 'ADMIN' || roleName === 'OWNER') return true
  return Number(SessionManager.roleId) === 1
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

function supplySymbol(supply: string) {
  const u = String(supply || '').replace(/_/g, ' ').toUpperCase()
  if (u === 'DINE IN' || u === 'DINEIN') return '🍽️'
  if (u === 'DELIVERY') return '🚚'
  if (u === 'PARCEL' || u === 'TAKEAWAY' || u === 'TAKE AWAY') return '📦'
  return '📍'
}

function mapJoinRows(rows: Record<string, unknown>[]): JoinCard[] {
  return rows
    .map((r) => {
      const prefix = String(r.KotPrefix ?? r.kotPrefix ?? '').trim()
      const kotNo = String(r.KotNumber ?? r.kotNumber ?? '').trim()
      const net = num(r.NetAmount ?? r.netAmount)
      const amount = net || num(r.Amount ?? r.amount)
      return {
        kotMasterId: num(r.kotMasterID ?? r.KotMasterID),
        kotNo: `${prefix}${kotNo}` || String(r.kotMasterID ?? ''),
        kotTime: String(r.KotTime ?? r.kotTime ?? ''),
        areaId: num(r.AreaID ?? r.areaId),
        areaName: String(r.AreaName ?? r.areaName ?? ''),
        tableName: String(r.TableName ?? r.tableName ?? ''),
        tableId: num(r.TableID ?? r.tableId),
        tableNo: num(r.TableNo ?? r.tableNo),
        chairNo: num(r.ChairNo ?? r.chairNo),
        supplyType: String(r.SupplyType ?? r.supplyType ?? ''),
        remarks: String(r.Remarks ?? r.remarks ?? ''),
        pax: num(r.NofCustomer ?? r.nofCustomer),
        waiterName: String(r.WaiterName ?? r.waiterName ?? ''),
        amount,
      }
    })
    .filter((r) => r.kotMasterId > 0)
}

function getAreaName(areas: AreaRow[], areaId: number) {
  return areas.find((a) => a.id === areaId)?.name || `Area ${areaId}`
}

function getTableDisplay(tables: TableRow[], tableId: number) {
  const t = tables.find((row) => row.id === tableId)
  if (!t) return `TableID ${tableId}`
  const tno = t.tableNo && t.tableNo > 0 ? String(t.tableNo) : ''
  const tname = String(t.name || '').trim()
  if (tno && tname) return `T${tno} - ${tname}`
  if (tno) return `T${tno}`
  if (tname) return tname
  return `TableID ${tableId}`
}

export default function KotJoinDialog({ areas, tables, waiter, onClose, onJoined, onSplit }: Props) {
  const [txtKOTNo, setTxtKOTNo] = useState('')
  const [rows, setRows] = useState<JoinCard[]>([])
  const [state, setState] = useState<'loading' | 'idle' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [selected, setSelected] = useState<Map<number, JoinCard>>(new Map())
  const [firstSelectedKotId, setFirstSelectedKotId] = useState(0)
  const [filter, setFilter] = useState<{
    supply?: string
    areaId?: number
    search?: string
  }>({})
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null)
  const [plan, setPlan] = useState<JoinPlan | null>(null)
  const [paxOpen, setPaxOpen] = useState(false)
  const [paxDraft, setPaxDraft] = useState('')
  const [vacantOpen, setVacantOpen] = useState(false)
  const [vacantAreaId, setVacantAreaId] = useState(0)
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<number>>(new Set())
  const [vacantConfirmTable, setVacantConfirmTable] = useState<TableRow | null>(null)
  const [joinBusy, setJoinBusy] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminNext, setAdminNext] = useState<AdminNext | null>(null)
  const [adminLogin, setAdminLogin] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminFocus, setAdminFocus] = useState<'login' | 'password'>('login')
  const [adminError, setAdminError] = useState<string | null>(null)
  const [adminBusy, setAdminBusy] = useState(false)
  const [splitSource, setSplitSource] = useState<SplitSource | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const paxRef = useRef<HTMLInputElement | null>(null)
  const adminLoginRef = useRef<HTMLInputElement | null>(null)
  const adminPasswordRef = useRef<HTMLInputElement | null>(null)

  const selectedList = useMemo(() => [...selected.values()], [selected])
  const paxSumSelected = selectedList.reduce((sum, row) => sum + (row.pax || 0), 0)
  const joinEnabled = selected.size >= 2
  const splitEnabled = selected.size === 1
  const floorAreas = useMemo(
    () =>
      areas
        .filter((a) => a.tableCreationType === 0)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [areas],
  )
  const vacantTables = useMemo(
    () => tables.filter((t) => t.areaId === vacantAreaId && t.id > 0),
    [tables, vacantAreaId],
  )

  useEffect(() => {
    void loadList({})
    const t = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!paxOpen) return
    const t = window.setTimeout(() => paxRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [paxOpen])

  useEffect(() => {
    if (!adminOpen) return
    const t = window.setTimeout(() => adminLoginRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [adminOpen])

  async function loadList(next: { supply?: string; areaId?: number; search?: string }) {
    setFilter(next)
    setState('loading')
    setError(null)
    try {
      const data = await apiService.fetchOrderList({
        joinList: true,
        kotExact: true,
        areaId: next.areaId && next.areaId > 0 ? next.areaId : undefined,
        supplyType: next.supply,
        search: next.search,
      })
      setRows(mapJoinRows(data))
      setState('idle')
    } catch (err) {
      setError(errMessage(err, 'Could not load KOTs'))
      setRows([])
      setState('error')
    }
  }

  function toast(msg: string) {
    setHint(msg)
    window.setTimeout(() => setHint((cur) => (cur === msg ? null : cur)), 3200)
  }

  function targetCard(): JoinCard | null {
    if (firstSelectedKotId && selected.has(firstSelectedKotId)) {
      return selected.get(firstSelectedKotId) ?? null
    }
    return selectedList[0] ?? null
  }

  function toggleCard(row: JoinCard) {
    const next = new Map(selected)
    if (next.has(row.kotMasterId)) {
      next.delete(row.kotMasterId)
      let first = firstSelectedKotId
      if (first === row.kotMasterId) {
        first = 0
        for (const id of next.keys()) {
          first = id
          break
        }
      }
      setFirstSelectedKotId(first)
      setSelected(next)
      return
    }
    next.set(row.kotMasterId, row)
    setSelected(next)
    if (firstSelectedKotId === 0) setFirstSelectedKotId(row.kotMasterId)
  }

  function clearSelection(refresh = true) {
    setSelected(new Map())
    setFirstSelectedKotId(0)
    if (refresh) void loadList(filter)
  }

  function requireAdmin(next: AdminNext) {
    if (isChiefCashierOrAdmin()) {
      if (next === 'join') startJoinOptions()
      else startSplit()
      return
    }
    setAdminNext(next)
    setAdminLogin('')
    setAdminPassword('')
    setAdminFocus('login')
    setAdminError(null)
    setAdminOpen(true)
  }

  async function submitAdmin() {
    const username = adminLogin.trim()
    const password = adminPassword
    if (!username) {
      setAdminError('Enter Login Name...')
      setAdminFocus('login')
      adminLoginRef.current?.focus()
      return
    }
    if (!password) {
      setAdminError('Enter Password...')
      setAdminFocus('password')
      adminPasswordRef.current?.focus()
      return
    }
    setAdminBusy(true)
    setAdminError(null)
    try {
      const result = await apiService.verifyAdmin(username, password)
      if (result.ok === false || Number(result.IsAdmin) === 0) {
        setAdminError(String(result.message || 'Password Failed...'))
        setAdminPassword('')
        setAdminFocus('password')
        adminPasswordRef.current?.focus()
        return
      }
      const next = adminNext
      setAdminOpen(false)
      setAdminPassword('')
      setAdminNext(null)
      if (next === 'join') startJoinOptions()
      else if (next === 'split') startSplit()
    } catch (err) {
      setAdminError(errMessage(err, 'Password Failed...'))
      setAdminPassword('')
      setAdminFocus('password')
    } finally {
      setAdminBusy(false)
    }
  }

  function onAdminPadKey(k: string) {
    const apply = (value: string) => {
      if (k === 'C') return ''
      if (k === '.' && value.includes('.')) return value
      return (value + k).slice(0, 24)
    }
    if (adminFocus === 'login') setAdminLogin((v) => apply(v))
    else setAdminPassword((v) => apply(v))
  }

  function onAdminLoginKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!adminLogin.trim()) {
      setAdminError('Enter Login Name...')
      return
    }
    setAdminFocus('password')
    adminPasswordRef.current?.focus()
  }

  function onAdminPasswordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void submitAdmin()
  }

  function onJoinClick() {
    if (selected.size < 2) {
      toast('Select minimum 2 KOTs to Join.')
      return
    }
    requireAdmin('join')
  }

  function startJoinOptions() {
    if (selected.size < 2) {
      toast('Select minimum 2 KOTs to Join.')
      return
    }
    setConfirm('table')
  }

  function onTableAnswer(useFirst: boolean) {
    setConfirm(null)
    const target = targetCard()
    if (!target) return
    if (useFirst) {
      openPaxKeypad(target.areaId, target.tableId, target)
      return
    }
    void openVacantPicker(target)
  }

  async function openVacantPicker(target: JoinCard) {
    if (!floorAreas.length) {
      toast('No Areas found.')
      return
    }
    const start =
      (target.areaId > 0 && floorAreas.some((a) => a.id === target.areaId)
        ? target.areaId
        : floorAreas[0].id) || 0
    if (start <= 0) {
      toast('No Areas found.')
      return
    }
    try {
      const occRows = await apiService.fetchOrderList({ joinList: true, kotExact: true })
      const occ = new Set<number>()
      for (const row of mapJoinRows(occRows)) {
        if (row.tableId > 0) occ.add(row.tableId)
      }
      setOccupiedTableIds(occ)
    } catch {
      setOccupiedTableIds(new Set())
    }
    setVacantAreaId(start)
    setVacantConfirmTable(null)
    setVacantOpen(true)
  }

  function onVacantTableClick(table: TableRow) {
    if (occupiedTableIds.has(table.id)) return
    setVacantConfirmTable(table)
    setConfirm('vacant-table')
  }

  function onVacantConfirm(yes: boolean) {
    setConfirm(null)
    if (!yes || !vacantConfirmTable) {
      setVacantConfirmTable(null)
      return
    }
    const target = targetCard()
    if (!target) return
    const areaId = vacantAreaId
    const tableId = vacantConfirmTable.id
    setVacantOpen(false)
    setVacantConfirmTable(null)
    openPaxKeypad(areaId, tableId, target)
  }

  function openPaxKeypad(newAreaId: number, newTableId: number, target: JoinCard) {
    let paxSum = 0
    for (const info of selected.values()) paxSum += Number(info.pax) || 0
    if (paxSum <= 0) paxSum = 1
    setPlan({
      target,
      newAreaId,
      newTableId,
      paxSum,
      finalPax: paxSum,
    })
    setPaxDraft(String(paxSum))
    setPaxOpen(true)
  }

  function onPaxKey(k: string) {
    if (k === 'C') {
      setPaxDraft('')
      return
    }
    setPaxDraft((cur) => (cur + k).replace(/[^\d]/g, '').slice(0, 6))
  }

  function onPaxDone() {
    const finalPax = Math.trunc(Number(paxDraft))
    if (!Number.isFinite(finalPax) || finalPax <= 0) {
      setPaxOpen(false)
      setPlan(null)
      return
    }
    setPlan((cur) => (cur ? { ...cur, finalPax } : cur))
    setPaxOpen(false)
    setConfirm('final')
  }

  function onPaxCancel() {
    setPaxOpen(false)
    setPlan(null)
  }

  async function runJoin() {
    const current = plan
    const target = current?.target ?? targetCard()
    if (!current || !target) return
    const sourceKotIds = [...selected.keys()].filter((id) => id !== target.kotMasterId)
    if (sourceKotIds.length < 1) {
      toast('Nothing to JOIN.')
      setConfirm(null)
      return
    }
    setJoinBusy(true)
    try {
      const out = await apiService.joinKots({
        targetKotId: target.kotMasterId,
        sourceKotIds,
        targetAreaId: current.newAreaId,
        targetTableId: current.newTableId,
        finalPax: current.finalPax,
      })
      toast(String(out.msg || 'Bill Joined Successfully.'))
      onJoined(target.kotMasterId, sourceKotIds)
    } catch (err) {
      const msg = errMessage(err, 'JOIN Failed')
      toast(msg.startsWith('JOIN Failed') ? msg : `JOIN Failed: ${msg}`)
    } finally {
      setConfirm(null)
      setPlan(null)
      clearSelection(false)
      await loadList(filter)
      setJoinBusy(false)
    }
  }

  function onFinalAnswer(yes: boolean) {
    if (!yes) {
      setConfirm(null)
      setPlan(null)
      return
    }
    void runJoin()
  }

  function onSplitClick() {
    if (selected.size !== 1) {
      toast('Select ONLY ONE KOT to Split.')
      return
    }
    requireAdmin('split')
  }

  function startSplit() {
    if (selected.size !== 1) {
      toast('Select ONLY ONE KOT to Split.')
      return
    }
    const target = targetCard()
    if (!target) return
    setSplitSource({
      kotMasterId: target.kotMasterId,
      kotNo: target.kotNo,
      areaId: target.areaId,
      tableId: target.tableId,
      pax: target.pax > 0 ? target.pax : 1,
    })
  }

  function onSearchEnter() {
    const value = txtKOTNo.trim()
    void loadList(value ? { search: value } : {})
  }

  const confirmCopy = (() => {
    if (confirm === 'table') {
      return {
        title: 'JOIN TO WHICH TABLE ?',
        body: 'JOIN TO WHICH TABLE ?\n\nYES  = JOIN TO FIRST SELECTED KOT TABLE\nNO   = PICK OTHER VACANT TABLE',
      }
    }
    if (confirm === 'vacant-table' && vacantConfirmTable) {
      return {
        title: 'Select this table ?',
        body: `Select this table ?\n\nArea : ${getAreaName(areas, vacantAreaId)}\nTable: ${getTableDisplay(tables, vacantConfirmTable.id)}\n\nProceed ?`,
      }
    }
    if (confirm === 'final' && plan) {
      return {
        title: 'Proceed to JOIN ?',
        body:
          `Proceed to JOIN ?\n\nTarget KOT : ${plan.target.kotNo}\nTo Area    : ${getAreaName(areas, plan.newAreaId)}\nTo Table   : ${getTableDisplay(tables, plan.newTableId)}\nFinal PAX  : ${plan.finalPax}\n\nSelected KOTs : ${selected.size}`,
      }
    }
    return null
  })()

  return (
    <div className="pd-mod-overlay pd-ol-overlay" role="presentation">
      <div className="pd-ol-dialog pd-ol-screen pd-kj-screen" role="dialog" aria-modal="true">
        <aside className="pd-kj-side">
          <span className="pd-kj-heading">KOT No.</span>
          <input
            ref={searchRef}
            className="pd-kj-search"
            value={txtKOTNo}
            onChange={(e) => setTxtKOTNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearchEnter()
            }}
          />
          <button
            type="button"
            className={`pd-kj-btn${!filter.supply && !filter.areaId && !filter.search ? ' is-on' : ''}`}
            onClick={() => {
              setTxtKOTNo('')
              void loadList({})
            }}
          >
            All Order
          </button>
          <button
            type="button"
            className={`pd-kj-btn${filter.supply === 'DINE IN' ? ' is-on' : ''}`}
            onClick={() => {
              setTxtKOTNo('')
              void loadList({ supply: 'DINE IN' })
            }}
          >
            DineIn
          </button>
          <button
            type="button"
            className={`pd-kj-btn${filter.supply === 'PARCEL' ? ' is-on' : ''}`}
            onClick={() => {
              setTxtKOTNo('')
              void loadList({ supply: 'PARCEL' })
            }}
          >
            Take Away
          </button>
          <button
            type="button"
            className={`pd-kj-btn${filter.supply === 'DELIVERY' ? ' is-on' : ''}`}
            onClick={() => {
              setTxtKOTNo('')
              void loadList({ supply: 'DELIVERY' })
            }}
          >
            Delivery
          </button>
          <button type="button" className="pd-kj-btn pd-kj-selected" disabled>
            Selected: {selected.size}  |  PAX: {paxSumSelected}
          </button>
          <button type="button" className="pd-kj-btn" disabled={!joinEnabled} onClick={onJoinClick}>
            KOTJoin
          </button>
          <button type="button" className="pd-kj-btn" disabled={!splitEnabled} onClick={onSplitClick}>
            KOT Split
          </button>
          <button type="button" className="pd-kj-btn pd-kj-hidden" tabIndex={-1} aria-hidden>
            ChangeNoOfPerson
          </button>
          <span className="pd-kj-side-spacer" />
          <button type="button" className="pd-kj-btn" onClick={() => clearSelection(true)}>
            Clear
          </button>
          <button type="button" className="pd-kj-btn pd-kj-home" onClick={onClose}>
            Home
          </button>
        </aside>

        <div className="pd-kj-main">
          <div className="pd-ol-indicate pd-kj-indicate" aria-label="Area colours">
            {areas.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`pd-ol-area${filter.areaId === a.id ? ' is-on' : ''}`}
                style={{ background: areaSwatch(a.id, a.name) }}
                onClick={() => {
                  setTxtKOTNo('')
                  void loadList({ areaId: a.id })
                }}
              >
                {a.name}
              </button>
            ))}
          </div>
          <div className="pd-kj-cards">
            {state === 'loading' ? <p className="pd-cat-msg">Loading orders…</p> : null}
            {state === 'error' ? <p className="pd-cat-msg">{error}</p> : null}
            {state === 'idle' && rows.length === 0 ? <p className="pd-cat-msg">No open KOTs</p> : null}
            {rows.map((row) => {
              const color = areaSwatch(row.areaId, row.areaName)
              const on = selected.has(row.kotMasterId)
              const tableLine =
                row.tableName.trim() && String(row.chairNo).trim()
                  ? `Table: ${row.tableName} - Chair: ${row.chairNo}`
                  : 'Table: N/A'
              return (
                <button
                  key={row.kotMasterId}
                  type="button"
                  className={`pd-ol-card pd-kj-card${on ? ' is-on' : ''}`}
                  style={{ background: color }}
                  onClick={() => toggleCard(row)}
                >
                  {on ? <span className="pd-kj-tick">✓</span> : null}
                  <span className="pd-ol-card-area">
                    {supplySymbol(row.supplyType)} {row.areaName || 'Unknown Area'}
                  </span>
                  <span className="pd-ol-card-time">{formatKotClock(row.kotTime)}</span>
                  <span className={`pd-ol-card-table${row.tableName.trim() ? ' is-set' : ''}`}>
                    {tableLine}
                  </span>
                  {row.remarks ? <span className="pd-ol-card-note">{row.remarks}</span> : null}
                  <span className="pd-ol-card-pax">PAX: {row.pax || 0}</span>
                  <span className="pd-ol-card-waiter">{row.waiterName || waiter}</span>
                  <span className="pd-ol-card-amt">Amount: {money(row.amount)}</span>
                  <span className="pd-ol-card-kot">{row.kotNo}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {hint ? <div className="pd-toast">{hint}</div> : null}

      {splitSource ? (
        <KotSplitDialog
          source={splitSource}
          areas={areas}
          tables={tables}
          onClose={() => setSplitSource(null)}
          onSplit={(info) => {
            setSplitSource(null)
            if (info.msg) toast(info.msg)
            clearSelection(false)
            void loadList(filter)
            onSplit?.(info)
          }}
        />
      ) : null}

      {vacantOpen ? (
        <div className="pd-mod-overlay" role="presentation">
          <div className="pd-floor-dialog pd-kj-vacant" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div>
                  <p className="pd-mod-kicker">Pick Vacant Table</p>
                  <h2 className="pd-mod-item-name">
                    {getAreaName(areas, vacantAreaId)}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => {
                  setVacantOpen(false)
                  setVacantConfirmTable(null)
                }}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <div className="pd-kj-vacant-areas">
              {floorAreas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`pd-ol-area${vacantAreaId === a.id ? ' is-on' : ''}`}
                  style={{ background: areaSwatch(a.id, a.name) }}
                  onClick={() => setVacantAreaId(a.id)}
                >
                  {a.name}
                </button>
              ))}
              <p className="pd-kj-vacant-hint">Pick a VACANT table → Confirm → Done</p>
            </div>
            <div className="pd-floor-canvas">
              <div className="pd-table-grid is-floor">
                {vacantTables.map((t) => {
                  const occupied = occupiedTableIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`pd-seat pd-seat-table${occupied ? ' is-busy' : ' is-free'}`}
                      onClick={() => onVacantTableClick(t)}
                    >
                      <span className="pd-seat-name">{t.name}</span>
                      <small className="pd-seat-status">{occupied ? 'Busy' : 'Vacant'}</small>
                    </button>
                  )
                })}
                {vacantTables.length === 0 ? <p className="pd-cat-msg">No tables in this area</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {paxOpen && plan ? (
        <div className="pd-mod-overlay" role="presentation">
          <div className="pd-qty-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div>
                  <p className="pd-mod-kicker">Number Keypad</p>
                  <h2 className="pd-mod-item-name">Enter No. of Persons</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={onPaxCancel} aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <div className="pd-qty-body">
              <div className="pd-qty-fields">
                <div className="pd-qty-row">
                  <span>Sum PAX</span>
                  <strong>{plan.paxSum}</strong>
                </div>
                <div className="pd-qty-row">
                  <span>No. of Persons</span>
                  <input
                    ref={paxRef}
                    className="pd-qty-input"
                    value={paxDraft}
                    onChange={(e) => setPaxDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onPaxDone()
                      if (e.key === 'Escape') onPaxCancel()
                    }}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="pd-qty-pad">
                <div className="pd-qty-keys">
                  {PAX_KEYS.map((k) => (
                    <button key={k} type="button" className="pd-key" onClick={() => onPaxKey(k)}>
                      {k}
                    </button>
                  ))}
                </div>
                <div className="pd-qty-actions">
                  <button type="button" className="pd-qty-done" onClick={onPaxDone}>
                    Done
                  </button>
                  <button type="button" className="pd-qty-cancel" onClick={onPaxCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirm && confirmCopy ? (
        <div className="pd-mod-overlay" role="presentation">
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div>
                  <p className="pd-mod-kicker">Confirm</p>
                  <h2 className="pd-mod-item-name">{confirmCopy.title}</h2>
                </div>
              </div>
            </div>
            <div className="pd-ol-body">
              <p className="pd-confirm-msg pd-kj-confirm">{confirmCopy.body}</p>
            </div>
            <div className="pd-mod-foot">
              <span className="pd-mod-foot-spacer" />
              <button
                type="button"
                className="pd-mod-foot-btn is-ok"
                disabled={joinBusy}
                onClick={() => {
                  if (confirm === 'table') onTableAnswer(true)
                  else if (confirm === 'vacant-table') onVacantConfirm(true)
                  else onFinalAnswer(true)
                }}
              >
                {joinBusy ? 'Joining…' : 'Yes'}
              </button>
              <button
                type="button"
                className="pd-mod-foot-btn is-close"
                disabled={joinBusy}
                onClick={() => {
                  if (confirm === 'table') onTableAnswer(false)
                  else if (confirm === 'vacant-table') onVacantConfirm(false)
                  else onFinalAnswer(false)
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adminOpen ? (
        <div className="pd-mod-overlay pd-admin-overlay" role="presentation">
          <div className="pd-ol-dialog pd-ol-narrow" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <ShieldCheck size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Admin Login</p>
                  <h2 className="pd-mod-item-name">ADMIN / CHIEF CASHIER</h2>
                </div>
              </div>
              <button
                type="button"
                className="pd-mod-x"
                onClick={() => setAdminOpen(false)}
                disabled={adminBusy}
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
            <form
              className="pd-ol-body pd-admin-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submitAdmin()
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
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
