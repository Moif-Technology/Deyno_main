import { SearchBar } from '../../../components/common/SearchBar'
import { ScanBarcode } from 'lucide-react'
import { type PosCtx } from '../main/usePosMain'

export function CatalogueSearch({ ctx }: { ctx: PosCtx }) {
  const {
    crumb, products, query, searchInputRef, setQuery,
  } = ctx
  return (
    <>
      <div className="pd-search-row">
        {crumb ? (
          <div className="pd-crumb">
            <span className="pd-crumb-title">{crumb}</span>
            <span className="pd-crumb-count">{products.length} items</span>
          </div>
        ) : null}
        <SearchBar
            ref={searchInputRef}
          size="sm"
            value={query}
          onValueChange={setQuery}
            placeholder="Search item / barcode"
          />
        <button
          type="button"
          className="pd-barcode-btn"
          aria-label="Scan barcode"
          onClick={() => searchInputRef.current?.focus()}
        >
          <ScanBarcode size={14} />
        </button>
      </div>
    </>
  )
}
