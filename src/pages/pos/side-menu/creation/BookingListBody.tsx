import { DatePicker } from '../../../../components/common/DatePicker'
import { type PosCtx } from '../../main/usePosMain'

export function BookingListBody({ ctx }: { ctx: PosCtx }) {
  const {
    bookings, ef, entryModal, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'bookingList' ? (
        <>
          <div className="pd-form-grid-2">
            <div className="pd-form-row">
              <label>From</label>
              <DatePicker value={ef('bookingFrom')} onChange={(v) => setEf('bookingFrom', v)} max={ef('bookingTo')} />
            </div>
            <div className="pd-form-row">
              <label>To</label>
              <DatePicker value={ef('bookingTo')} onChange={(v) => setEf('bookingTo', v)} min={ef('bookingFrom')} />
            </div>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>Booking Date</th>
                  <th>Party Size</th>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Area</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No bookings recorded this session</td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{b.date ? new Date(b.date).toLocaleDateString('en-GB') : '—'}</td>
                      <td>{b.partySize}</td>
                      <td>{b.customer}</td>
                      <td>{b.mobile}</td>
                      <td>{b.area}</td>
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
