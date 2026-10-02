import { StickyNote, Trash2, Plus, Check, PenLine } from 'lucide-react'
import { DatePicker } from '../../../../components/common/DatePicker'
import { type PosCtx } from '../../main/usePosMain'

export function NotesBody({ ctx }: { ctx: PosCtx }) {
  const {
    deleteNote, ef, entryModal, notesList, notesSelected, saveNote, setEf, setNotesSelected,
  } = ctx
  return (
    <>
      {entryModal === 'notes' ? (
        <div className="pd-nt">
          <div className={`pd-nt-pad${notesSelected != null ? ' is-editing' : ''}`}>
            <div className="pd-nt-pad-top">
              <span>
                <StickyNote size={14} />
                {notesSelected != null ? 'Editing note' : 'New note'}
              </span>
              {notesSelected != null ? (
                <span className="pd-nt-pad-actions">
                  <button
                    type="button"
                    className="pd-nt-new is-danger"
                    onClick={() => deleteNote(notesSelected)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                  <button
                    type="button"
                    className="pd-nt-new"
                    onClick={() => {
                      setNotesSelected(null)
                      setEf('noteDescription', '')
                    }}
                  >
                    <Plus size={13} /> New
                  </button>
                </span>
              ) : null}
            </div>
            <textarea
              rows={4}
              placeholder="Write a note…"
              value={ef('noteDescription')}
              onChange={(e) => setEf('noteDescription', e.target.value)}
            />
            <div className="pd-nt-pad-foot">
              <small>{ef('noteDescription').trim().length} characters</small>
              <button
                type="button"
                className="pd-nt-save"
                disabled={!ef('noteDescription').trim()}
                onClick={() => {
                  saveNote()
                  setNotesSelected(null)
                  setEf('noteDescription', '')
                }}
              >
                <Check size={14} strokeWidth={2.6} /> {notesSelected != null ? 'Update' : 'Save'}
              </button>
            </div>
          </div>

          <div className="pd-nt-bar">
            <b>
              Notes <em>{notesList.length}</em>
            </b>
            <div className="pd-nt-dates">
              <DatePicker value={ef('notesFrom')} onChange={(v) => setEf('notesFrom', v)} max={ef('notesTo')} />
              <span>to</span>
              <DatePicker value={ef('notesTo')} onChange={(v) => setEf('notesTo', v)} min={ef('notesFrom')} />
            </div>
          </div>

          <div className="pd-nt-board">
            {notesList.length === 0 ? (
              <div className="pd-nt-empty">
                <StickyNote size={26} strokeWidth={1.6} />
                <span>No notes yet — write your first one above.</span>
              </div>
            ) : (
              notesList.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  className={`pd-nt-card${notesSelected === n.id ? ' is-on' : ''}`}
                  onClick={() => {
                    setNotesSelected(n.id)
                    setEf('noteDescription', n.description)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setNotesSelected(n.id)
                      setEf('noteDescription', n.description)
                    }
                  }}
                >
                  <button
                    type="button"
                    className="pd-nt-del"
                    aria-label="Delete note"
                    title="Delete note"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(n.id)
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                  <span className="pd-nt-text">{n.description}</span>
                  <span className="pd-nt-date">
                    {n.date}
                    <PenLine size={11} />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
