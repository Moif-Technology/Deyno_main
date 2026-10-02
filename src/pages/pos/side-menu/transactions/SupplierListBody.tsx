import { Search, X, Plus } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function SupplierListBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, setEf, shownSuppliers, toast,
  } = ctx
  return (
    <>
      {entryModal === 'supplierList' ? (
        <>
          {/* One toolbar row: live search over every column · New Supplier. */}
          <div className="lst-bar">
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('searchValue')}
                onChange={(e) => setEf('searchValue', e.target.value)}
                placeholder="Search name, code, phone or contact"
                autoFocus
              />
              {ef('searchValue') ? (
                <button type="button" onClick={() => setEf('searchValue', '')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <button type="button" className="lst-btn is-primary" onClick={() => toast('Add supplier — coming soon', 'info')}>
              <Plus size={14} />
              New Supplier
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Supplier Name</th>
                  <th>Telephone</th>
                  <th>Mobile</th>
                  <th>Contact Person</th>
                </tr>
              </thead>
              <tbody>
                {shownSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No supplier matches this search</td>
                  </tr>
                ) : null}
                {shownSuppliers.map((s) => (
                  <tr
                    key={s.code}
                    className={ef('supplierPick') === s.code ? 'is-selected' : undefined}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setEf('supplierPick', s.code)}
                  >
                    <td>{s.code}</td>
                    <td>{s.name}</td>
                    <td>{s.phone}</td>
                    <td>{s.mobile}</td>
                    <td>{s.contact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
