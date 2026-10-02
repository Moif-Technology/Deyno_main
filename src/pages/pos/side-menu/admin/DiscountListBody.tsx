import { Search, X, Plus } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function DiscountListBody({ ctx }: { ctx: PosCtx }) {
  const {
    allSubGroups, closeEntryModal, ef, entryModal, groups, setDiscountEntryOpen, setEf,
    setTxnSelected, shownDiscounts, txnLines, txnSelected,
  } = ctx
  return (
    <>
      {entryModal === 'discountList' ? (
        <>
          {/* One toolbar: group · subgroup · search · New. */}
          <div className="lst-bar">
            <select
              className="lst-select"
              value={ef('discGroup')}
              onChange={(e) => {
                setEf('discGroup', e.target.value)
                setEf('discSubGroup', '')
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
              value={ef('discSubGroup')}
              onChange={(e) => setEf('discSubGroup', e.target.value)}
              disabled={!ef('discGroup')}
              aria-label="Subgroup"
            >
              <option value="">All subgroups</option>
              {allSubGroups
                .filter((sg) => sg.groupId === groups.find((g) => g.name === ef('discGroup'))?.id)
                .map((sg) => (
                  <option key={sg.id} value={sg.name}>
                    {sg.name}
                  </option>
                ))}
            </select>
            <span className="lst-search">
              <Search size={14} />
              <input
                value={ef('searchValue')}
                onChange={(e) => setEf('searchValue', e.target.value)}
                placeholder="Search barcode or item"
              />
              {ef('searchValue') ? (
                <button type="button" onClick={() => setEf('searchValue', '')} aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : null}
            </span>
            <button
              type="button"
              className="lst-btn is-primary"
              onClick={() => {
                closeEntryModal()
                setDiscountEntryOpen(true)
              }}
            >
              <Plus size={14} />
              New Discount
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Description</th>
                  <th className="num">Price</th>
                  <th className="num">Disc %</th>
                  <th className="num">Disc</th>
                </tr>
              </thead>
              <tbody>
                {shownDiscounts.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      {txnLines.length && (ef('searchValue') || ef('discGroup')) ? 'No discount matches' : 'No discounts found'}
                    </td>
                  </tr>
                ) : (
                  shownDiscounts.map(({ l, i }) => (
                    <tr
                      key={i}
                      className={txnSelected === i ? 'is-selected' : undefined}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setTxnSelected(i)}
                    >
                      <td>{l.barcode}</td>
                      <td>{l.shortDesc}</td>
                      <td className="num">{l.sellingPrice}</td>
                      <td className="num">{l.discPct}</td>
                      <td className="num">{l.disAmt}</td>
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
