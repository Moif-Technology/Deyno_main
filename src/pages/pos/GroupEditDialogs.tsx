/**
 * Edit-menu screens for the product group masters, in the same modal design
 * as the Creation screens: a form on the left, the saved list on the right.
 * Click a row to load it for editing; "New" clears the form for a fresh one.
 *
 *   GroupEditDialog     — main groups   (/groups:     create + update)
 *   SubGroupEditDialog  — sub groups    (/sub-groups: create + update)
 */
import { useEffect, useState } from 'react'
import { Layers, Tag, X } from 'lucide-react'
import { apiService, ApiError } from '../../api/apiService'
import { Toggle } from '../../components/common/Toggle'
import { ArabicInput } from '../../components/common/ArabicInput'

type Row = Record<string, unknown>

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.message) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function str(v: unknown) {
  return v == null ? '' : String(v).trim()
}

function flag(v: unknown, fallback: boolean) {
  if (v == null || v === '') return fallback
  if (typeof v === 'boolean') return v
  const u = String(v).trim().toUpperCase()
  if (u === 'TRUE' || u === 'Y' || u === 'YES') return true
  if (u === 'FALSE' || u === 'N' || u === 'NO') return false
  return num(v) !== 0
}

type Props = {
  onClose: () => void
  /** Called after a successful save so the till can refresh its catalogue. */
  onSaved?: () => void
}

/* ── Main groups ─────────────────────────────────────────────────────── */

type GroupRow = { id: number; code: string; name: string; arabic: string; applyDiscount: boolean }

function mapGroup(g: Row): GroupRow {
  const id = num(g.groupId ?? g.GroupID)
  return {
    id,
    code: str(g.groupCode ?? g.GroupCode),
    name: str(g.groupDescription ?? g.GroupDescription ?? g.groupName),
    arabic: str(g.groupDescriptionArabic ?? g.GroupDescriptionArabic),
    applyDiscount: flag(g.applyDiscount ?? g.ApplyDiscount, true),
  }
}

export function GroupEditDialog({ onClose, onSaved }: Props) {
  const [rows, setRows] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [arabic, setArabic] = useState('')
  const [applyDiscount, setApplyDiscount] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRows((await apiService.fetchGroups()).map(mapGroup).filter((g) => g.id > 0 && g.name))
    } catch (err) {
      setError(errMessage(err, 'Could not load groups'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function clearForm() {
    setEditId(null)
    setCode('')
    setName('')
    setArabic('')
    setApplyDiscount(true)
    setError(null)
  }

  function selectRow(g: GroupRow) {
    setEditId(g.id)
    setCode(g.code)
    setName(g.name)
    setArabic(g.arabic)
    setApplyDiscount(g.applyDiscount)
    setError(null)
    setHint(null)
  }

  async function save() {
    if (!name.trim()) {
      setError('Enter a Description')
      return
    }
    setBusy(true)
    setError(null)
    const body = {
      groupCode: code.trim() || undefined,
      groupDescription: name.trim(),
      groupDescriptionArabic: arabic.trim(),
      applyDiscount,
    }
    try {
      if (editId != null) await apiService.updateGroup(editId, body)
      else await apiService.createGroup(body)
      setHint(editId != null ? 'Group updated' : 'Group saved')
      clearForm()
      await load()
      onSaved?.()
    } catch (err) {
      setError(errMessage(err, 'Could not save the group'))
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
      <div className="pd-ol-dialog pd-ol-wide pd-edm" role="dialog" aria-modal="true" aria-labelledby="pd-group-edit-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Tag size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Edit</p>
              <h2 id="pd-group-edit-title" className="pd-mod-item-name">Group Edit</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="pd-ol-body">
          <div className="pd-edm-grid">
            <div className="pd-edm-form">
              <p className="pd-edm-mode">{editId != null ? 'Editing selected group' : 'New group'}</p>
              <div className="pd-form-row">
                <label>Code</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional" />
              </div>
              <div className="pd-form-row">
                <label>Description</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="pd-form-row">
                <label>Description Arabic</label>
                <ArabicInput value={arabic} onValueChange={setArabic} source={name} />
              </div>
              <Toggle checked={applyDiscount} onChange={setApplyDiscount} label="Apply Discount" />
              {error ? <p className="pd-mfg-msg">{error}</p> : null}
              {hint ? <p className="pd-mfg-ok">{hint}</p> : null}
            </div>

            <div className="pd-edm-list">
              <p className="pd-edm-list-title">Group List</p>
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={3}>Loading…</td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No groups</td>
                      </tr>
                    ) : (
                      rows.map((g) => (
                        <tr
                          key={g.id}
                          className={editId === g.id ? 'is-selected' : undefined}
                          style={{ cursor: 'pointer' }}
                          onClick={() => selectRow(g)}
                        >
                          <td>{g.code || '—'}</td>
                          <td>{g.name}</td>
                          <td>{g.applyDiscount ? 'Yes' : 'No'}</td>
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
          <span className="pd-mfg-count">{rows.length} groups</span>
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn" onClick={clearForm} disabled={busy}>
            New
          </button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : editId != null ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub groups ──────────────────────────────────────────────────────── */

type SubRow = { id: number; groupId: number; name: string; arabic: string; backOfficeOnly: boolean }

function mapSub(s: Row): SubRow {
  return {
    id: num(s.subGroupId ?? s.SubGroupID),
    groupId: num(s.groupId ?? s.GroupID),
    name: str(s.subGroupDescription ?? s.SubGroupDescription),
    arabic: str(s.subGroupDescriptionArabic ?? s.SubGroupDescriptionArabic),
    backOfficeOnly: flag(s.showOnlyOnBackOffice ?? s.ShowOnlyOnBackOffice, false),
  }
}

export function SubGroupEditDialog({ onClose, onSaved }: Props) {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [rows, setRows] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [filterGroup, setFilterGroup] = useState(0)
  const [editId, setEditId] = useState<number | null>(null)
  const [groupId, setGroupId] = useState(0)
  const [name, setName] = useState('')
  const [arabic, setArabic] = useState('')
  const [backOfficeOnly, setBackOfficeOnly] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [g, s] = await Promise.all([apiService.fetchGroups(), apiService.fetchSubGroups()])
      setGroups(g.map(mapGroup).filter((x) => x.id > 0 && x.name))
      setRows(s.map(mapSub).filter((x) => x.id > 0 && x.name))
    } catch (err) {
      setError(errMessage(err, 'Could not load sub groups'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const groupName = (id: number) => groups.find((g) => g.id === id)?.name ?? '—'
  const visible = filterGroup ? rows.filter((r) => r.groupId === filterGroup) : rows

  function clearForm() {
    setEditId(null)
    setGroupId(filterGroup)
    setName('')
    setArabic('')
    setBackOfficeOnly(false)
    setError(null)
  }

  function selectRow(r: SubRow) {
    setEditId(r.id)
    setGroupId(r.groupId)
    setName(r.name)
    setArabic(r.arabic)
    setBackOfficeOnly(r.backOfficeOnly)
    setError(null)
    setHint(null)
  }

  async function save() {
    if (!groupId) {
      setError('Pick a Master Group')
      return
    }
    if (!name.trim()) {
      setError('Enter a Sub Group Name')
      return
    }
    setBusy(true)
    setError(null)
    const body = {
      groupId,
      subGroupDescription: name.trim(),
      subGroupDescriptionArabic: arabic.trim(),
      showOnlyOnBackOffice: backOfficeOnly,
    }
    try {
      if (editId != null) await apiService.updateSubGroup(editId, body)
      else await apiService.createSubGroup(body)
      setHint(editId != null ? 'Sub group updated' : 'Sub group saved')
      clearForm()
      await load()
      onSaved?.()
    } catch (err) {
      setError(errMessage(err, 'Could not save the sub group'))
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
      <div className="pd-ol-dialog pd-ol-wide pd-edm" role="dialog" aria-modal="true" aria-labelledby="pd-subgroup-edit-title">
        <div className="pd-mod-header">
          <div className="pd-mod-header-left">
            <div className="pd-mod-header-icon">
              <Layers size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="pd-mod-kicker">Edit</p>
              <h2 id="pd-subgroup-edit-title" className="pd-mod-item-name">SubGroup Edit</h2>
            </div>
          </div>
          <button type="button" className="pd-mod-x" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <div className="pd-ol-body">
          <div className="pd-edm-grid">
            <div className="pd-edm-form">
              <p className="pd-edm-mode">{editId != null ? 'Editing selected sub group' : 'New sub group'}</p>
              <div className="pd-form-row">
                <label>Master Group</label>
                <select value={groupId || ''} onChange={(e) => setGroupId(Number(e.target.value) || 0)}>
                  <option value="">Select…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-form-row">
                <label>Sub Group Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="pd-form-row">
                <label>Sub Group Name Arabic</label>
                <ArabicInput value={arabic} onValueChange={setArabic} source={name} />
              </div>
              <Toggle checked={backOfficeOnly} onChange={setBackOfficeOnly} label="Show only on Back Office" />
              {error ? <p className="pd-mfg-msg">{error}</p> : null}
              {hint ? <p className="pd-mfg-ok">{hint}</p> : null}
            </div>

            <div className="pd-edm-list">
              <div className="pd-edm-list-head">
                <p className="pd-edm-list-title">Sub Group List</p>
                <select value={filterGroup || ''} onChange={(e) => setFilterGroup(Number(e.target.value) || 0)}>
                  <option value="">All groups</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-grid-wrap">
                <table className="pd-grid">
                  <thead>
                    <tr>
                      <th>Sub Group</th>
                      <th>Master Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={2}>Loading…</td>
                      </tr>
                    ) : visible.length === 0 ? (
                      <tr>
                        <td colSpan={2}>No sub groups</td>
                      </tr>
                    ) : (
                      visible.map((r) => (
                        <tr
                          key={r.id}
                          className={editId === r.id ? 'is-selected' : undefined}
                          style={{ cursor: 'pointer' }}
                          onClick={() => selectRow(r)}
                        >
                          <td>{r.name}</td>
                          <td>{groupName(r.groupId)}</td>
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
          <span className="pd-mfg-count">{visible.length} sub groups</span>
          <span className="pd-mod-foot-spacer" />
          <button type="button" className="pd-mod-foot-btn" onClick={clearForm} disabled={busy}>
            New
          </button>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : editId != null ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
