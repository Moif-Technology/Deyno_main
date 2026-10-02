import { type PosCtx } from '../../main/usePosMain'

export function VatActivationBody({ ctx }: { ctx: PosCtx }) {
  const {
    entryModal, setupVat,
  } = ctx
  return (
    <>
      {entryModal === 'vatActivation' ? (
        <div className="pd-vat-body">
          <p className="pd-cat-msg">Click Setup VAT button to start VAT service</p>
          <button type="button" className="pd-mod-foot-btn is-ok" onClick={setupVat}>
            Setup VAT
          </button>
        </div>
      ) : null}
    </>
  )
}
