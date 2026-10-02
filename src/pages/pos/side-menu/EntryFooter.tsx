import { printViewerBill } from '../../../lib/printSettlementBill'
import { Printer } from 'lucide-react'
import { ENTRY_META } from '../main/posMenu'
import { PRIVILEGE_PAGES } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

/** Footer buttons for the generic "Creation" master-entry modal — varies
   * per screen (New/Save/Close, Save/Close, Confirm/Close, etc.) to match
   * what each legacy screen actually offered. */
export function renderEntryFooter(ctx: PosCtx) {
  const {
    activateSelectedCard, allProducts, cashMode, clearAccessCard, closeEntryModal, comboGroups,
    confirmBooking, deleteSelectedTxnLine, deleteSelectedUser, editListedProduct, ef, entryModal,
    entrySaving, floorBusy, groups, langRows, messLines, mrSelectedGroups, printBarcode, printReport,
    printerRows, privUserCode, privilegeChecks, removeSelectedDiscount, reprintBills, reprintRaw,
    saveAddOn, saveAreaEntry, saveCombo, saveControlPanel, saveDiscountPercent, saveFloorDesignEntry,
    saveGroupEntry, saveMainGroupEntry, saveMessMaster, saveMultiSupplierSetup, saveOnlineSource,
    savePassword, savePaymentMode, savePrivileges, saveRecipe, saveSubGroupEntry, saveTableEntry,
    saveTxn, selectTxnRow, setCashMode, setComboGroupInput, setComboGroups, setEf, setEntryForm,
    setMessLines, setMrSelectedGroups, shownDiscounts, shownEditProducts, shownLangRows,
    shownSuppliers, shownUsers, suppliers, toast, txnLines, txnSelected, userListRows,
    userListSelected,
  } = ctx
    if (!entryModal) return null
    switch (entryModal) {
      case 'area':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveAreaEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'table':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveTableEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'mainGroup':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveMainGroupEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'group':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveGroupEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'subGroup':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={entrySaving} onClick={() => void saveSubGroupEntry()}>
              {entrySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )
      case 'kitchenMessage':
        return null
      case 'combo':
        return (
          <>
                <button
                  type="button"
              className="pd-mod-foot-btn"
              disabled={comboGroups.length === 0}
              onClick={() => {
                setComboGroups([])
                setComboGroupInput('')
              }}
            >
              Remove from list
                </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveCombo}>
              Save
            </button>
          </>
        )
      case 'recipe':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveRecipe}>
              Save
            </button>
          </>
        )
      case 'barcode':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={printBarcode}>
              Print
            </button>
          </>
        )
      case 'notes':
        return null
      case 'onlineSource':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveOnlineSource}>
              Save
            </button>
                  </div>
        )
      case 'paymentMode':
        return (
          <div className="pd-mod-foot-center">
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={savePaymentMode}>
              Save
            </button>
              </div>
            )
      case 'messMaster':
        return (
          <>
            <button
              type="button"
              className="pd-mod-foot-btn"
              disabled={messLines.length === 0}
              onClick={() => setMessLines([])}
            >
              Remove from list
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveMessMaster}>
              Save
            </button>
          </>
        )
      case 'addOn':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => setEntryForm({})}>
              Add New
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveAddOn}>
              Save
            </button>
          </>
        )
      case 'booking':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={confirmBooking}>
              Confirm
            </button>
          </>
        )
      case 'bookingList':
        return null
      case 'floorDesign':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" disabled={floorBusy} onClick={() => void saveFloorDesignEntry()}>
              {floorBusy ? 'Saving…' : 'Save'}
            </button>
          </>
        )
      case 'stockAdjustment':
      case 'damageEntry':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={deleteSelectedTxnLine}>
              Delete Raw
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn(ENTRY_META[entryModal].label)}>
              Save
            </button>
          </>
        )
      case 'stockReport':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Report shown below (mock data)', 'success')}>
              Show Report
            </button>
          </>
        )
      case 'movementReport':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Report shown below (mock data)', 'success')}>
              Show
            </button>
          </>
        )
      case 'stockAdjustList':
      case 'productionList':
      case 'transferList':
      case 'receiptList':
      case 'damageList':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={selectTxnRow}>
              Select
            </button>
          </>
        )
      case 'supplierList':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Count <b>{shownSuppliers.length}</b>
              {shownSuppliers.length !== suppliers.length ? ` of ${suppliers.length}` : ''}
            </span>
            <span className="pd-mod-foot-spacer" />
            <button
              type="button"
              className="pd-mod-foot-btn"
              onClick={() => toast(ef('supplierPick') ? 'Delete supplier — coming soon' : 'Pick a supplier row first', ef('supplierPick') ? 'info' : undefined)}
            >
              Delete
            </button>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={selectTxnRow}>
              Select
            </button>
          </>
        )
      case 'purchaseList':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Count <b>0</b> · Total <b>AED 0.00</b>
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Pick a purchase row first')}>
              Delete
            </button>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={selectTxnRow}>
              Select
            </button>
          </>
        )
      case 'purchaseReturnList':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Count <b>0</b> · Total <b>AED 0.00</b>
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Pick a return row first')}>
              Delete
            </button>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={selectTxnRow}>
              Select
            </button>
          </>
        )
      case 'osBalanceList':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Customers <b>0</b> · Total O/S <b>AED 0.00</b>
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
              Print
            </button>
          </>
        )
      case 'advanceViewer':
      case 'creditReceiptList':
      case 'messBillViewer':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Count <b>0</b>
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
              Print
            </button>
          </>
        )
      case 'paymentList':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={printReport}>
              Print
            </button>
            <span className="pd-mod-foot-spacer" />
          </>
        )
      case 'billReprint':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Bills <b>{reprintBills.length}</b>
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('Other Bill — coming soon', 'info')}>
              Other Bill
            </button>
            <button type="button" className="pd-mod-foot-btn" onClick={() => toast('KOT Print — coming soon', 'info')}>
              KOT Print
            </button>
            <button
              type="button"
              className="pd-mod-foot-btn is-ok"
              disabled={!reprintRaw}
              onClick={() => {
                if (!reprintRaw) return
                void printViewerBill(reprintRaw).catch((err) => {
                  toast(err instanceof Error ? err.message : 'Bill print failed')
                })
              }}
            >
              <Printer size={14} /> Print
            </button>
          </>
        )
      case 'counterCloseReportsRP':
        return (
          <>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" onClick={selectTxnRow}>
              Select
            </button>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={printReport}>
              <Printer size={14} /> Print
            </button>
          </>
        )
      case 'delBoyCommission':
        return (
          <>
            <button
              type="button"
              className="pd-mod-foot-btn"
              onClick={() =>
                setMrSelectedGroups(mrSelectedGroups.size === groups.length ? new Set() : new Set(groups.map((g) => g.id)))
              }
            >
              {groups.length > 0 && mrSelectedGroups.size === groups.length ? 'Uncheck All' : 'Check All'}
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={printReport}>
              <Printer size={14} /> Print
            </button>
          </>
        )
      case 'areawiseA4':
        return (
          <>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Report shown below (mock data)', 'success')}>
              Show
            </button>
          </>
        )
      case 'waiterwise':
        return (
          <>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Report shown below (mock data)', 'success')}>
              Show
            </button>
          </>
        )
      case 'areaWiseReportRP':
      case 'groupWiseRP':
      case 'itemWiseRP':
      case 'itemVoidReportRP':
      case 'cancelBillDetails':
      case 'cancelBillSummary':
      case 'salesBillWiseRP':
      case 'dayWiseRP':
      case 'taxReport':
      case 'vatSale':
      case 'vatPurchase':
      case 'pendingOrderList':
      case 'counterWiseA4':
      case 'counterWiseTimewise':
      case 'itemwiseSummary':
      case 'itemwiseDetails':
      case 'salesmanWise':
      case 'customerAnalysisDetailed':
      case 'customerAnalysisSummary':
      case 'counterCloseDetailsA4':
      case 'incomeExpense':
      case 'productionReport':
      case 'itemVoidA4':
      case 'graphReport':
      case 'itemwiseViewer':
      case 'productMovementFast':
      case 'productMovementSlow':
      case 'dayCloseReport':
        return (
          <>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={printReport}>
              <Printer size={14} /> Print
            </button>
          </>
        )
      case 'incomeExpenseEntry':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={deleteSelectedTxnLine}>
              Delete Raw
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => saveTxn('Income/Expense entry')}>
              Save
            </button>
          </>
        )
      case 'discountList':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Count <b>{shownDiscounts.length}</b>
              {shownDiscounts.length !== txnLines.length ? ` of ${txnLines.length}` : ''}
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-close" onClick={removeSelectedDiscount}>
              Remove Discount
            </button>
          </>
        )
      case 'changeSettlement':
        return (
          <>
            <span className="cs-change">
              Change to
              <span className="lst-seg" role="radiogroup" aria-label="Change to">
                {[
                  ['CASH', 'Cash'],
                  ['CREDIT CARD', 'Card'],
                  ['CREDIT', 'Credit'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={ef('csNewMode') === value}
                    className={ef('csNewMode') === value ? 'is-on' : undefined}
                    onClick={() => setEf('csNewMode', value)}
                    disabled={!ef('csPick')}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </span>
            <span className="pd-mod-foot-spacer" />
            <button
              type="button"
              className="pd-mod-foot-btn is-ok"
              disabled={!ef('csPick') || !ef('csNewMode')}
              onClick={() => toast('Settlement updated', 'success')}
            >
              Update
            </button>
          </>
        )
      case 'vatActivation':
        return null
      case 'productListEdit':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Count <b>{shownEditProducts.length}</b>
              {shownEditProducts.length !== allProducts.length ? ` of ${allProducts.length}` : ''}
            </span>
            <span className="pd-mod-foot-spacer" />
            <button
              type="button"
              className="pd-mod-foot-btn is-ok"
              disabled={txnSelected == null}
              onClick={() => txnSelected != null && editListedProduct(txnSelected)}
            >
              Edit
            </button>
          </>
        )
      case 'changeDiscountPercent':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-close" onClick={closeEntryModal}>
              Cancel
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveDiscountPercent}>
              Save
            </button>
          </>
        )
      case 'eventLogs':
        return null
      case 'printerSetup':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Printers <b>{printerRows.length}</b>
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Printer setup saved', 'success')}>
              Save
            </button>
          </>
        )
      case 'userList':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Users <b>{shownUsers.length}</b>
              {shownUsers.length !== userListRows.length ? ` of ${userListRows.length}` : ''}
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-close" onClick={deleteSelectedUser} disabled={!userListSelected}>
              Delete
            </button>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={closeEntryModal} disabled={!userListSelected}>
              Select
            </button>
          </>
        )
      case 'activateAccessCard':
        return (
          <>
            <span className="pd-mfg-count lst-count">Card numbers are never shown.</span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-close" onClick={clearAccessCard}>
              Clear Card
            </button>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={activateSelectedCard}>
              Activate
            </button>
          </>
        )
      case 'privilegeSetup':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              {userListRows.find((u) => u.code === privUserCode)?.name ?? 'User'}: allowed <b>{privilegeChecks.size}</b> of {PRIVILEGE_PAGES.length}
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={savePrivileges}>
              Save
            </button>
          </>
        )
      case 'controlPanel':
        return (
          <>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveControlPanel}>
              Save
            </button>
          </>
        )
      case 'passwordChange':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={savePassword}>
              Save
            </button>
          </>
        )
      case 'langSetup':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Entries <b>{shownLangRows.length}</b>
              {shownLangRows.length !== langRows.length ? ` of ${langRows.length}` : ''}
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={() => toast('Language settings saved', 'success')}>
              Save
            </button>
          </>
        )
      case 'partyOrderList':
        return (
          <>
            <span className="pd-mfg-count lst-count">
              Orders <b>0</b>
            </span>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn" disabled={!ef('poiName')} onClick={printReport}>
              Bill Reprint
            </button>
            <button
              type="button"
              className="pd-mod-foot-btn"
              disabled={!ef('poiName')}
              onClick={() => toast('Settlement — coming soon', 'info')}
            >
              Settlement
            </button>
            <button
              type="button"
              className="pd-mod-foot-btn is-ok"
              disabled={!ef('poiName')}
              onClick={() => toast('Order marked ready', 'success')}
            >
              Order Ready
            </button>
          </>
        )
      case 'multiSupplierSetup':
        return (
          <>
            <button type="button" className="pd-mod-foot-btn is-ok" onClick={saveMultiSupplierSetup}>
              Save
            </button>
          </>
        )
      case 'vatCorrectionUtility':
        return null
      case 'cashInOut':
        return cashMode === 'pick' ? (
          <button type="button" className="pd-mod-foot-btn is-close pd-cash-cancel" onClick={closeEntryModal}>
            Cancel
          </button>
        ) : (
          <>
            <button type="button" className="pd-mod-foot-btn" onClick={() => setCashMode('pick')}>
              Back
            </button>
            <span className="pd-mod-foot-spacer" />
            <button type="button" className="pd-mod-foot-btn is-close" onClick={closeEntryModal}>
              Close
            </button>
          </>
        )
      default:
        return null
    }
}
