import { Package, X, Trash2, Plus, CupSoda } from 'lucide-react'
import { translateToArabic } from '../../../../utils/translate'
import { ArabicInput } from '../../../../components/common/ArabicInput'
import { SearchSelect } from '../../../../components/common/SearchSelect'
import { decimal, percent, digits } from '../../../../utils/validate'
import { type VariantGroup } from '../../main/posTypes'
import { type PosCtx } from '../../main/usePosMain'

export function ProductMasterModal({ ctx }: { ctx: PosCtx }) {
  const {
    addingProductGroup, arabicAutoLast, arabicAutoTimers, closeProductModal, generateNewProductCode,
    groupOptions, groupOptionsLoading, loadGroupOptions, newProductGroupArabic, newProductGroupName,
    notifyTranslateDown, onProductFormKey, productDescKey, productForm, productGroupSaving,
    productOpen, productSaveRef, productSaving, productTab, saveProductForm, saveProductGroup,
    setAddingProductGroup, setNewProductGroupArabic, setNewProductGroupName, setProductForm,
    setProductTab, setSubgroupOptions, setVariantDraft, subgroupOptions, toast, variantDraft,
    withVat,
  } = ctx
  return (
    <>
      {productOpen ? (
        <div
          className="pd-mod-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeProductModal()
          }}
        >
          <div className="pd-ol-dialog pd-product-dialog" role="dialog" aria-modal="true">
            <div className="pd-mod-header">
              <div className="pd-mod-header-left">
                <div className="pd-mod-header-icon">
                  <Package size={15} color="#fff" />
                </div>
                <div>
                  <p className="pd-mod-kicker">Product Master</p>
                  <h2 className="pd-mod-item-name">{productForm.id > 0 ? 'Edit Item' : 'New Item'}</h2>
                </div>
              </div>
              <button type="button" className="pd-mod-x" onClick={closeProductModal} aria-label="Close">
                <X size={13} />
              </button>
            </div>

            <div className="pd-product-body" onKeyDown={onProductFormKey}>
              {/* Fixed section — identity, group and selling price. Always visible. */}
              <section className="pd-pf-main">
                <div className="pd-form-grid-2">
                  <div className="pd-form-row">
                    <label>Item Code</label>
                    <div className="pd-form-code">
                      <input
                        value={productForm.code}
                        onChange={(e) => setProductForm((f) => ({ ...f, code: e.target.value }))}
                        placeholder="Auto or enter manually"
                        autoFocus
                      />
                      <button type="button" className="pd-form-code-btn" tabIndex={-1} data-nav onClick={generateNewProductCode}>
                        New Code
                      </button>
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>Description <span className="pd-pf-req">*</span></label>
                    <input
                      value={productForm.description}
                      onChange={(e) => {
                        const value = e.target.value
                        setProductForm((f) => ({ ...f, description: value }))
                        const key = 'productDescriptionArabic'
                        if (arabicAutoTimers.current[key]) clearTimeout(arabicAutoTimers.current[key])
                        const trimmed = value.trim()
                        if (!trimmed) return
                        arabicAutoTimers.current[key] = setTimeout(() => {
                          translateToArabic(trimmed)
                            .then((translated) => {
                              if (!translated) return
                              setProductForm((prev) => {
                                if (prev.arabicDescription && prev.arabicDescription !== arabicAutoLast.current[key]) return prev
                                arabicAutoLast.current[key] = translated
                                return { ...prev, arabicDescription: translated }
                              })
                            })
                            .catch(notifyTranslateDown)
                        }, 400)
                      }}
                      placeholder="Item name"
                    />
                  </div>
                </div>

                <div className="pd-form-row">
                  <label>Arabic Description</label>
                  <ArabicInput
                    value={productForm.arabicDescription}
                    onValueChange={(v) => setProductForm((f) => ({ ...f, arabicDescription: v }))}
                    source={productForm.description}
                    onTranslateError={notifyTranslateDown}
                  />
                </div>

                <div className="pd-form-grid-2">
                  <div className="pd-form-row">
                    <label>Group <span className="pd-pf-req">*</span></label>
                    <div className="pd-form-code">
                      <SearchSelect
                        id="pd-product-group"
                        value={productForm.groupId || null}
                        valueLabel={productForm.groupName}
                        options={groupOptions}
                        loading={groupOptionsLoading === 'group'}
                        onOpen={() => void loadGroupOptions('group')}
                        onChange={(o) => {
                          if (o.id === productForm.groupId) return
                          setSubgroupOptions([])
                          setProductForm((f) => ({
                            ...f,
                            groupId: Number(o.id),
                            groupName: o.name,
                            subgroupId: 0,
                            subgroupName: '',
                          }))
                        }}
                        placeholder="Select group"
                        searchPlaceholder="Search group"
                      />
                      <button
                        type="button"
                        className={`pd-form-code-btn${addingProductGroup ? ' is-on' : ''}`}
                        tabIndex={-1}
                        disabled={productGroupSaving}
                        onClick={() => setAddingProductGroup((open) => !open)}
                      >
                        {addingProductGroup ? 'Cancel' : 'New'}
                      </button>
                    </div>
                  </div>
                  <div className="pd-form-row">
                    <label>SubGroup</label>
                    <SearchSelect
                      id="pd-product-subgroup"
                      value={productForm.subgroupId || null}
                      valueLabel={productForm.subgroupName}
                      options={subgroupOptions}
                      loading={groupOptionsLoading === 'subgroup'}
                      onOpen={() => void loadGroupOptions('subgroup')}
                      onChange={(o) =>
                        setProductForm((f) => ({ ...f, subgroupId: Number(o.id), subgroupName: o.name }))
                      }
                      disabled={!productForm.groupId}
                      disabledHint="Pick a group first"
                      placeholder="Select subgroup"
                      searchPlaceholder="Search subgroup"
                      emptyText="No subgroups in this group"
                    />
                  </div>
                </div>
                {addingProductGroup ? (
                  <div className="pd-form-add-group">
                    <input
                      value={newProductGroupName}
                      placeholder="New group name"
                      autoFocus
                      onChange={(e) => {
                        const value = e.target.value
                        setNewProductGroupName(value)
                        // Auto-fill Arabic unless the user typed their own.
                        const key = 'productGroupArabic'
                        if (arabicAutoTimers.current[key]) clearTimeout(arabicAutoTimers.current[key])
                        const trimmed = value.trim()
                        if (!trimmed) return
                        arabicAutoTimers.current[key] = setTimeout(() => {
                          translateToArabic(trimmed)
                            .then((translated) => {
                              if (!translated) return
                              setNewProductGroupArabic((prev) => {
                                if (prev && prev !== arabicAutoLast.current[key]) return prev
                                arabicAutoLast.current[key] = translated
                                return translated
                              })
                            })
                            .catch(notifyTranslateDown)
                        }, 400)
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveProductGroup() } }}
                    />
                    <input
                      value={newProductGroupArabic}
                      dir="rtl"
                      placeholder="Arabic"
                      onChange={(e) => setNewProductGroupArabic(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pd-form-code-btn"
                      disabled={productGroupSaving}
                      onClick={() => void saveProductGroup()}
                    >
                      {productGroupSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                ) : null}

                {/* Variants — options asked when the item is tapped (e.g. Size: Small, Medium, Large) */}
                <div className="pvr">
                  <label className="pvr-label">Variants</label>
                  {variantDraft.map((g, gi) => {
                    const setGroup = (next: VariantGroup) =>
                      setVariantDraft((d) => d.map((x, i) => (i === gi ? next : x)))
                    const addOption = (input: HTMLInputElement | null) => {
                      const v = input?.value.trim() ?? ''
                      if (!v || !input) return
                      if (g.options.some((o) => o.toLowerCase() === v.toLowerCase())) {
                        toast(`"${v}" is already in the list`)
                        return
                      }
                      setGroup({ ...g, options: [...g.options, v] })
                      input.value = ''
                      input.focus()
                    }
                    return (
                      <div key={gi} className="pvr-card">
                        <div className="pvr-head">
                          <input
                            className="pvr-type"
                            value={g.type}
                            placeholder="Variant type (e.g. Size)"
                            aria-label="Variant type"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.stopPropagation()
                            }}
                            onChange={(e) => setGroup({ ...g, type: e.target.value })}
                          />
                          <button
                            type="button"
                            className="pvr-del"
                            tabIndex={-1}
                            onClick={() => setVariantDraft((d) => d.filter((_, i) => i !== gi))}
                            aria-label="Remove this variant type"
                            title="Remove this variant type"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="pvr-opts">
                          {g.options.map((o) => (
                            <span key={o} className="pvr-chip">
                              {o}
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setGroup({ ...g, options: g.options.filter((x) => x !== o) })}
                                aria-label={`Remove ${o}`}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                          <span className="pvr-add">
                            <input
                              placeholder="Add option"
                              aria-label="Add option"
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                e.stopPropagation()
                                addOption(e.currentTarget)
                              }}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={(e) => addOption(e.currentTarget.previousElementSibling as HTMLInputElement | null)}
                              aria-label="Add option"
                            >
                              <Plus size={13} strokeWidth={2.6} />
                            </button>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  <div className="pvr-actions">
                    <button
                      type="button"
                      className="lst-btn"
                      onClick={() => setVariantDraft((d) => [...d, { type: '', options: [] }])}
                    >
                      <Plus size={14} /> Add variant type
                    </button>
                    {variantDraft.some((g) => g.type.trim().toLowerCase() === 'size') ? null : (
                      <button
                        type="button"
                        className="lst-btn"
                        onClick={() =>
                          setVariantDraft((d) => [...d, { type: 'Size', options: ['Small', 'Medium', 'Large'] }])
                        }
                      >
                        <CupSoda size={14} /> Size: Small / Medium / Large
                      </button>
                    )}
                  </div>
                </div>

                <div className="pd-form-grid-3">
                  <div className="pd-form-row">
                    <label>Unit Price <span className="pd-pf-req">*</span></label>
                    <input
                      inputMode="decimal"
                      value={productForm.unitPrice}
                      placeholder="0.00"
                      onChange={(e) =>
                        setProductForm((f) => ({ ...f, unitPrice: decimal(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="pd-form-row">
                    <label>VAT (OUT) %</label>
                    <input
                      inputMode="decimal"
                      className="pd-pf-pct"
                      value={productForm.vatOut}
                      onChange={(e) =>
                        setProductForm((f) => ({ ...f, vatOut: percent(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="pd-form-row">
                    <label>Price with VAT</label>
                    <span className="pd-form-computed">AED {withVat(productForm.unitPrice, productForm.vatOut)}</span>
                  </div>
                </div>
              </section>

              {/* Tabbed section */}
              <div className="pd-pf-side">
              <div className="pd-pf-tabs" role="tablist">
                {['Cost & Stock', 'Price Levels'].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={productTab === i}
                    tabIndex={-1}
                    className={`pd-pf-tab${productTab === i ? ' is-on' : ''}`}
                    onClick={() => {
                      setProductTab(i)
                      // Land on the tab's first field so typing can start right away.
                      requestAnimationFrame(() =>
                        document.querySelector<HTMLInputElement>('.pd-pf-panel input')?.focus(),
                      )
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <section className="pd-pf-panel" role="tabpanel">
                {productTab === 0 ? (
                  <>
                    <div className="pd-form-grid-3">
                      <div className="pd-form-row">
                        <label>Unit Cost</label>
                        <input
                          inputMode="decimal"
                          value={productForm.unitCost}
                          placeholder="0.00"
                          onChange={(e) =>
                            setProductForm((f) => ({ ...f, unitCost: decimal(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="pd-form-row">
                        <label>VAT (IN) %</label>
                        <input
                          inputMode="decimal"
                          className="pd-pf-pct"
                          value={productForm.vatIn}
                          onChange={(e) =>
                            setProductForm((f) => ({ ...f, vatIn: percent(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="pd-form-row">
                        <label>Cost with VAT</label>
                        <span className="pd-form-computed">AED {withVat(productForm.unitCost, productForm.vatIn)}</span>
                      </div>
                    </div>

                    <div className="pd-form-grid-3">
                      <div className="pd-form-row">
                        <label>Pack Qty</label>
                        <input
                          inputMode="numeric"
                          value={productForm.packQty}
                          onChange={(e) =>
                            setProductForm((f) => ({ ...f, packQty: digits(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="pd-form-row">
                        <label>Unit</label>
                        <select
                          value={productForm.unit}
                          onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))}
                        >
                          <option value="PCS">PCS</option>
                          <option value="KG">KG</option>
                          <option value="LTR">LTR</option>
                          <option value="BOX">BOX</option>
                          {['PCS', 'KG', 'LTR', 'BOX'].includes(productForm.unit) ? null : (
                            <option value={productForm.unit}>{productForm.unit}</option>
                          )}
                        </select>
                      </div>
                      <div className="pd-form-row">
                        <label>Qty On Hand</label>
                        <input
                          inputMode="decimal"
                          value={productForm.qtyOnHand}
                          placeholder="0"
                          onChange={(e) =>
                            setProductForm((f) => ({ ...f, qtyOnHand: decimal(e.target.value) }))
                          }
                        />
                      </div>
                    </div>

                    <div className="pd-form-grid-3">
                      <div className="pd-form-row">
                        <label>Product Type</label>
                        <select
                          value={productForm.productType}
                          onChange={(e) => setProductForm((f) => ({ ...f, productType: e.target.value }))}
                        >
                          <option value="NORMAL">NORMAL</option>
                          <option value="COMBO">COMBO</option>
                          <option value="RECIPE ITEM">RECIPE ITEM</option>
                          <option value="RAW MATERIAL">RAW MATERIAL</option>
                          <option value="VARIATION">VARIATION</option>
                          {['NORMAL', 'COMBO', 'RECIPE ITEM', 'RAW MATERIAL', 'VARIATION'].includes(productForm.productType) ? null : (
                            <option value={productForm.productType}>{productForm.productType}</option>
                          )}
                        </select>
                      </div>
                      <div className="pd-form-row">
                        <label>Kitchen Location</label>
                        <input
                          value={productForm.kitchenLocation}
                          onChange={(e) => setProductForm((f) => ({ ...f, kitchenLocation: e.target.value }))}
                        />
                      </div>
                      <div className="pd-form-row">
                        <label>KOT Priority</label>
                        <select
                          value={productForm.kotPriority}
                          onChange={(e) => setProductForm((f) => ({ ...f, kotPriority: e.target.value }))}
                        >
                          <option value="NORMAL">NORMAL</option>
                          <option value="HIGH">HIGH</option>
                          <option value="LOW">LOW</option>
                        </select>
                      </div>
                    </div>

                    <div className="pd-form-row">
                      <label>Item Description</label>
                      <textarea
                        rows={2}
                        value={productForm.itemDescription}
                        onFocus={() => { productDescKey.current = '' }}
                        onChange={(e) => setProductForm((f) => ({ ...f, itemDescription: e.target.value }))}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="pd-pf-hint">Alternate selling prices. Enter each amount including VAT.</p>
                    <div className="pd-pf-levels">
                      {productForm.priceLevels.map((value, i) => (
                        <div className="pd-form-row" key={i}>
                          <label>Price Level {i + 1} With Tax</label>
                          <div className="pd-pf-money">
                            <span>AED</span>
                            <input
                              inputMode="decimal"
                              value={value}
                              placeholder="0.00"
                              onChange={(e) => {
                                const v = decimal(e.target.value)
                                setProductForm((f) => ({
                                  ...f,
                                  priceLevels: f.priceLevels.map((p, idx) => (idx === i ? v : p)),
                                }))
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
              </div>
            </div>

            <div className="pd-product-modal-foot">
              <button
                type="button"
                ref={productSaveRef}
                className="pd-mod-foot-btn is-ok"
                onKeyDown={(e) => {
                  // End of the flow: Tab stays on Save instead of wandering out of the modal.
                  if (e.key === 'Tab' && !e.shiftKey) e.preventDefault()
                }}
                disabled={productSaving}
                onClick={() => void saveProductForm()}
              >
                {productSaving ? 'Saving…' : productForm.id > 0 ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
