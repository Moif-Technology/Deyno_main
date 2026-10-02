import { type PosCtx } from '../../main/usePosMain'

export function CreditReceiptListBody({ ctx }: { ctx: PosCtx }) {
  const {
    entryModal, renderDisplayListBody,
  } = ctx
  return (
    <>
      {entryModal === 'creditReceiptList'
        ? renderDisplayListBody([{ label: '#' }, { label: 'Date' }, { label: 'Code' }, { label: 'Customer' }, { label: 'Previous O/S', num: true }, { label: 'Paid', num: true }, { label: 'New O/S', num: true }])
        : null}
    </>
  )
}
