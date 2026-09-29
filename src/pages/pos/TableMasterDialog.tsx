/**
 * TableMasterfrm + TableListfrm on one screen.
 * Left: New/Edit entry. Right: list. Click a row to load and Update.
 */
import { useEffect, useMemo, useState } from 'react'
import { LayoutGrid, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { useArabicAutoFill } from '../../utils/useArabicAutoFill'
import { ArabicInput } from '../../components/common/ArabicInput'
import { Toast, toastKindFor } from '../../components/common/Toast'
import TableShapePicker from './TableShapePicker'
import { digits } from '../../utils/validate'

const TABLE_FORMATS = ['SQUARE', 'ROUND', 'OVAL', 'RECTANGLE', 'HEXAGON', 'OCTAGON'] as const

type AreaOpt = { id: number; name: string; tableCreationType: number }
type WaiterOpt = { staffId: number; staffName: string }
type TableRow = {
  tableId: number
  areaId: number
  tableNo: number
  tableName: string
  tableNameArabic: string
  noOfChairs: number
  waiterId: number
  tableFormat: string
}

type Props = {
  areas: AreaOpt[]
  onClose: () => void
  onSaved: () => void
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapTable(row: Record<string, unknown>): TableRow {
  const format = String(row.tableFormat ?? row.TableFormat ?? 'SQUARE').trim().toUpperCase()
  return {
    tableId: num(row.tableId ?? row.TableID),
    areaId: num(row.areaId ?? row.AreaID),
    tableNo: num(row.tableNo ?? row.TableNo ?? row.TableNO),
    tableName: String(row.tableName ?? row.TableName ?? '').trim(),
    tableNameArabic: String(row.tableNameArabic ?? row.TableNameArabic ?? '').trim(),
    noOfChairs: num(row.noOfChairs ?? row.NoOfChairs),
    waiterId: num(row.assignedWaiterId ?? row.WaiterID ?? row.waiterId),
    tableFormat: TABLE_FORMATS.includes(format as (typeof TABLE_FORMATS)[number]) ? format : 'SQUARE',
  }
}

export default function TableMasterDialog({ areas, onClose, onSaved }: Props) {
  const floorAreas = useMemo(
    () => areas.filter((a) => a.tableCreationType === 0).sort((a, b) => a.name.localeCompare(b.name)),
    [areas],
  )
  const allAreas = useMemo(() => areas.slice().sort((a, b) => a.name.localeCompare(b.name)), [areas])
  const [task, setTask] = useState<'New' | 'Edit'>('New')
  const [tableId, setTableId] = useState(0)
  const [areaId, setAreaId] = useState(0)
  const [tableNo, setTableNo] = useState('')
  const [tableName, setTableName] = useState('')
  const [tableNameArabic, setTableNameArabic] = useState('')
  const autoFillTableArabic = useArabicAutoFill(setTableNameArabic, 50)
  const [noOfChairs, setNoOfChairs] = useState('')
  const [waiterId, setWaiterId] = useState(0)
  const [tableFormat, setTableFormat] = useState('SQUARE')
  const [waiters, setWaiters] = useState<WaiterOpt[]>([])
  const [rows, setRows] = useState<TableRow[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (task === 'New' && floorAreas.length && areaId <= 0) setAreaId(floorAreas[0].id)
  }, [floorAreas, areaId, task])

  useEffect(() => {
    void loadDefaults()
  }, [])

  function toast(msg: string) {
    setHint(msg)
    window.setTimeout(() => setHint((cur) => (cur === msg ? null : cur)), 3600)
  }

  function areaNameOf(id: number) {
    return allAreas.find((a) => a.id === id)?.name || `Area ${id}`
  }

  async function loadList() {
    try {
      const data = await apiService.fetchTableMasterRows()
      setRows(data.map((r) => mapTable(r)).filter((r) => r.tableId > 0))
    } catch (err) {
      toast(errMessage(err, 'Table Not Found...'))
    }
  }

  async function loadDefaults() {
    void loadList()
    try {
      const next = await apiService.nextTableNumber()
      setTableNo(String(num(next.tableNo) || 1))
    } catch (err) {
      toast(errMessage(err, 'Could not load table defaults'))
    }
    try {
      const waiterRows = await apiService.fetchWaiters()
      setWaiters(
        waiterRows
          .map((w) => ({
            staffId: num(w.staffId ?? w.StaffID),
            staffName: String(w.staffName ?? w.StaffName ?? ''),
          }))
          .filter((w) => w.staffId > 0),
      )
    } catch {
      setWaiters([])
    }
  }

  async function clearForm() {
    setTask('New')
    setTableId(0)
    setTableName('')
    setTableNameArabic('')
    setNoOfChairs('')
    setWaiterId(0)
    setTableFormat('SQUARE')
    if (floorAreas[0]) setAreaId(floorAreas[0].id)
    try {
      const next = await apiService.nextTableNumber()
      setTableNo(String(num(next.tableNo) || 1))
    } catch {
      setTableNo('')
    }
  }

  function selectRow(row: TableRow) {
    if (row.tableId <= 0) {
      toast('Invalid Table...')
      return
    }
    setTask('Edit')
    setTableId(row.tableId)
    setAreaId(row.areaId)
    setTableNo(String(row.tableNo || ''))
    setTableName(row.tableName)
    setTableNameArabic(row.tableNameArabic)
    setNoOfChairs(row.noOfChairs > 0 ? String(row.noOfChairs) : '')
    setWaiterId(row.waiterId)
    setTableFormat(row.tableFormat || 'SQUARE')
  }

  async function onSave() {
    if (!tableName.trim()) {
      toast('Please Enter Table Name ....')
      return
    }
    if (!String(tableNo).trim()) {
      toast('Please Enter Table No.   ....')
      return
    }
    if (!String(noOfChairs).trim()) {
      toast('Please Enter No. of Chairs  ....')
      return
    }
    if (areaId <= 0) {
      toast('Invalid Area...')
      return
    }
    const payload = {
      areaId,
      tableNo: Number(tableNo),
      tableName: tableName.trim(),
      tableNameArabic: tableNameArabic.trim(),
      noOfChairs: Number(noOfChairs),
      assignedWaiterId: waiterId > 0 ? waiterId : null,
      tableFormat,
    }
    setBusy(true)
    try {
      if (task === 'Edit' && tableId > 0) {
        await apiService.updateTable(tableId, payload)
        toast('Table Details Successfully Updated...')
      } else {
        await apiService.createTable(payload)
        toast('Table Details Successfully Saved...')
      }
      await clearForm()
      await loadList()
      onSaved()
    } catch (err) {
      toast(errMessage(err, task === 'Edit' ? 'Updating Failed...' : 'Saving failed...'))
    } finally {
      setBusy(false)
    }
  }

  const comboAreas = task === 'Edit' ? allAreas : floorAreas

  return (
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-ol-wide pd-edm" role="dialog" aria-modal="true" aria-labelledby="pd-table-edit-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <LayoutGrid size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Edit</p>
              <h2 id="pd-table-edit-title" className="pd-mod-item-name">Table Edit</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="pd-ol-body">
          <div className="pd-edm-grid">
            <div className="pd-edm-form">
              <p className="pd-edm-mode">{task === 'Edit' ? 'Editing selected table' : 'New table'}</p>
              <div className="pd-form-grid-2">
                <div className="pd-form-row">
                  <label>Area</label>
                  <select value={areaId || ''} onChange={(e) => setAreaId(Number(e.target.value) || 0)}>
                    {comboAreas.length === 0 ? <option value="">No Manual areas</option> : null}
                    {comboAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Table No</label>
                  <input value={tableNo} readOnly />
                </div>
              </div>
              <div className="pd-form-row">
                <label>Table Name</label>
                <input
                  value={tableName}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 50)
                    setTableName(v)
                    autoFillTableArabic(v)
                  }}
                />
              </div>
              <div className="pd-form-row">
                <label>Table Name Arabic</label>
                <ArabicInput value={tableNameArabic} onValueChange={setTableNameArabic} source={tableName} maxLength={50} />
              </div>
              <div className="pd-form-grid-2">
                <div className="pd-form-row">
                  <label>No. of Chairs</label>
                  <input
                    inputMode="numeric"
                    value={noOfChairs}
                    onChange={(e) => setNoOfChairs(digits(e.target.value, 4))}
                  />
                </div>
                <div className="pd-form-row">
                  <label>Waiter Name</label>
                  <select value={waiterId || ''} onChange={(e) => setWaiterId(Number(e.target.value) || 0)}>
                    <option value="">Select…</option>
                    {waiters.map((w) => (
                      <option key={w.staffId} value={w.staffId}>
                        {w.staffName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Same shape picker as Table Entry; still saves the plain text
                  format (ROUND / RECTANGLE / SQUARE) like the old dropdown. */}
              <TableShapePicker
                value={tableFormat}
                onChange={(shape) => setTableFormat(shape)}
                chairs={Number(noOfChairs) || 0}
              />
            </div>

            <div className="pd-edm-list">
              <p className="pd-edm-list-title">Table List</p>
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Table No</th>
                      <th>Table Name</th>
                      <th>Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No tables</td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={row.tableId}
                          className={tableId === row.tableId && task === 'Edit' ? 'is-selected' : undefined}
                          style={{ cursor: 'pointer' }}
                          onClick={() => selectRow(row)}
                        >
                          <td>{row.tableNo}</td>
                          <td>{row.tableName}</td>
                          <td>{areaNameOf(row.areaId)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="pd-mod-foot">
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn" onClick={() => void clearForm()} disabled={busy}>
            New
          </button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void onSave()} disabled={busy}>
            {busy ? (task === 'Edit' ? 'Updating…' : 'Saving…') : task === 'Edit' ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
      {hint ? (
        <div className="pd-toast">
          <Toast key={hint} message={hint} kind={toastKindFor(hint)} duration={3600} />
        </div>
      ) : null}
    </div>
  )
}
