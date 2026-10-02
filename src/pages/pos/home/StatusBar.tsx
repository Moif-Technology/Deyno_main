import { formatClock } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function StatusBar({ ctx }: { ctx: PosCtx }) {
  const {
    now, waiter,
  } = ctx
  return (
    <>
      <footer className="pd-status">
        <span>
          Counter 01&nbsp;&nbsp;&nbsp;{waiter.toUpperCase()} : {waiter.toUpperCase()}
        </span>
        <span>{formatClock(now)}</span>
      </footer>
    </>
  )
}
