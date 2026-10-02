import './main/loadOrder'
import { Toast } from '../../components/common/Toast'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import SettlementScreen from './SettlementScreen'
import { money } from './main/posHelpers'
import { usePosMain } from './main/usePosMain'
import { HomeHeader } from './home/HomeHeader'
import { SideMenu } from './home/SideMenu'
import { OrderPanel } from './home/OrderPanel'
import { CatalogueSearch } from './home/CatalogueSearch'
import { CategoryColumn } from './home/CategoryColumn'
import { ProductArea } from './home/ProductArea'
import { ActionPad } from './home/ActionPad'
import { StatusBar } from './home/StatusBar'
import { RowMenu } from './order/RowMenu'
import { QtyChangeDialog } from './order/QtyChangeDialog'
import { PriceChangeDialog } from './order/PriceChangeDialog'
import { LineDiscountDialog } from './order/LineDiscountDialog'
import { MoveItemDialog } from './order/MoveItemDialog'
import { CommentsDialog } from './order/CommentsDialog'
import { TableFloorDialog } from './order/TableFloorDialog'
import { CoversPrompt } from './order/CoversPrompt'
import { AreaPickerDialog } from './order/AreaPickerDialog'
import { CustomerSearchDialog } from './order/CustomerSearchDialog'
import { ReceiptDialog } from './order/ReceiptDialog'
import { ProductMasterModal } from './side-menu/creation/ProductMasterModal'
import { EntryModal } from './side-menu/EntryModal'
import { CustomerEntryDialog } from './order/CustomerEntryDialog'
import { JoinConfirmDialog } from './order/JoinConfirmDialog'
import { OrderListDialog } from './order/OrderListDialog'
import { AlertPopup } from './order/AlertPopup'
import { KitchenMessageDialog } from './order/KitchenMessageDialog'
import { BillDiscountDialog } from './order/BillDiscountDialog'
import { ItemCancelDialog } from './order/ItemCancelDialog'
import { AdminAuthDialog } from './order/AdminAuthDialog'
import { BillConfirmDialog } from './order/BillConfirmDialog'
import { VariantPicker } from './order/VariantPicker'
import { SideMenuDialogs } from './side-menu/SideMenuDialogs'

export default function PosMainPage() {
  const ctx = usePosMain()
  const {
    closeSettlement, confirmAlert, lastInfo, notesHint, notesKind, onSettlementAlreadySettled,
    onSettlementCompleted, setConfirmAlert, settleBill, settleOpen, settleQuick,
  } = ctx
  return (
    <div className="pos-main">
      <HomeHeader ctx={ctx} />

      <div className="pd-shell">
        <SideMenu ctx={ctx} />

      <div className="pd-main">
        <OrderPanel ctx={ctx} />

        <section className="pd-panel pd-catalogue">
        <CatalogueSearch ctx={ctx} />

        <div className="pd-catalogue-body">
        <CategoryColumn ctx={ctx} />

        <div className="pd-right">
          <ProductArea ctx={ctx} />

          <ActionPad ctx={ctx} />
        </div>
        </div>
        </section>
      </div>
      </div>

      <StatusBar ctx={ctx} />

      {notesHint ? (
        <div className="pd-toast">
          <Toast key={notesHint} message={notesHint} kind={notesKind} duration={1800} />
        </div>
      ) : null}

      <RowMenu ctx={ctx} />


      <QtyChangeDialog ctx={ctx} />

      <PriceChangeDialog ctx={ctx} />

      <LineDiscountDialog ctx={ctx} />

      <MoveItemDialog ctx={ctx} />

      <CommentsDialog ctx={ctx} />

      <TableFloorDialog ctx={ctx} />

      <CoversPrompt ctx={ctx} />

      <AreaPickerDialog ctx={ctx} />

      <CustomerSearchDialog ctx={ctx} />

      <ReceiptDialog ctx={ctx} />



      <ConfirmDialog
        open={confirmAlert != null}
        title={confirmAlert?.title ?? ''}
        message={confirmAlert?.message}
        mode={confirmAlert?.mode}
        tone={confirmAlert?.tone}
        confirmLabel={confirmAlert?.confirmLabel}
        onConfirm={() => {
          confirmAlert?.onYes?.()
          setConfirmAlert(null)
        }}
        onCancel={() => setConfirmAlert(null)}
      />

      <ProductMasterModal ctx={ctx} />

      <EntryModal ctx={ctx} />

      <CustomerEntryDialog ctx={ctx} />

      <JoinConfirmDialog ctx={ctx} />

      <OrderListDialog ctx={ctx} />

      <AlertPopup ctx={ctx} />

      {lastInfo ? (
        <div className="pd-last-info">
          Last {money(lastInfo.net)} · Paid {money(lastInfo.paid)} · Change {money(lastInfo.change)}
          {lastInfo.billNo ? ` · Bill ${lastInfo.billNo}` : ''}
        </div>
      ) : null}

      <KitchenMessageDialog ctx={ctx} />

      <BillDiscountDialog ctx={ctx} />

      <ItemCancelDialog ctx={ctx} />

      <AdminAuthDialog ctx={ctx} />

      <BillConfirmDialog ctx={ctx} />

      {settleOpen && settleBill ? (
        <SettlementScreen
          quick={settleQuick}
          bill={settleBill}
          onClose={closeSettlement}
          onCompleted={onSettlementCompleted}
          onAlreadySettled={onSettlementAlreadySettled}
        />
      ) : null}

      <VariantPicker ctx={ctx} />

      <SideMenuDialogs ctx={ctx} />
    </div>
  )
}
