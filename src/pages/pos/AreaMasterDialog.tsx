/**
 * AreaMasterfrm + AreaListfrm on one screen.
 * Left: New/Edit entry. Right: list. Click a row to load and Update.
 */
import { useEffect, useState } from 'react'
import { MapPinned, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { Toggle } from '../../components/common/Toggle'
import { useArabicAutoFill } from '../../utils/useArabicAutoFill'
import { ArabicInput } from '../../components/common/ArabicInput'
import { Toast, toastKindFor } from '../../components/common/Toast'

const SUPPLY_TYPES = ['DINE IN', 'PARCEL', 'DELIVERY'] as const
const PRICE_LEVELS = [
  'Normal',
  'Price Level 1',
  'Price Level 2',
  'Price Level 3',
  'Price Level 4',
  'Price Level 5',
] as const

type AreaRow = {
  areaId: number
  areaName: string
  areaNameArabic: string
  supplyType: string
  kotPrefix: string
  priceLevel: string
  tableCreationType: number
  isTabletShow: boolean
}

type Props = {
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

function displaySupply(raw: string) {
  const u = String(raw ?? '')
    .replace(/_/g, ' ')
    .toUpperCase()
    .trim()
  if (u === 'DINE IN' || u === 'DINEIN') return 'DINE IN'
  if (u === 'PARCEL' || u === 'TAKEAWAY' || u === 'TAKE AWAY') return 'PARCEL'
  if (u === 'DELIVERY') return 'DELIVERY'
  return ''
}

function displayPrice(raw: string) {
  const u = String(raw ?? '').trim().toUpperCase()
  if (u === 'NORMAL') return 'Normal'
  const m = u.match(/^PRICE LEVEL ([1-5])$/)
  if (m) return `Price Level ${m[1]}`
  return String(raw ?? '').trim()
}

function mapArea(row: Record<string, unknown>): AreaRow {
  return {
    areaId: num(row.areaId ?? row.AreaID),
    areaName: String(row.areaName ?? row.AreaName ?? '').trim(),
    areaNameArabic: String(row.areaNameArabic ?? row.AreaNameArabic ?? '').trim(),
    supplyType: displaySupply(String(row.supplyType ?? row.SupplyType ?? '')),
    kotPrefix: String(row.kotPrefix ?? row.KotPrefix ?? '').trim(),
    priceLevel: displayPrice(String(row.priceLevel ?? row.PriceLevel ?? '')),
    tableCreationType: num(row.tableCreationType ?? row.TableCreationType),
    isTabletShow: row.isTabletShow === false || row.isTabletShow === 0 || row.isTabletShow === 'false' ? false : true,
  }
}

export default function AreaMasterDialog({ onClose, onSaved }: Props) {
  const [task, setTask] = useState<'New' | 'Edit'>('New')
  const [areaId, setAreaId] = useState(0)
  const [areaName, setAreaName] = useState('')
  const [areaNameArabic, setAreaNameArabic] = useState('')
  const autoFillAreaArabic = useArabicAutoFill(setAreaNameArabic, 50)
  const [supplyType, setSupplyType] = useState('')
  const [prefix, setPrefix] = useState('')
  const [priceLevel, setPriceLevel] = useState('')
  const [tableCreation, setTableCreation] = useState<'manual' | 'auto'>('manual')
  const [tabletShow, setTabletShow] = useState(true)
  const [rows, setRows] = useState<AreaRow[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void loadList()
  }, [])

  function toast(msg: string) {
    setHint(msg)
    window.setTimeout(() => setHint((cur) => (cur === msg ? null : cur)), 3600)
  }

  async function loadList() {
    try {
      const data = await apiService.fetchAreas()
      setRows(data.map((r) => mapArea(r)).filter((r) => r.areaId > 0))
    } catch (err) {
      toast(errMessage(err, 'Area Not Found...'))
    }
  }

  function clearForm() {
    setAreaId(0)
    setAreaName('')
    setAreaNameArabic('')
    setSupplyType('')
    setPrefix('')
    setPriceLevel('')
    setTableCreation('manual')
    setTabletShow(true)
    setTask('New')
  }

  function selectRow(row: AreaRow) {
    if (row.areaId <= 0) {
      toast('Invalid Area...')
      return
    }
    setTask('Edit')
    setAreaId(row.areaId)
    setAreaName(row.areaName)
    setAreaNameArabic(row.areaNameArabic)
    setSupplyType(row.supplyType)
    setPrefix(row.kotPrefix)
    setPriceLevel(PRICE_LEVELS.includes(row.priceLevel as (typeof PRICE_LEVELS)[number]) ? row.priceLevel : displayPrice(row.priceLevel))
    setTableCreation(row.tableCreationType === 1 ? 'auto' : 'manual')
    setTabletShow(row.isTabletShow)
  }

  async function onSave() {
    if (!areaName.trim() && !areaNameArabic.trim()) {
      toast('Enter Area name...')
      return
    }
    if (!supplyType.trim()) {
      toast('Select a Supply Type...')
      return
    }
    if (!prefix.trim()) {
      toast('Enter Prefix...')
      return
    }
    if (!priceLevel.trim()) {
      toast('Select Price Level...')
      return
    }
    const payload = {
      areaName: areaName.trim(),
      areaNameArabic: areaNameArabic.trim(),
      supplyType,
      kotPrefix: prefix.trim(),
      priceLevel,
      tableCreationType: tableCreation === 'auto' ? 1 : 0,
      isTabletShow: tabletShow,
    }
    setBusy(true)
    try {
      if (task === 'Edit' && areaId > 0) {
        await apiService.updateArea(areaId, payload)
        toast('Area Details Successfully Updated...')
      } else {
        await apiService.createArea(payload)
        toast('Area Details Successfully Saved...')
      }
      clearForm()
      await loadList()
      onSaved()
    } catch (err) {
      toast(errMessage(err, task === 'Edit' ? 'Updating Failed...' : 'Saving Failed...'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="pd-mod-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="pd-ol-dialog pd-ol-wide pd-edm" role="dialog" aria-modal="true" aria-labelledby="pd-area-edit-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <MapPinned size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Edit</p>
              <h2 id="pd-area-edit-title" className="pd-mod-item-name">Area Edit</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="pd-ol-body">
          <div className="pd-edm-grid">
            <div className="pd-edm-form">
              <p className="pd-edm-mode">{task === 'Edit' ? 'Editing selected area' : 'New area'}</p>
              <div className="pd-form-row">
                <label>Area Name</label>
                <input
                  value={areaName}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 150)
                    setAreaName(v)
                    autoFillAreaArabic(v)
                  }}
                  placeholder="e.g. DINE IN"
                  autoFocus
                />
              </div>
              <div className="pd-form-row">
                <label>Area Name Arabic</label>
                <ArabicInput value={areaNameArabic} onValueChange={setAreaNameArabic} source={areaName} maxLength={50} />
              </div>
              <div className="pd-form-grid-2">
                <div className="pd-form-row">
                  <label>Supply Type</label>
                  <select value={supplyType} onChange={(e) => setSupplyType(e.target.value)}>
                    <option value="">Select…</option>
                    {SUPPLY_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pd-form-row">
                  <label>Prefix</label>
                  <input value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 50))} />
                </div>
              </div>
              <div className="pd-form-row">
                <label>Price Type</label>
                <select value={priceLevel} onChange={(e) => setPriceLevel(e.target.value)}>
                  <option value="">Select…</option>
                  {PRICE_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-form-row">
                <label>Table Creation Type</label>
                <div className="pd-entry-radio-row">
                  <label className="pd-entry-radio">
                    <input
                      type="radio"
                      name="tableCreation"
                      checked={tableCreation === 'manual'}
                      onChange={() => setTableCreation('manual')}
                    />
                    Manual
                  </label>
                  <label className="pd-entry-radio">
                    <input
                      type="radio"
                      name="tableCreation"
                      checked={tableCreation === 'auto'}
                      onChange={() => setTableCreation('auto')}
                    />
                    Automatic
                  </label>
                </div>
              </div>
              <Toggle checked={tabletShow} onChange={setTabletShow} label="Show on Tablet" />
            </div>

            <div className="pd-edm-list">
              <p className="pd-edm-list-title">Area List</p>
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Area Name</th>
                      <th>Prefix</th>
                      <th>Price Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No areas</td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={row.areaId}
                          className={areaId === row.areaId && task === 'Edit' ? 'is-selected' : undefined}
                          style={{ cursor: 'pointer' }}
                          onClick={() => selectRow(row)}
                        >
                          <td>{row.areaName}</td>
                          <td>{row.kotPrefix}</td>
                          <td>{row.priceLevel || '—'}</td>
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
          <button type="button" className="pd-mod-foot-btn" onClick={clearForm} disabled={busy}>
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
