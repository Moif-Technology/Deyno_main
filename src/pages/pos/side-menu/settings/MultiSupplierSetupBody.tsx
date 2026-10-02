import { type PosCtx } from '../../main/usePosMain'

export function MultiSupplierSetupBody({ ctx }: { ctx: PosCtx }) {
  const {
    entryModal,
  } = ctx
  return (
    <>
      {entryModal === 'multiSupplierSetup' ? (
        <p className="pd-cat-msg">No additional suppliers configured yet</p>
      ) : null}
    </>
  )
}
