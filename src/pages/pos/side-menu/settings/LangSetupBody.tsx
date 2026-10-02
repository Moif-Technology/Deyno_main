import { ArabicInput } from '../../../../components/common/ArabicInput'
import { Plus, Search, X, Trash2 } from 'lucide-react'
import { type PosCtx } from '../../main/usePosMain'

export function LangSetupBody({ ctx }: { ctx: PosCtx }) {
  const {
    addLangRow, ef, entryModal, langRows, notifyTranslateDown, setEf, setLangRows, setTd,
    setTdWithArabicAutoFill, shownLangRows, td,
  } = ctx
  return (
    <>
      {entryModal === 'langSetup' ? (
        <>
          {/* Add row: English → Arabic fills in automatically, and can be edited. */}
          <div className="lng-add">
            <div className="pd-form-row">
              <label>English</label>
              <input
                placeholder="e.g. Thank you"
                value={td('enText')}
                autoFocus
                onChange={(e) => setTdWithArabicAutoFill('enText', 'arText', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addLangRow()
                }}
              />
            </div>
            <div className="pd-form-row">
              <label>Arabic</label>
              <ArabicInput
                placeholder="الوصف"
                value={td('arText')}
                onValueChange={(v) => setTd('arText', v)}
                source={td('enText')}
                onTranslateError={notifyTranslateDown}
              />
            </div>
            <button type="button" className="lst-btn is-primary" onClick={addLangRow}>
              <Plus size={14} />
              Add
            </button>
          </div>

          {langRows.length > 0 ? (
            <div className="lst-bar">
              <span className="lst-search">
                <Search size={14} />
                <input
                  value={ef('searchValue')}
                  onChange={(e) => setEf('searchValue', e.target.value)}
                  placeholder="Search English or Arabic"
                />
                {ef('searchValue') ? (
                  <button type="button" onClick={() => setEf('searchValue', '')} aria-label="Clear search">
                    <X size={12} />
                  </button>
                ) : null}
              </span>
            </div>
          ) : null}

          <div className="pd-grid-wrap">
            <table className="pd-grid lng-grid">
              <thead>
                <tr>
                  <th>English</th>
                  <th className="lng-ar">Arabic</th>
                  <th className="col-menu" />
                </tr>
              </thead>
              <tbody>
                {shownLangRows.length === 0 ? (
                  <tr>
                    <td colSpan={3}>{langRows.length ? 'No entry matches this search' : 'No entries added yet'}</td>
                  </tr>
                ) : (
                  shownLangRows.map(({ r, i }) => (
                    <tr key={i}>
                      <td>{r.en}</td>
                      <td dir="rtl" className="lng-ar">
                        {r.ar || '—'}
                      </td>
                      <td className="col-menu">
                        <button
                          type="button"
                          className="pd-row-delete"
                          onClick={() => setLangRows((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label="Remove entry"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
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
