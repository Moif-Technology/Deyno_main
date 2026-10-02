import { Star } from 'lucide-react'
import { categoryIcon } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function CategoryColumn({ ctx }: { ctx: PosCtx }) {
  const {
    groupId, groupStripRef, groupSubs, groups, onGroupClick, onGroupStripPointerDown,
    onGroupStripPointerMove, onGroupStripPointerUp, onStripTap, onSubGroupClick, onSubSubClick,
    onTopMoveClick, subGroupId, subSubGroupId, subSubs, topMoveActive, topMoveLoading,
  } = ctx
  return (
    <>
      <aside className="pd-cat-col">
        <button
          type="button"
          className={`pd-cat pd-top-move${topMoveActive ? ' is-active' : ''}`}
          onClick={onTopMoveClick}
          disabled={topMoveLoading}
        >
          <Star size={13} strokeWidth={2} />
          <span className="pd-cat-label">{topMoveLoading ? 'Loading…' : 'Top Move'}</span>
        </button>
        <div
          ref={groupStripRef}
          className="pd-cats"
          onPointerDown={onGroupStripPointerDown}
          onPointerMove={onGroupStripPointerMove}
          onPointerUp={onGroupStripPointerUp}
          onPointerCancel={onGroupStripPointerUp}
        >
          {groups.map((g) => {
            const GroupIcon = categoryIcon(g.name)
            const isGroupOn = groupId === g.id
            return (
              <div key={g.id} className="pd-cat-branch">
              <button
                type="button"
                  className={`pd-cat${isGroupOn ? ' is-active' : ''}`}
                  onClick={() => onStripTap(() => onGroupClick(g.id))}
                >
                  <GroupIcon size={13} strokeWidth={2} />
                  <span className="pd-cat-label">{g.name.toLowerCase()}</span>
                </button>
                {/* Subgroups expand indented under their group instead of
                   replacing the list with a new "screen". */}
                {isGroupOn && groupSubs.length ? (
                  <div className="pd-subcat-list">
                    {groupSubs.map((s) => {
                      const SubIcon = categoryIcon(s.name)
                      const isSubOn = subGroupId === s.id
                      return (
                        <div key={s.id} className="pd-cat-branch">
                          <button
                            type="button"
                            className={`pd-cat is-sub${isSubOn ? ' is-active' : ''}`}
                            onClick={() => onStripTap(() => onSubGroupClick(s.id))}
                          >
                            <SubIcon size={12} strokeWidth={2} />
                            <span className="pd-cat-label">{s.name.toLowerCase()}</span>
                          </button>
                          {isSubOn && subSubs.length ? (
                            <div className="pd-subcat-list pd-subsubcat-list">
                              {subSubs.map((ss) => {
                                const SubSubIcon = categoryIcon(ss.name)
                                return (
                                  <button
                                    key={ss.id}
                                    type="button"
                                    className={`pd-cat is-sub${subSubGroupId === ss.id ? ' is-active' : ''}`}
                                    onClick={() => onStripTap(() => onSubSubClick(ss.id))}
                                  >
                                    <SubSubIcon size={11} strokeWidth={2} />
                                    <span className="pd-cat-label">{ss.name.toLowerCase()}</span>
              </button>
            )
          })}
        </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
