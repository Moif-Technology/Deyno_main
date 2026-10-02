import { digits } from '../../../../utils/validate'
import { Plus, Trash2 } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function PrinterSetupBody({ ctx }: { ctx: PosCtx }) {
  const {
    addPrinterRow, entryModal, printerRows, setPrinterRows, setTd, td,
  } = ctx
  return (
    <>
      {entryModal === 'printerSetup' ? (
        <>
          {/* Add row */}
          <div className="prn-add">
            <div className="pd-form-row">
              <label>Counter No</label>
              <input
                value={td('counterNo')}
                inputMode="numeric"
                placeholder="e.g. 1"
                autoFocus
                onChange={(e) => setTd('counterNo', digits(e.target.value, 6))}
              />
            </div>
            <div className="pd-form-row">
              <label>Kitchen Location</label>
              <input
                value={td('kitchenLoc')}
                placeholder="e.g. Main Kitchen"
                onChange={(e) => setTd('kitchenLoc', e.target.value)}
              />
            </div>
            <div className="pd-form-row">
              <label>Printer Name</label>
              <input
                value={td('printerName')}
                placeholder="Windows printer name"
                onChange={(e) => setTd('printerName', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addPrinterRow()
                }}
              />
            </div>
            <button type="button" className="lst-btn is-primary" onClick={addPrinterRow}>
              <Plus size={14} />
              Add
            </button>
          </div>

          {/* Special printer IDs — tap one to use it as the Counter No. */}
          <div className="prn-ids">
            <span>Special IDs</span>
            {[
              ['99', 'No printer'],
              ['98', 'Delivery KOT'],
              ['97', 'Duplicate KOT'],
              ['96', 'Takeaway KOT'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={td('counterNo') === id ? 'is-on' : undefined}
                onClick={() => setTd('counterNo', id)}
              >
                <b>{id}</b> {label}
              </button>
            ))}
          </div>

          <div className="pd-grid-wrap">
            <table className="pd-grid prn-grid">
              <thead>
                <tr>
                  <th>Counter No</th>
                  <th>Kitchen Location</th>
                  <th>Printer Name</th>
                  <th className="col-menu" />
                </tr>
              </thead>
              <tbody>
                {printerRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No printers added yet</td>
                  </tr>
                ) : (
                  printerRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.counterNo}</td>
                      <td>{r.kitchenLoc || '—'}</td>
                      <td>{r.printerName || '—'}</td>
                      <td className="col-menu">
                        <button
                          type="button"
                          className="pd-row-delete"
                          onClick={() => setPrinterRows((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label="Remove printer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
