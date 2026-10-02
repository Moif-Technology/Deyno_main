import { X } from 'lucide-react'
import { type EntryKey } from '../main/posTypes'
import { ENTRY_META, navSectionOf } from '../main/posMenu'
import { AreaBody } from './creation/AreaBody'
import { TableBody } from './creation/TableBody'
import { MainGroupBody } from './creation/MainGroupBody'
import { GroupBody } from './creation/GroupBody'
import { SubGroupBody } from './creation/SubGroupBody'
import { KitchenMessageBody } from './creation/KitchenMessageBody'
import { ComboBody } from './creation/ComboBody'
import { RecipeBody } from './manufacturing/RecipeBody'
import { BarcodeBody } from './creation/BarcodeBody'
import { NotesBody } from './creation/NotesBody'
import { OnlineSourceBody } from './creation/OnlineSourceBody'
import { PaymentModeBody } from './creation/PaymentModeBody'
import { MessMasterBody } from './creation/MessMasterBody'
import { AddOnBody } from './creation/AddOnBody'
import { BookingBody } from './creation/BookingBody'
import { BookingListBody } from './creation/BookingListBody'
import { FloorDesignBody } from './creation/FloorDesignBody'
import { StockAdjustmentBody } from './transactions/StockAdjustmentBody'
import { StockAdjustListBody } from './transactions/StockAdjustListBody'
import { ComboEditBody } from './edit/ComboEditBody'
import { ProductionListBody } from './manufacturing/ProductionListBody'
import { StockReportBody } from './transactions/StockReportBody'
import { MovementReportBody } from './transactions/MovementReportBody'
import { TransferListBody } from './transactions/TransferListBody'
import { SupplierListBody } from './transactions/SupplierListBody'
import { PurchaseListBody } from './transactions/PurchaseListBody'
import { DamageEntryBody } from './transactions/DamageEntryBody'
import { PaymentListBody } from './credit/PaymentListBody'
import { OsBalanceListBody } from './credit/OsBalanceListBody'
import { CreditReceiptListBody } from './credit/CreditReceiptListBody'
import { AdvanceViewerBody } from './credit/AdvanceViewerBody'
import { MessBillViewerBody } from './credit/MessBillViewerBody'
import { BillReprintBody } from './reports/BillReprintBody'
import { AreaWiseReportRPBody } from './reports/AreaWiseReportRPBody'
import { ItemVoidReportRPBody } from './reports/ItemVoidReportRPBody'
import { CancelBillDetailsBody } from './reports/CancelBillDetailsBody'
import { CancelBillSummaryBody } from './reports/CancelBillSummaryBody'
import { VatSaleBody } from './reports/VatSaleBody'
import { VatPurchaseBody } from './reports/VatPurchaseBody'
import { CounterCloseReportsRPBody } from './reports/CounterCloseReportsRPBody'
import { PendingOrderListBody } from './reports/PendingOrderListBody'
import { CounterWiseA4Body } from './reports/CounterWiseA4Body'
import { ItemwiseSummaryBody } from './reports/ItemwiseSummaryBody'
import { AreawiseA4Body } from './reports/AreawiseA4Body'
import { WaiterwiseBody } from './reports/WaiterwiseBody'
import { CustomerAnalysisDetailedBody } from './reports/CustomerAnalysisDetailedBody'
import { GraphReportBody } from './reports/GraphReportBody'
import { ItemwiseViewerBody } from './reports/ItemwiseViewerBody'
import { DelBoyCommissionBody } from './reports/DelBoyCommissionBody'
import { ProductMovementFastBody } from './reports/ProductMovementFastBody'
import { DayCloseReportBody } from './admin/DayCloseReportBody'
import { IncomeExpenseEntryBody } from './other/IncomeExpenseEntryBody'
import { DiscountListBody } from './admin/DiscountListBody'
import { ChangeSettlementBody } from './admin/ChangeSettlementBody'
import { VatActivationBody } from './other/VatActivationBody'
import { ProductListEditBody } from './admin/ProductListEditBody'
import { ChangeDiscountPercentBody } from './admin/ChangeDiscountPercentBody'
import { EventLogsBody } from './other/EventLogsBody'
import { PrinterSetupBody } from './settings/PrinterSetupBody'
import { UserListBody } from './settings/UserListBody'
import { ActivateAccessCardBody } from './settings/ActivateAccessCardBody'
import { PrivilegeSetupBody } from './settings/PrivilegeSetupBody'
import { ControlPanelBody } from './settings/ControlPanelBody'
import { PasswordChangeBody } from './settings/PasswordChangeBody'
import { LangSetupBody } from './settings/LangSetupBody'
import { PartyOrderListBody } from './settings/PartyOrderListBody'
import { MultiSupplierSetupBody } from './settings/MultiSupplierSetupBody'
import { VatCorrectionUtilityBody } from './settings/VatCorrectionUtilityBody'
import { CashInOutBody } from './transactions/CashInOutBody'
import { CashInOutBody2 } from './transactions/CashInOutBody2'
import { type PosCtx } from '../main/usePosMain'
import { renderEntryFooter } from './EntryFooter'

export function EntryModal({ ctx }: { ctx: PosCtx }) {
  const {
    cashMode, closeEntryModal, entryModal,
  } = ctx
  return (
    <>
      {entryModal ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEntryModal()
          }}
        >
          <div
            className={`pd-ol-dialog ${
              (
                [
                  'recipe', 'addOn', 'floorDesign',
                  'stockAdjustment', 'productionEntry', 'openingStock',
                  'productRequest', 'productReceipt', 'productTransfer',
                  'transferList', 'receiptList', 'supplierList',
                  'purchaseEntry', 'purchaseList', 'purchaseReturn', 'purchaseReturnList',
                  'movementReport', 'osBalanceList',
                  'billReprint', 'counterCloseReportsRP', 'pendingOrderList',
                  'itemwiseViewer', 'delBoyCommission',
                  'incomeExpenseEntry', 'discountEntry', 'discountList',
                  'productListEdit', 'eventLogs',
                  'controlPanel', 'partyOrderList', 'printerSetup',
                ] as EntryKey[]
              ).includes(entryModal)
                ? 'pd-ol-wide'
                : entryModal === 'damageEntry'
                  ? 'pd-ol-damage'
                : entryModal === 'table' || entryModal === 'combo' || entryModal === 'messMaster' || entryModal === 'bookingList'
                  ? 'pd-ol-table'
                  : (['area', 'onlineSource', 'booking', 'dayCloseReport', 'activateAccessCard', 'vatCorrectionUtility', 'areaWiseReportRP', 'groupWiseRP', 'itemWiseRP', 'areawiseA4', 'itemVoidReportRP', 'itemVoidA4', 'salesmanWise', 'cancelBillSummary', 'salesBillWiseRP', 'dayWiseRP', 'taxReport', 'vatSale', 'vatPurchase', 'counterCloseDetailsA4', 'incomeExpense', 'productionReport', 'counterWiseA4', 'counterWiseTimewise', 'itemwiseSummary', 'itemwiseDetails', 'waiterwise', 'customerAnalysisDetailed', 'customerAnalysisSummary', 'graphReport'] as EntryKey[]).includes(entryModal)
                  ? 'pd-ol-narrow'
                  : ''
            }${entryModal === 'booking' || entryModal === 'bookingList' ? ' pd-ol-booking' : ''}${entryModal === 'supplierList' || entryModal === 'purchaseList' || entryModal === 'purchaseReturnList' || entryModal === 'discountList' || entryModal === 'changeSettlement' || entryModal === 'productListEdit' || entryModal === 'printerSetup' || entryModal === 'partyOrderList' || entryModal === 'billReprint' || entryModal === 'counterCloseReportsRP' || entryModal === 'pendingOrderList' || entryModal === 'itemwiseViewer' || entryModal === 'productMovementFast' || entryModal === 'productMovementSlow' ? ' lst-dialog' : ''}${(['osBalanceList', 'advanceViewer', 'creditReceiptList', 'messBillViewer'] as EntryKey[]).includes(entryModal) ? ' lst-dialog lst-sm' : ''}${(['advanceViewer', 'creditReceiptList', 'messBillViewer'] as EntryKey[]).includes(entryModal) ? ' lst-xs' : ''}${entryModal === 'printerSetup' || entryModal === 'userList' || entryModal === 'langSetup' ? ' lst-dialog lst-sm lst-xs' : ''}${entryModal === 'controlPanel' ? ' cpl-dialog' : ''}${entryModal === 'cashInOut' ? (cashMode === 'pick' ? ' pd-ol-narrow' : ' cash-dialog') : ''}${entryModal === 'partyOrderList' ? ' lst-sm' : ''}`}
            role="dialog"
            aria-modal="true"
          >
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  {(() => {
                    const EntryIcon = ENTRY_META[entryModal].icon
                    return <EntryIcon size={15} strokeWidth={2} />
                  })()}
                </div>
                <div>
                  <p className="pd-mod-kicker">{navSectionOf(ENTRY_META[entryModal].label)}</p>
                  <h2 className="pd-mod-item-name">{ENTRY_META[entryModal].label}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeEntryModal} aria-label="Close">
                <X size={13} />
              </button>
            </div>

            <div className="pd-ol-body">
              <AreaBody ctx={ctx} />

              <TableBody ctx={ctx} />

              <MainGroupBody ctx={ctx} />

              <GroupBody ctx={ctx} />

              <SubGroupBody ctx={ctx} />

              <KitchenMessageBody ctx={ctx} />

              <ComboBody ctx={ctx} />

              <RecipeBody ctx={ctx} />

              <BarcodeBody ctx={ctx} />

              <NotesBody ctx={ctx} />

              <OnlineSourceBody ctx={ctx} />

              <PaymentModeBody ctx={ctx} />

              <MessMasterBody ctx={ctx} />

              <AddOnBody ctx={ctx} />

              <BookingBody ctx={ctx} />

              <BookingListBody ctx={ctx} />

              <FloorDesignBody ctx={ctx} />

              <StockAdjustmentBody ctx={ctx} />

              <StockAdjustListBody ctx={ctx} />

              <ComboEditBody ctx={ctx} />

              <ProductionListBody ctx={ctx} />

              <StockReportBody ctx={ctx} />

              <MovementReportBody ctx={ctx} />

              <TransferListBody ctx={ctx} />

              <SupplierListBody ctx={ctx} />

              <PurchaseListBody ctx={ctx} />

              <DamageEntryBody ctx={ctx} />

              <PaymentListBody ctx={ctx} />

              <OsBalanceListBody ctx={ctx} />

              <CreditReceiptListBody ctx={ctx} />

              <AdvanceViewerBody ctx={ctx} />

              <MessBillViewerBody ctx={ctx} />

              <BillReprintBody ctx={ctx} />

              <AreaWiseReportRPBody ctx={ctx} />

              <ItemVoidReportRPBody ctx={ctx} />

              <CancelBillDetailsBody ctx={ctx} />

              <CancelBillSummaryBody ctx={ctx} />

              <VatSaleBody ctx={ctx} />

              <VatPurchaseBody ctx={ctx} />

              <CounterCloseReportsRPBody ctx={ctx} />

              <PendingOrderListBody ctx={ctx} />

              <CounterWiseA4Body ctx={ctx} />

              <ItemwiseSummaryBody ctx={ctx} />

              <AreawiseA4Body ctx={ctx} />

              <WaiterwiseBody ctx={ctx} />

              <CustomerAnalysisDetailedBody ctx={ctx} />

              <GraphReportBody ctx={ctx} />

              <ItemwiseViewerBody ctx={ctx} />

              <DelBoyCommissionBody ctx={ctx} />

              <ProductMovementFastBody ctx={ctx} />

              <DayCloseReportBody ctx={ctx} />

              <IncomeExpenseEntryBody ctx={ctx} />

              <DiscountListBody ctx={ctx} />

              <ChangeSettlementBody ctx={ctx} />

              <VatActivationBody ctx={ctx} />

              <ProductListEditBody ctx={ctx} />

              <ChangeDiscountPercentBody ctx={ctx} />

              <EventLogsBody ctx={ctx} />

              <PrinterSetupBody ctx={ctx} />

              <UserListBody ctx={ctx} />

              <ActivateAccessCardBody ctx={ctx} />

              <PrivilegeSetupBody ctx={ctx} />

              <ControlPanelBody ctx={ctx} />

              <PasswordChangeBody ctx={ctx} />

              <LangSetupBody ctx={ctx} />

              <PartyOrderListBody ctx={ctx} />

              <MultiSupplierSetupBody ctx={ctx} />

              <VatCorrectionUtilityBody ctx={ctx} />

              <CashInOutBody ctx={ctx} />

              <CashInOutBody2 ctx={ctx} />
            </div>

            {(() => {
              const foot = renderEntryFooter(ctx)
              return foot ? <div className="pd-mod-foot">{foot}</div> : null
            })()}
          </div>
        </div>
      ) : null}
    </>
  )
}
