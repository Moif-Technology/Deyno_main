import SalesViewerDialog from '../SalesViewerDialog'
import InventoryReportDialog from '../InventoryReportDialog'
import MovementReportDialog from '../MovementReportDialog'
import StockEntryListDialog from '../StockEntryListDialog'
import ProductListDialog from '../ProductListDialog'
import RecipeListDialog from '../RecipeListDialog'
import DiscountEntryDialog from '../DiscountEntryDialog'
import AdvancePaymentDialog from '../AdvancePaymentDialog'
import PurchaseEntryDialog from '../PurchaseEntryDialog'
import TransferDocDialog from '../TransferDocDialog'
import OpeningStockDialog from '../OpeningStockDialog'
import ProductionEntryDialog from '../ProductionEntryDialog'
import RecipeEntryDialog from '../RecipeEntryDialog'
import StockEntryDialog from '../StockEntryDialog'
import CounterCloseAllDialog from '../CounterCloseAllDialog'
import KotJoinDialog from '../KotJoinDialog'
import AreaMasterDialog from '../AreaMasterDialog'
import TableMasterDialog from '../TableMasterDialog'
import { GroupEditDialog, SubGroupEditDialog } from '../GroupEditDialogs'
import FloorDesignDialog from '../FloorDesignDialog'
import AreaChangeDialog from '../AreaChangeDialog'
import { money } from '../main/posHelpers'
import { type PosCtx } from '../main/usePosMain'

export function SideMenuDialogs({ ctx }: { ctx: PosCtx }) {
  const {
    advanceOpen, allSubGroups, areaChangeOpen, areaMasterOpen, areas, counterCloseMode,
    counterCloseOpen, discountEntryOpen, floorDesignOpen, groupEditOpen, groups, kotJoinOpen,
    movementReportOpen, onAreaChanged, onKotJoined, onKotSplit, openEditProductModal,
    openingStockOpen, productListOpen, productionEntryOpen, purchaseMode, recipeEntryOpen,
    recipeListOpen, recipeProductId, reloadFloorMasters, reloadGroups, salesViewerOpen,
    setAdvanceOpen, setAreaChangeOpen, setAreaMasterOpen, setCounterCloseOpen, setDiscountEntryOpen,
    setFloorDesignOpen, setGroupEditOpen, setKotJoinOpen, setMovementReportOpen, setOpeningStockOpen,
    setProductListOpen, setProductionEntryOpen, setPurchaseMode, setRecipeEntryOpen,
    setRecipeListOpen, setRecipeProductId, setSalesViewerOpen, setStockEntryId, setStockEntryOpen,
    setStockListOpen, setStockReportOpen, setSubGroupEditOpen, setTableMasterOpen, setTransferDoc,
    stockDocType, stockEntryId, stockEntryOpen, stockListOpen, stockReportOpen, subGroupEditOpen,
    suppliers, tableMasterOpen, tables, toast, transferDoc, waiter,
  } = ctx
  return (
    <>
      {salesViewerOpen ? (
        <SalesViewerDialog
          areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          onClose={() => setSalesViewerOpen(false)}
        />
      ) : null}

      {stockReportOpen ? (
        <InventoryReportDialog onClose={() => setStockReportOpen(false)} />
      ) : null}

      {movementReportOpen ? (
        <MovementReportDialog onClose={() => setMovementReportOpen(false)} />
      ) : null}

      {stockListOpen ? (
        <StockEntryListDialog
          docType={stockDocType}
          onClose={() => setStockListOpen(false)}
          onNew={() => {
            setStockEntryId(null)
            setStockListOpen(false)
            setStockEntryOpen(true)
          }}
          onSelect={(id) => {
            setStockEntryId(id)
            setStockListOpen(false)
            setStockEntryOpen(true)
          }}
        />
      ) : null}

      {productListOpen ? (
        <ProductListDialog
          onClose={() => setProductListOpen(false)}
          onEdit={(id) => void openEditProductModal(id)}
        />
      ) : null}

      {recipeListOpen ? (
        <RecipeListDialog
          onClose={() => setRecipeListOpen(false)}
          onNew={() => {
            setRecipeProductId(null)
            setRecipeListOpen(false)
            setRecipeEntryOpen(true)
          }}
          onSelect={(id) => {
            setRecipeProductId(id)
            setRecipeListOpen(false)
            setRecipeEntryOpen(true)
          }}
        />
      ) : null}

      {discountEntryOpen ? (
        <DiscountEntryDialog
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          subGroups={allSubGroups}
          onClose={() => setDiscountEntryOpen(false)}
          onSaved={(count) => toast(`Discount saved for ${count} item${count === 1 ? '' : 's'}`, 'success')}
        />
      ) : null}

      {advanceOpen ? (
        <AdvancePaymentDialog
          onClose={() => setAdvanceOpen(false)}
          onSaved={(p) => toast(`Advance AED ${money(p.amount)} (${p.mode}) saved for ${p.customerName}`, 'success')}
        />
      ) : null}

      {purchaseMode ? (
        <PurchaseEntryDialog
          key={purchaseMode}
          mode={purchaseMode}
          suppliers={suppliers.map((sp) => sp.name)}
          onClose={() => setPurchaseMode(null)}
          notify={(msg, kind) => toast(msg, kind)}
        />
      ) : null}

      {transferDoc ? (
        <TransferDocDialog
          key={transferDoc}
          kind={transferDoc}
          areas={areas.map((a) => a.name)}
          homeArea="AUH"
          onClose={() => setTransferDoc(null)}
          onSaved={() =>
            toast(
              transferDoc === 'request' ? 'Product Request saved' : transferDoc === 'receipt' ? 'Product Receipt saved' : 'Product Transfer saved',
              'success',
            )
          }
          onPrint={() => toast('Sent to printer', 'success')}
        />
      ) : null}

      {openingStockOpen ? (
        <OpeningStockDialog
          onClose={() => setOpeningStockOpen(false)}
          onSaved={() => toast('Opening Stock Entry saved', 'success')}
        />
      ) : null}

      {productionEntryOpen ? (
        <ProductionEntryDialog
          onClose={() => setProductionEntryOpen(false)}
          onSaved={() => toast('Production Entry saved', 'success')}
        />
      ) : null}

      {recipeEntryOpen ? (
        <RecipeEntryDialog
          key={recipeProductId ?? 'new'}
          finishedProductId={recipeProductId}
          onClose={() => {
            setRecipeEntryOpen(false)
            setRecipeProductId(null)
          }}
        />
      ) : null}

      {stockEntryOpen ? (
        <StockEntryDialog
          key={`${stockDocType}-${stockEntryId ?? 'new'}`}
          docType={stockDocType}
          entryId={stockEntryId}
          onClose={() => {
            setStockEntryOpen(false)
            setStockEntryId(null)
          }}
          onOpenList={() => {
            setStockEntryOpen(false)
            setStockListOpen(true)
          }}
        />
      ) : null}

      {counterCloseOpen ? (
        <CounterCloseAllDialog mode={counterCloseMode} onClose={() => setCounterCloseOpen(false)} notify={(msg, kind) => toast(msg, kind)} />
      ) : null}

      {kotJoinOpen ? (
        <KotJoinDialog
          areas={areas}
          tables={tables}
          waiter={waiter}
          onClose={() => setKotJoinOpen(false)}
          onJoined={onKotJoined}
          onSplit={onKotSplit}
        />
      ) : null}

      {areaMasterOpen ? (
        <AreaMasterDialog
          onClose={() => setAreaMasterOpen(false)}
          onSaved={() => {
            void reloadFloorMasters()
          }}
        />
      ) : null}

      {tableMasterOpen ? (
        <TableMasterDialog
          areas={areas}
          onClose={() => setTableMasterOpen(false)}
          onSaved={() => {
            void reloadFloorMasters()
          }}
        />
      ) : null}

      {groupEditOpen ? (
        <GroupEditDialog onClose={() => setGroupEditOpen(false)} onSaved={() => void reloadGroups()} />
      ) : null}

      {subGroupEditOpen ? (
        <SubGroupEditDialog onClose={() => setSubGroupEditOpen(false)} onSaved={() => void reloadGroups()} />
      ) : null}

      {floorDesignOpen ? (
        <FloorDesignDialog
          onClose={() => setFloorDesignOpen(false)}
          onSaved={() => toast('Floor design saved.', 'success')}
        />
      ) : null}

      {areaChangeOpen ? (
        <AreaChangeDialog
          areas={areas}
          tables={tables}
          onClose={() => setAreaChangeOpen(false)}
          onTransferred={onAreaChanged}
        />
      ) : null}
    </>
  )
}
