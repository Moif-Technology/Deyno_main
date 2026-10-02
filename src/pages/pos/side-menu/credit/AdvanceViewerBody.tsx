import { type PosCtx } from '../../main/usePosMain'

export function AdvanceViewerBody({ ctx }: { ctx: PosCtx }) {
  const {
    entryModal, renderDisplayListBody,
  } = ctx
  return (
    <>
      {entryModal === 'advanceViewer'
        ? renderDisplayListBody([{ label: '#' }, { label: 'Date' }, { label: 'Code' }, { label: 'Customer' }, { label: 'Pay Mode' }, { label: 'Entered By' }, { label: 'Amount', num: true }])
        : null}
    </>
  )
}
