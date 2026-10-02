import { DatePicker } from '../../../../components/common/DatePicker'
import { phone, digits, decimal } from '../../../../utils/validate'
import { type PosCtx } from '../../main/usePosMain'

export function BookingBody({ ctx }: { ctx: PosCtx }) {
  const {
    bookingAreaTab, ef, entryModal, setBookingAreaTab, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'booking' ? (
        <>
          <div className="pd-booking-tabs">
            {(['DINE IN', 'UPSTAIR', 'OUTSIDE'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`pd-booking-tab${bookingAreaTab === t ? ' is-on' : ''}`}
                onClick={() => setBookingAreaTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="pd-form-row">
            <label>Booking Date</label>
            <DatePicker value={ef('bookingDate')} onChange={(v) => setEf('bookingDate', v)} />
          </div>
          <div className="pd-form-row">
            <label>Customer</label>
            <input value={ef('bookCustomer')} onChange={(e) => setEf('bookCustomer', e.target.value)} />
          </div>
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>Mobile</label>
              <input value={ef('bookMobile')} onChange={(e) => setEf('bookMobile', phone(e.target.value))} />
            </div>
            <div className="pd-form-row">
              <label>Party Size</label>
              <input value={ef('bookPartySize')} onChange={(e) => setEf('bookPartySize', digits(e.target.value))} />
            </div>
          </div>
          <div className="pd-form-row">
            <label>Advance Amount</label>
            <input value={ef('bookAdvance')} onChange={(e) => setEf('bookAdvance', decimal(e.target.value))} />
          </div>
        </>
      ) : null}
    </>
  )
}
