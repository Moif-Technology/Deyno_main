/**
 * AreaMasterfrm + AreaListfrm on one screen.
 * Left: New/Edit entry. Right: list. Click a row to load and Update.
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { Toggle } from '../../components/common/Toggle'
import { useArabicAutoFill } from '../../utils/useArabicAutoFill'
import { ArabicInput } from '../../components/common/ArabicInput'

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
    <div className="pd-mod-overlay" role="presentation">
      <div className="pd-em-dialog pd-em-split" role="dialog" aria-modal="true">
        <div className="pd-em-side" />
        <div className="pd-em-body">
          <div className="pd-mod-header">
            <div className="pd-mod-header-left">
              <div>
                <p className="pd-mod-kicker">Masters</p>
                <h2 className="pd-mod-item-name">Area Details Entry. . .</h2>
              </div>
            </div>
            <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
              <X size={13} />
            </button>
          </div>
          <div className="pd-em-split-main">
            <div className="pd-em-fields">
              <label className="pd-em-row">
                <span>Area Name</span>
                <input
                  className="pd-em-input"
                  value={areaName}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 150)
                    setAreaName(v)
                    autoFillAreaArabic(v)
                  }}
                  autoFocus
                />
              </label>
              <label className="pd-em-row">
                <span>Area Name Arabic</span>
                <ArabicInput
                  className="pd-em-input pd-em-rtl"
                  value={areaNameArabic}
                  onValueChange={setAreaNameArabic}
                  source={areaName}
                  maxLength={50}
                />
              </label>
              <label className="pd-em-row">
                <span>Supply Type</span>
                <select
                  className="pd-em-input"
                  value={supplyType}
                  onChange={(e) => setSupplyType(e.target.value)}
                >
                  <option value=""> </option>
                  {SUPPLY_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pd-em-row">
                <span>Prefix</span>
                <input
                  className="pd-em-input pd-em-short"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.slice(0, 50))}
                />
              </label>
              <label className="pd-em-row">
                <span>Price Type</span>
                <select
                  className="pd-em-input"
                  value={priceLevel}
                  onChange={(e) => setPriceLevel(e.target.value)}
                >
                  <option value=""> </option>
                  {PRICE_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <div className="pd-em-row pd-em-inline">
                <span>Table Creation Type</span>
                <div className="pd-em-radios">
                  <label>
                    <input
                      type="radio"
                      name="tableCreation"
                      checked={tableCreation === 'manual'}
                      onChange={() => setTableCreation('manual')}
                    />
                    Manual
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="tableCreation"
                      checked={tableCreation === 'auto'}
                      onChange={() => setTableCreation('auto')}
                    />
                    Automatic
                  </label>
                </div>
                <Toggle checked={tabletShow} onChange={setTabletShow} label="Show on Tablet" />
              </div>
            </div>
            <div className="pd-em-list">
              <p className="pd-em-list-title">Area List</p>
              <div className="pd-em-list-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Area name</th>
                      <th>Area prefix</th>
                      <th>Price Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.areaId}
                        className={areaId === row.areaId && task === 'Edit' ? 'is-on' : ''}
                        onClick={() => selectRow(row)}
                      >
                        <td>{row.areaName}</td>
                        <td>{row.kotPrefix}</td>
                        <td>{row.priceLevel || '—'}</td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No areas</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="pd-em-foot">
            <button type="button" className="pd-em-btn is-new" onClick={clearForm} disabled={busy}>
              New
            </button>
            <button type="button" className="pd-em-btn is-save" onClick={() => void onSave()} disabled={busy}>
              {busy ? (task === 'Edit' ? 'Updating…' : 'Saving…') : task === 'Edit' ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
      {hint ? <div className="pd-toast">{hint}</div> : null}
    </div>
  )
}
