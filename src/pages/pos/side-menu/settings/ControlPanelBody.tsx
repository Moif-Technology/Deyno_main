import { digits } from '../../../../utils/validate'
import { Settings as SettingsIcon } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function ControlPanelBody({ ctx }: { ctx: PosCtx }) {
  const {
    controlPanelTab, ef, entryModal, setControlPanelTab, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'controlPanel' ? (
        <div className="cpl">
          {/* Top: section tabs */}
          <nav className="cpl-nav" aria-label="Settings sections">
            {['Company Details', 'Main Form', 'KOT', 'Bill', 'Mail Sending', 'General', 'Game Zone', 'Tax Settings'].map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  className={controlPanelTab === tab ? 'is-on' : undefined}
                  onClick={() => setControlPanelTab(tab)}
                >
                  {tab}
                </button>
              ),
            )}
          </nav>

          {/* Below: the section */}
          {controlPanelTab === 'Company Details' ? (
            <div className="cpl-pane">
              <div className="cpl-form">
                <p className="cpl-title">Bill header</p>
                {[1, 2, 3, 4, 5].map((n) => (
                  <div className="pd-form-row" key={n}>
                    <label>Heading {n}</label>
                    <input
                      value={ef(`cpHeading${n}`)}
                      placeholder={n === 1 ? 'Company name' : undefined}
                      onChange={(e) => setEf(`cpHeading${n}`, e.target.value)}
                    />
                  </div>
                ))}
                <div className="pd-form-row">
                  <label>Tax Reg. No</label>
                  <input
                    value={ef('cpTaxRegNo')}
                    inputMode="numeric"
                    onChange={(e) => setEf('cpTaxRegNo', digits(e.target.value, 15))}
                  />
                </div>
                <p className="cpl-title">Bill footer</p>
                <div className="pd-form-row">
                  <label>Footer 1</label>
                  <input value={ef('cpFooter1')} onChange={(e) => setEf('cpFooter1', e.target.value)} />
                </div>
                <div className="pd-form-row">
                  <label>Footer 2</label>
                  <input value={ef('cpFooter2')} onChange={(e) => setEf('cpFooter2', e.target.value)} />
                </div>
              </div>

              {/* Live preview of the printed bill's header / footer */}
              <aside className="cpl-preview" aria-label="Bill preview">
                <span className="cpl-preview-tag">Preview</span>
                <div className="cpl-bill">
                  {[1, 2, 3, 4, 5].map((n) =>
                    ef(`cpHeading${n}`).trim() ? (
                      <p key={n} className={n === 1 ? 'is-name' : undefined}>
                        {ef(`cpHeading${n}`)}
                      </p>
                    ) : null,
                  )}
                  {ef('cpTaxRegNo') ? <p>TRN : {ef('cpTaxRegNo')}</p> : null}
                  <hr />
                  <p className="is-muted">— bill items —</p>
                  <hr />
                  {ef('cpFooter1').trim() ? <p>{ef('cpFooter1')}</p> : null}
                  {ef('cpFooter2').trim() ? <p>{ef('cpFooter2')}</p> : null}
                </div>
              </aside>
            </div>
          ) : (
            <div className="cpl-pane is-empty">
              <SettingsIcon size={26} />
              <strong>{controlPanelTab}</strong>
              <span>These settings are coming soon.</span>
            </div>
          )}
        </div>
      ) : null}
    </>
  )
}
