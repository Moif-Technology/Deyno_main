import { TableCard } from '../../../../components/common/TableCard'
import { type PosCtx } from '../../main/usePosMain'

export function FloorDesignBody({ ctx }: { ctx: PosCtx }) {
  const {
    areas, entryModal, floorAreaId, floorBusy, loadFloorDesign, setFloorAreaId, tables, toast,
  } = ctx
  return (
    <>
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
                    <TableCard key={t.id} label={t.name} seats={t.seats} shape={t.format} status="free" />
                  ))}
              </div>
            ) : (
              <p className="pd-cat-msg">Pick an Area to load its floor layout</p>
            )}
          </div>
        </>
      ) : null}
    </>
  )
}
