import { CupSoda } from 'lucide-react'
import { type PosCtx } from '../main/usePosMain'

export function VariantPicker({ ctx }: { ctx: PosCtx }) {
  const {
    pickVariant, variantFor, variantsOf,
  } = ctx
  return (
    <>
      {variantFor
        ? (() => {
            const group = variantsOf(variantFor.p)[variantFor.step]
            if (!group) return null
            const isSize = /size/i.test(group.type)
            return (
              <div
                className="vrt-wrap"
                style={{ left: variantFor.x, top: variantFor.y }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={`Choose ${group.type} for ${variantFor.p.name}`}
              >
                <span className="vrt-cap">{group.type}</span>
                <div className="vrt-bar">
                  {group.options.map((option, i) => (
                    <button key={option} type="button" className="vrt-size" title={option} onClick={() => pickVariant(option)}>
                      {isSize ? <CupSoda size={Math.min(13 + i * 3, 22)} strokeWidth={2} /> : null}
                      <b>{isSize && group.options.length <= 4 ? option.charAt(0).toUpperCase() : option}</b>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()
        : null}
    </>
  )
}
