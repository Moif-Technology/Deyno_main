import { type PosCtx } from '../../main/usePosMain'

export function MessBillViewerBody({ ctx }: { ctx: PosCtx }) {
  const {
    entryModal, renderDisplayListBody,
  } = ctx
  return (
    <>
      {entryModal === 'messBillViewer'
        ? renderDisplayListBody([{ label: '#' }, { label: 'Date' }, { label: 'Code' }, { label: 'Customer' }, { label: 'Mess Item' }])
        : null}
    </>
  )
}
