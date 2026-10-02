import { Search, X } from 'lucide-react'
import { money } from '../../main/posHelpers'
import { type PosCtx } from '../../main/usePosMain'

export function ProductListEditBody({ ctx }: { ctx: PosCtx }) {
  const {
    allProducts, allSubGroups, editListedProduct, ef, entryModal, groups, setEf, setTxnSelected,
    shownEditProducts, txnSelected,
  } = ctx
  return (
    <>
      {entryModal === 'productListEdit' ? (
        <>
          {/* One toolbar: search (filters as you type) · group · subgroup. */}
          <div className="lst-bar">
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('searchValue')}
                onChange={(e) => setEf('searchValue', e.target.value)}
                placeholder="Search item name or barcode"
                autoFocus
              />
              {ef('searchValue') ? (
                <button type="button" onClick={() => setEf('searchValue', '')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <select
              className="lst-select"
              value={ef('pleGroup')}
              onChange={(e) => {
                setEf('pleGroup', e.target.value)
                setEf('pleSubGroup', '')
              }}
              aria-label="Group"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              className="lst-select"
              value={ef('pleSubGroup')}
              onChange={(e) => setEf('pleSubGroup', e.target.value)}
              disabled={!ef('pleGroup')}
              aria-label="Subgroup"
            >
              <option value="">All subgroups</option>
              {allSubGroups
                .filter((sg) => sg.groupId === groups.find((g) => g.name === ef('pleGroup'))?.id)
                .map((sg) => (
                  <option key={sg.id} value={sg.name}>
                    {sg.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Item</th>
                  <th className="num">Price</th>
                  <th className="num">VAT</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {shownEditProducts.slice(0, 300).map((p) => (
                  <tr
                    key={p.id}
                    className={txnSelected === p.id ? 'is-selected' : undefined}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setTxnSelected(p.id)}
                    onDoubleClick={() => editListedProduct(p.id)}
                  >
                    <td>{p.barcode || '—'}</td>
                    <td>{p.name}</td>
                    <td className="num">{money(p.price)}</td>
                    <td className="num">{money(p.taxAmount)}</td>
                    <td className="num">{money(p.price + p.taxAmount)}</td>
                  </tr>
                ))}
                {shownEditProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{allProducts.length === 0 ? 'No products loaded' : 'No product matches'}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
