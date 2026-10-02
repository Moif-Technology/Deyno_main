import { DatePicker } from '../../../../components/common/DatePicker'
import { SearchBar } from '../../../../components/common/SearchBar'
import { type PosCtx } from '../../main/usePosMain'

export function EventLogsBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, printReport, searchEventLogs, setEf, setEntryForm, toast,
  } = ctx
  return (
    <>
      {entryModal === 'eventLogs' ? (
        <>
          <div className="pd-el-stats">
            <div className="pd-el-stat">
              <span>Total Logs</span>
              <strong>0</strong>
            </div>
            <div className="pd-el-stat">
              <span>Success</span>
              <strong>0</strong>
            </div>
            <div className="pd-el-stat">
              <span>Failed</span>
              <strong>0</strong>
            </div>
            <div className="pd-el-stat">
              <span>Today</span>
              <strong>0</strong>
            </div>
          </div>
          <div className="pd-form-grid-3">
            <div className="pd-form-row">
              <label>From Date</label>
              <DatePicker value={ef('elFrom')} onChange={(v) => setEf('elFrom', v)} max={ef('elTo')} />
            </div>
            <div className="pd-form-row">
              <label>To Date</label>
              <DatePicker value={ef('elTo')} onChange={(v) => setEf('elTo', v)} min={ef('elFrom')} />
            </div>
            <div className="pd-form-row">
              <label>Staff</label>
              <input value={ef('elStaff')} onChange={(e) => setEf('elStaff', e.target.value)} />
            </div>
          </div>
          <div className="pd-form-grid-3">
            <div className="pd-form-row">
              <label>Action</label>
              <select value={ef('elAction')} onChange={(e) => setEf('elAction', e.target.value)}>
                <option value="ALL">ALL</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="pd-form-row">
              <label>Source</label>
              <select value={ef('elSource')} onChange={(e) => setEf('elSource', e.target.value)}>
                <option value="ALL">ALL</option>
                <option value="POS">POS</option>
                <option value="BACKOFFICE">BACKOFFICE</option>
              </select>
            </div>
            <div className="pd-form-row">
              <label>Status</label>
              <select value={ef('elStatus')} onChange={(e) => setEf('elStatus', e.target.value)}>
                <option value="ALL">ALL</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>
          <div className="pd-form-code">
            <SearchBar
              size="sm"
              placeholder="Search logs"
              value={ef('elSearch')}
              onValueChange={(v) => setEf('elSearch', v)}
              onSubmit={() => searchEventLogs()}
            />
            <button type="button" className="pd-form-code-btn" onClick={searchEventLogs}>
              Search
            </button>
            <button type="button" className="pd-form-code-btn" onClick={() => setEntryForm({})}>
              Clear
            </button>
            <button type="button" className="pd-form-code-btn" onClick={() => toast('Logs refreshed', 'success')}>
              Refresh
            </button>
            <button type="button" className="pd-form-code-btn" onClick={() => toast('Exported', 'success')}>
              Export
            </button>
            <button type="button" className="pd-form-code-btn" onClick={printReport}>
              Print
            </button>
          </div>
          <div className="pd-grid-wrap">
            <table className="pd-grid">
              <thead>
                <tr>
                  <th>LogID</th>
                  <th>LoggedAt</th>
                  <th>ActionCode</th>
                  <th>ActionLabel</th>
                  <th>EntityType</th>
                  <th>CounterNo</th>
                  <th>StaffName</th>
                  <th>Success</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={8}>No log entries found</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
