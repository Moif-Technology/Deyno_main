import {
  Banknote,
  ArrowRight,
  Percent,
  Ban,
  CircleOff,
  ClipboardList,
  FileText,
  MoreHorizontal,
  Save,
  Zap,
  MessageSquare,
  Printer,
  MapPinned,
  Receipt,
  Merge,
  RotateCcw,
  Package,
  Repeat,
  ShoppingBag,
  MinusCircle,
  StickyNote,
  CreditCard,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { type CSSProperties } from 'react'
import { NumberKeypad, BtnIcon } from '../main/posWidgets'
import { money } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function ActionPad({ ctx }: { ctx: PosCtx }) {
  const {
    closeMoreActions, entry, lines, loadReceiptCustomers, moreActionsOpen, moreBtnRef, moreClosing,
    moreFrom, onBillCancelClick, onDiscountClick, onDummyBill, onItemCancelClick, onKey,
    onKotJoinClick, onOrderListClick, onQtyClick, onReturnClick, onSaveKot, onSettlementClick,
    openEntryModal, openModifierForSelection, openMoreActions, padQty, remarks, requestAdmin,
    savingKot, setAreaOpen, setCommentsDraft, setCommentsOpen, setReceiptOpen, settleOpening,
    summary,
  } = ctx
  return (
    <>
      <div className="pd-actions">
        <div className="pd-actions-main">
        <div className="pd-keypad-wrap">
          <div className="pd-keypad-left">
            <div className="pd-entry">
              <span>{entry || '0'}</span>
              <button type="button" className="pd-entry-qty" onClick={onQtyClick}>
                QTY{padQty !== '1' ? ` ${padQty}` : ''}
              </button>
            </div>
            <NumberKeypad onKey={onKey} />
          </div>

          {/* Action tiles — 3 columns x 3 rows, in priority order:
             Save KOT (wide) · Discount / Cancel Bill · No Sale · Order List /
             Dummy Bill · More · Quick Cash. Everything else lives in More. */}
          <div className="pd-group-btns">
            <div className="pd-tiles">
              <button
                type="button"
                className="pd-tile is-primary is-cash"
                onClick={() => void onSettlementClick(true)}
                disabled={savingKot || settleOpening}
              >
                <Banknote className="pd-tile-ic" strokeWidth={2} />
                <span className="pd-tile-text">
                  <span className="pd-tile-label">Quick Cash</span>
                </span>
                <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
              </button>
              <button type="button" className="pd-tile" onClick={onDiscountClick}>
                <Percent className="pd-tile-ic" strokeWidth={2} />
                <span className="pd-tile-text">
                  <span className="pd-tile-label">Discount</span>
                </span>
                <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
              </button>
              <button type="button" className="pd-tile is-danger" onClick={onBillCancelClick}>
                <Ban className="pd-tile-ic" strokeWidth={2} />
                <span className="pd-tile-text">
                  <span className="pd-tile-label">Cancel Bill</span>
                </span>
                <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
              </button>
              <button type="button" className="pd-tile">
                <CircleOff className="pd-tile-ic" strokeWidth={2} />
                <span className="pd-tile-text">
                  <span className="pd-tile-label">No Sale</span>
                </span>
                <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
              </button>
              <button type="button" className="pd-tile" onClick={onOrderListClick}>
                <ClipboardList className="pd-tile-ic" strokeWidth={2} />
                <span className="pd-tile-text">
                  <span className="pd-tile-label">Order List</span>
                </span>
                <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
              </button>
              <button type="button" className="pd-tile" onClick={() => void onDummyBill()}>
                <FileText className="pd-tile-ic" strokeWidth={2} />
                <span className="pd-tile-text">
                  <span className="pd-tile-label">Dummy Bill</span>
                </span>
                <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
              </button>
              <button
                ref={moreBtnRef}
                type="button"
                className={`pd-tile${moreActionsOpen && !moreClosing ? ' is-active' : ''}`}
                onClick={() => (moreActionsOpen ? closeMoreActions() : openMoreActions())}
              >
                <MoreHorizontal className="pd-tile-ic" strokeWidth={2} />
                <span className="pd-tile-text">
                  <span className="pd-tile-label">More</span>
                </span>
                <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
              </button>
              <button
                type="button"
                className="pd-tile is-wide is-primary is-soft"
                onClick={() => void onSaveKot()}
                disabled={savingKot}
              >
                <Save className="pd-tile-ic" strokeWidth={2} />
                <span className="pd-tile-text">
                  <span className="pd-tile-label">{savingKot ? 'Saving…' : 'Save KOT'}</span>
                  <small>Create kitchen order</small>
                </span>
                <ArrowRight className="pd-tile-arrow" strokeWidth={2} />
              </button>
            </div>

            {moreActionsOpen ? createPortal(
              // Centered modal. Any click inside — an item or the
              // backdrop — closes it with the zoom-out animation.
              <div
                className={`pd-more-overlay${moreClosing ? ' is-closing' : ''}`}
                style={{ ['--more-dx']: `${moreFrom.dx}px`, ['--more-dy']: `${moreFrom.dy}px` } as CSSProperties}
                role="presentation"
                onClick={closeMoreActions}
              >
              <div className="pd-more-menu" role="dialog" aria-modal="true" aria-label="More actions">
                <button type="button" className="pd-more-item" onClick={() => void onSaveKot()} disabled={savingKot}>
                <BtnIcon icon={Zap} /> <span>Quick KOT</span>
              </button>
              <button
                type="button"
                  className={`pd-more-item${remarks.trim() ? ' is-on' : ''}`}
                title={remarks.trim() || 'Comments'}
                onClick={() => {
                  setCommentsDraft(remarks)
                  setCommentsOpen(true)
                }}
              >
                <BtnIcon icon={MessageSquare} /> <span>Comments</span>
              </button>
                <button type="button" className="pd-more-item">
                  <BtnIcon icon={Printer} /> <span>KOT Print</span>
                </button>
                <button type="button" className="pd-more-item" onClick={() => setAreaOpen(true)}>
                  <BtnIcon icon={MapPinned} /> <span>Area Change</span>
                </button>
                <button
                  type="button"
                  className="pd-more-item"
                  onClick={() => {
                    setReceiptOpen(true)
                    void loadReceiptCustomers('')
                  }}
                >
                  <BtnIcon icon={Receipt} /> <span>Receipt</span>
                </button>
                <button
                  type="button"
                  className="pd-more-item"
                  onClick={onKotJoinClick}
                >
                  <BtnIcon icon={Merge} /> <span>KOT Join</span>
                    </button>
                <button type="button" className="pd-more-item" onClick={onReturnClick}>
                  <BtnIcon icon={RotateCcw} /> <span>Return</span>
                    </button>
                    <button type="button" className="pd-more-item">
                  <BtnIcon icon={Package} /> <span>Delivery</span>
                    </button>
                    <button type="button" className="pd-more-item">
                  <BtnIcon icon={Repeat} /> <span>KOT Reprint</span>
                    </button>
                <button type="button" className="pd-more-item" onClick={() => requestAdmin('bill-print')}>
                  <BtnIcon icon={Printer} /> <span>Print Bill</span>
                    </button>
                <button type="button" className="pd-more-item">
                  <BtnIcon icon={ShoppingBag} /> <span>Takeaway List</span>
                    </button>
                    <button type="button" className="pd-more-item">
                  <BtnIcon icon={ClipboardList} /> <span>Delivery List</span>
                    </button>
                <button type="button" className="pd-more-item is-danger" onClick={onItemCancelClick}>
                      <BtnIcon icon={MinusCircle} /> <span>Item Cancel</span>
                    </button>
                    <button type="button" className="pd-more-item" onClick={openModifierForSelection}>
                      <BtnIcon icon={StickyNote} /> <span>Kitchen Message</span>
                    </button>
                    <button type="button" className="pd-more-item" onClick={() => openEntryModal('cashInOut')}>
                      <BtnIcon icon={Banknote} /> <span>Cash In / Out</span>
                    </button>
                  </div>
              </div>,
              document.body,
                ) : null}
          </div>
        </div>

        <button
          type="button"
          className="pd-pay"
          onClick={() => void onSettlementClick()}
          disabled={settleOpening || savingKot || lines.length === 0}
        >
          <BtnIcon icon={CreditCard} size={16} />
          PAY <em>AED {money(summary.total)}</em>
          </button>
        </div>
      </div>
    </>
  )
}
