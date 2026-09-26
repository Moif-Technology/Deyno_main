/**
 * Counter settlement bill — BillPrintStyle = 1.
 * Layout follows MoifHMS GeneralModuleForm.Print_printpage (gvBillPrintStyle = 1, English):
 *   Heading 1 Agency FB bold, headings 2–5 Berlin Sans FB,
 *   body Courier New bold, tax-invoice line Arabic Typesetting 18.
 * Prints straight to the Windows default printer. No printer dialog.
 */
import { apiService } from '../api/apiService'
import { buildReceiptDocumentHtml, escReceipt, printHtmlOnDefaultPrinter } from './receiptPrintTheme'

export type BillPrintLine = {
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
  taxRate: number
  taxAmt: number
  exclusive: number
  itemDisc: number
}

export type BillPrintSplit = { label: string; amount: number }

export type SettlementBillPrint = {
  billNo: string
  billTime?: string | Date | null
  kotNo: string
  supplyType: string
  counterNo: string
  cashier: string
  tableName: string
  waiterName: string
  guests: string
  comments: string
  paymentMode: string
  customerId: number
  customerCode: string
  customerName: string
  customerMobile: string
  customerTelephone: string
  customerCity?: string
  customerAddress?: string
  discount: number
  roundOff: number
  paid: number
  balance: number
  taxPct: number
  taxName: string
  itemWise: boolean
  lines: BillPrintLine[]
  splits?: BillPrintSplit[]
  /** btnDummyBill_Click — pre-settlement slip, no paid/balance. */
  dummy?: boolean
  dummyTitle?: string
}

type Headings = {
  h1: string
  h2: string
  h3: string
  h4: string
  h5: string
  h6: string
  h7: string
  trn: string
  taxName: string
  taxPct: number
  dummyBillName: string
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function qtyFmt(n: number) {
  const r = Math.round(Math.abs(n) * 1000) / 1000
  return String(r)
}

function pctFmt(n: number) {
  const r = Math.round(n * 1000) / 1000
  return String(r)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function whenParts(raw: string | Date | null | undefined) {
  const d = raw instanceof Date ? raw : raw ? new Date(String(raw)) : new Date()
  const when = Number.isNaN(d.getTime()) ? new Date() : d
  const dd = String(when.getDate()).padStart(2, '0')
  const date = `${dd}/${MONTHS[when.getMonth()]}/${when.getFullYear()}`
  let h = when.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  const time = `${h}:${String(when.getMinutes()).padStart(2, '0')}:${String(when.getSeconds()).padStart(2, '0')} ${ampm}`
  return { date, time, both: `${date} ${time}` }
}

function formatWhen(raw: string | Date | null | undefined) {
  return whenParts(raw).both
}

function pair(label: string, amount: string) {
  return `<div class="vb-pair"><span>${escReceipt(label)}</span><span>${escReceipt(amount)}</span></div>`
}

function dash() {
  return `<div class="vb-dash">------------------------------------------------------------</div>`
}

/** Code 128 set B. Width digits alternate bar / space. Stop is the last entry. */
const CODE128 = '212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112'.split(',')

function code128Svg(value: string) {
  const text = String(value ?? '').replace(/[^\x20-\x7e]/g, '')
  if (!text || CODE128.length < 107) return ''
  const codes = [104]
  let sum = 104
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32
    codes.push(code)
    sum += code * (i + 1)
  }
  codes.push(sum % 103)
  codes.push(106)
  let x = 0
  const bars: string[] = []
  for (const code of codes) {
    const pattern = CODE128[code]
    if (!pattern) return ''
    let black = true
    for (const ch of pattern) {
      const w = Number(ch)
      if (black) bars.push(`<rect x="${x}" y="0" width="${w}" height="36"/>`)
      x += w
      black = !black
    }
  }
  return `<div class="vb-barcode"><svg viewBox="0 0 ${x} 36" preserveAspectRatio="xMidYMin meet">${bars.join('')}</svg></div>`
}

function mapLine(row: Record<string, unknown>): BillPrintLine {
  const qty = num(row.qty ?? row.Qty)
  const unitPrice = num(row.unitPrice ?? row.UnitPrice)
  const exclusive = num(row.subTotalC ?? row.SubTotalC ?? unitPrice * qty)
  return {
    name: String(row.shortDescription ?? row.ShortDescription ?? row.itemName ?? ''),
    qty,
    unitPrice,
    lineTotal: num(row.lineTotal ?? row.LineTotal),
    taxRate: num(row.tax1RateC ?? row.Tax1RateC ?? row.taxRate),
    taxAmt: num(row.tax1AmountC ?? row.Tax1AmountC ?? row.tax),
    exclusive,
    itemDisc: num(row.discount ?? row.Discount ?? row.itemDisc ?? row.ItemDisc),
  }
}

async function loadHeadings(): Promise<Headings> {
  try {
    const p = await apiService.fetchParameters()
    return {
      h1: String(p.heading1Counter ?? '').trim(),
      h2: String(p.heading2Counter ?? '').trim(),
      h3: String(p.heading3Counter ?? '').trim(),
      h4: String(p.heading4Counter ?? '').trim(),
      h5: String(p.heading5Counter ?? '').trim(),
      h6: String(p.heading6Counter ?? '').trim(),
      h7: String(p.heading7Counter ?? '').trim(),
      trn: String(p.taxRegistrationNo ?? '').trim(),
      taxName: String(p.Tax1Name ?? 'VAT').trim() || 'VAT',
      taxPct: num(p.Tax1),
      dummyBillName: String(p.dummyBillName ?? p.DummyBillName ?? '').trim(),
    }
  } catch {
    return { h1: '', h2: '', h3: '', h4: '', h5: '', h6: '', h7: '', trn: '', taxName: 'VAT', taxPct: 0, dummyBillName: '' }
  }
}

function buildStyle1Html(bill: SettlementBillPrint, head: Headings) {
  const taxName = bill.taxName || head.taxName || 'VAT'
  const lineRate = bill.lines.find((l) => l.taxRate > 0)?.taxRate ?? 0
  const taxPct = bill.taxPct > 0 ? bill.taxPct : head.taxPct > 0 ? head.taxPct : lineRate
  const itemDisc = round2(bill.lines.reduce((n, l) => n + l.itemDisc, 0))
  const isItemWise = bill.itemWise || (bill.discount === 0 && itemDisc > 0)
  const printDiscount = isItemWise ? itemDisc : bill.discount

  let gross = 0
  let lineTotalSum = 0
  let taxableEx = 0
  let nonTaxable = 0
  let lineTax = 0
  let totalQty = 0

  const itemHtml = bill.lines
    .map((line) => {
      const qty = line.qty
      // Bill discount or round-off: show unit price and exclusive line total (UnitPrice×Qty − item discount).
      const showExclusive = bill.discount > 0 || bill.roundOff > 0
      const unit = showExclusive ? line.unitPrice : qty !== 0 ? line.lineTotal / qty : 0
      const shownTotal = showExclusive ? line.exclusive : line.lineTotal
      const excl = line.unitPrice * qty
      gross += excl
      lineTotalSum += line.lineTotal
      if (line.taxRate <= 0) nonTaxable += line.exclusive
      else {
        taxableEx += line.exclusive
        lineTax += line.taxAmt
      }
      totalQty += Math.abs(qty)
      const name = line.name.length > 15 ? line.name.slice(0, 15) : line.name
      const vat =
        bill.discount <= 0 && line.taxAmt !== 0
          ? `<div class="vb-vat">VAT@${escReceipt(pctFmt(line.taxRate))}%  (${escReceipt(money(line.taxAmt))})</div>`
          : ''
      return `<div class="vb-cols vb-item"><span>${escReceipt(name)}</span><span class="r">${escReceipt(qtyFmt(qty))}</span><span class="r">${escReceipt(money(unit))}</span><span class="r">${escReceipt(money(shownTotal))}</span></div>${vat}`
    })
    .join('')

  gross = round2(gross)
  lineTotalSum = round2(lineTotalSum)
  taxableEx = round2(taxableEx)
  nonTaxable = round2(Math.max(0, nonTaxable))
  lineTax = round2(lineTax)
  totalQty = round2(totalQty)

  // Mainfrm.CalcTotal: bill discount reduces taxable subtotal, then VAT is recalculated.
  // When nothing is taxable, the discount comes off the whole subtotal.
  // Item discount is already inside each line's exclusive amount and line tax.
  let discountTaxable = taxableEx
  let discountTax = lineTax
  let netBill = round2(taxableEx + lineTax + nonTaxable + bill.roundOff)
  if (!isItemWise && bill.discount !== 0) {
    if (taxableEx > 0) {
      const applied = Math.min(bill.discount, taxableEx)
      discountTaxable = round2(taxableEx - applied)
      discountTax = round2(discountTaxable * (taxPct / 100))
      netBill = round2(discountTaxable + discountTax + nonTaxable + bill.roundOff)
    } else {
      discountTaxable = 0
      discountTax = 0
      netBill = round2(taxableEx + nonTaxable - bill.discount + bill.roundOff)
    }
  }

  const hasTax = lineTax !== 0 || bill.lines.some((l) => l.taxAmt !== 0)
  const supply = bill.supplyType.trim().toUpperCase()
  const orderTail = supply && supply !== 'PARCEL' ? `           ${supply}` : ''

  const headings = [
    head.h1 ? `<div class="vb-h1 vb-center">${escReceipt(head.h1)}</div>` : '',
    head.h2 ? `<div class="vb-h2 vb-center">${escReceipt(head.h2)}</div>` : '',
    head.h3 ? `<div class="vb-h2 vb-center">${escReceipt(head.h3)}</div>` : '',
    head.h4 ? `<div class="vb-h2 vb-center">${escReceipt(head.h4)}</div>` : '',
    head.h5 ? `<div class="vb-h2 vb-center">${escReceipt(head.h5)}</div>` : '',
  ].join('')

  const dummyTitle = (bill.dummyTitle || head.dummyBillName || 'Dummy Bill').trim() || 'Dummy Bill'
  const when = whenParts(bill.billTime)
  const trn = bill.dummy
    ? `${hasTax ? `<div class="vb-trn vb-sm vb-center">TRN No: ${escReceipt(head.trn)}</div>${dash()}` : ''}<div class="vb-dummy-title">${escReceipt(dummyTitle)}</div>`
    : hasTax
      ? `<div class="vb-trn vb-sm vb-center">TRN No: ${escReceipt(head.trn)}</div>${dash()}<div class="vb-taxinv"><span>Tax Invoice</span><span>فاتورة ضريبية</span></div>`
      : ''

  const showCustomer = bill.customerId > 1
  const mobParts = [bill.customerMobile.trim(), bill.customerTelephone.trim()].filter(Boolean)
  const customerMob = mobParts.length ? `Mob: ${mobParts.join(' / ')}` : ''

  let discountBlock = ''
  if (bill.discount !== 0 || bill.roundOff !== 0 || (isItemWise && printDiscount > 0)) {
    const bits: string[] = []
    if (nonTaxable > 0) bits.push(pair('NonTaxable Amt:', money(nonTaxable)))
    if (!isItemWise && bill.discount !== 0) bits.push(pair('Taxable Before :', money(taxableEx)))
    if (isItemWise && printDiscount > 0) bits.push(pair('Discount   :', money(printDiscount)))
    else if (bill.discount !== 0) bits.push(pair('Discount   :', money(bill.discount)))
    if (hasTax) bits.push(pair('Taxable Amount  :', money(discountTaxable)))
    if (lineTax > 0 || discountTax > 0) bits.push(pair(`${taxName}@${pctFmt(taxPct)}% :`, money(discountTax)))
    const beforeRound = round2(discountTaxable + discountTax + nonTaxable)
    if (bill.roundOff !== 0) {
      bits.push(pair('Amount :', money(hasTax ? beforeRound : lineTotalSum)))
      bits.push(pair('RoundOff :', money(bill.roundOff)))
    }
    if (hasTax) {
      bits.push(pair('Bill Amount :', money(netBill)))
      bits.push(dash())
    }
    discountBlock = bits.join('')
  }

  const settlementBill = netBill

  let settlement = bill.dummy
    ? ''
    : `<div class="vb-settle">Settlement : ${escReceipt(bill.paymentMode || 'CASH')}</div>`
  if (showCustomer && !bill.dummy) {
    settlement += `<div class="vb-indent">Customer #:${escReceipt(bill.customerCode)}</div>`
    settlement += `<div class="vb-indent">Customer  :${escReceipt(bill.customerName)}</div>`
  }
  if (customerMob && showCustomer && !bill.dummy) settlement += `<div class="vb-indent">${escReceipt(customerMob)}</div>`

  const mode = (bill.paymentMode || 'CASH').toUpperCase()
  if (bill.dummy) {
    settlement += `<div class="vb-same"><span>Items : ${bill.lines.length}</span><span>Qty : ${escReceipt(qtyFmt(totalQty))}</span></div>`
  } else if (mode === 'SPLITPAY' || mode === 'MULTIPAYMENT') {
    const splits = (bill.splits ?? []).filter((s) => s.amount > 0)
    settlement += `<div class="vb-split"><span>Items : ${bill.lines.length}</span><span class="vb-pair grow"><span>Bill Amount  :</span><span>${escReceipt(money(settlementBill))}</span></span></div>`
    settlement += `<div class="vb-indent">Qty : ${escReceipt(qtyFmt(totalQty))}</div>`
    settlement += splits
      .map(
        (s) =>
          `<div class="vb-split pay"><span>${escReceipt(s.label.toUpperCase())}</span><span>:</span><span class="r">${escReceipt(money(s.amount))}</span></div>`,
      )
      .join('')
  } else {
    settlement += `<div class="vb-split"><span>Items : ${bill.lines.length}</span><span class="vb-pair grow"><span>Bill Amount  :</span><span>${escReceipt(money(settlementBill))}</span></span></div>`
    settlement += `<div class="vb-split"><span>Qty : ${escReceipt(qtyFmt(totalQty))}</span><span class="vb-pair grow"><span>Paid Amount :</span><span>${escReceipt(money(bill.paid))}</span></span></div>`
    settlement += `<div class="vb-split"><span></span><span class="vb-pair grow"><span>Bal. Amount:</span><span>${escReceipt(money(bill.balance))}</span></span></div>`
  }

  let taxDetails = ''
  if (bill.discount === 0 && bill.roundOff === 0 && lineTax !== 0 && !(isItemWise && printDiscount > 0)) {
    taxDetails += `<div class="vb-center">Tax Details</div>${dash()}`
    if (nonTaxable > 0) {
      taxDetails += pair('NonTaxable Amt:', money(nonTaxable))
      taxDetails += pair('Taxable Amount  :', money(taxableEx))
      taxDetails += pair(`VAT@${pctFmt(taxPct)}% :`, money(lineTax))
      taxDetails += pair('Bill Amount :', money(lineTotalSum))
      taxDetails += dash()
    } else {
      taxDetails += `<div class="vb-3"><span>Taxable Amount</span><span>VAT@${escReceipt(pctFmt(taxPct))}%</span><span>Bill Amount</span></div>`
      taxDetails += `<div class="vb-3"><span>${escReceipt(money(taxableEx))}</span><span>${escReceipt(money(lineTax))}</span><span>${escReceipt(money(lineTotalSum))}</span></div>`
      taxDetails += dash()
    }
  }

  let delivery = ''
  if (supply === 'DELIVERY' && showCustomer) {
    delivery += `<div>Cust Name : ${escReceipt(bill.customerName)}</div>`
    delivery += `<div>Mob:${escReceipt(bill.customerMobile.trim())}/${escReceipt(bill.customerTelephone.trim())}</div>`
    if (bill.customerCity) delivery += `<div>Area :${escReceipt(bill.customerCity)}</div>`
    if (bill.customerAddress) delivery += `<div class="vb-item">${escReceipt(bill.customerAddress)}</div>`
    delivery += dash()
  }

  const footer = `${head.h6 ? `<div class="vb-sm vb-center">${escReceipt(head.h6)}</div>` : ''}${head.h7 ? `<div class="vb-sm vb-center">${escReceipt(head.h7)}</div>` : ''}`

  const tablePrint = bill.dummy && bill.tableName.length > 10 ? bill.tableName.slice(0, 10) : bill.tableName
  const showSummary = bill.discount !== 0 || bill.roundOff !== 0 || (isItemWise && printDiscount > 0)
  let dummyTail = ''
  if (bill.dummy) {
    if (showSummary) {
      dummyTail += dash()
      dummyTail += pair('TOTAL  :', money(gross))
      if (nonTaxable > 0) dummyTail += pair('NonTaxable Amt:', money(nonTaxable))
      if (!isItemWise && bill.discount !== 0) dummyTail += pair('Taxable Before :', money(taxableEx))
      if (isItemWise && printDiscount > 0) dummyTail += pair('Discount   :', money(printDiscount))
      else if (bill.discount !== 0) dummyTail += pair('Discount   :', money(bill.discount))
      if (hasTax) dummyTail += pair('Taxable Amount  :', money(discountTaxable))
      if (hasTax) dummyTail += pair(`${taxName}@${pctFmt(taxPct)}% :`, money(discountTax))
      if (bill.roundOff !== 0) dummyTail += pair('RoundOff   :', money(bill.roundOff))
      dummyTail += pair('Bill Amount :', money(netBill))
      dummyTail += `<div class="vb-same"><span>Items : ${bill.lines.length}</span><span>Qty : ${escReceipt(qtyFmt(totalQty))}</span></div>`
      dummyTail += dash()
    } else if (hasTax) {
      dummyTail += dash()
      dummyTail += `<div>Tax Details</div>`
      dummyTail += dash()
      if (nonTaxable > 0) {
        dummyTail += pair('NonTaxable Amt:', money(nonTaxable))
        dummyTail += pair('Taxable Amount  :', money(taxableEx))
        dummyTail += pair(`${taxName}@${pctFmt(taxPct)}% :`, money(lineTax))
        dummyTail += pair('Bill Amount :', money(lineTotalSum))
        dummyTail += dash()
      } else {
        dummyTail += `<div class="vb-3"><span>Taxable Amount</span><span>${escReceipt(taxName)}@${escReceipt(pctFmt(taxPct))}%</span><span>Bill Amount</span></div>`
        dummyTail += `<div class="vb-3"><span>${escReceipt(money(taxableEx))}</span><span>${escReceipt(money(lineTax))}</span><span>${escReceipt(money(lineTotalSum))}</span></div>`
        dummyTail += dash()
      }
    } else {
      dummyTail += dash()
      dummyTail += pair('Bill Amount :', money(lineTotalSum))
      dummyTail += dash()
    }
    if (showCustomer) {
      dummyTail += `<div class="vb-cust">Customer Details</div>`
      dummyTail += dash()
      dummyTail += `<div>Cust Name : ${escReceipt(bill.customerName)}</div>`
      if (customerMob) dummyTail += `<div>Mob : ${escReceipt(customerMob.replace(/^Mob:\s*/, ''))}</div>`
      if (bill.customerCity?.trim()) dummyTail += `<div>Area :${escReceipt(bill.customerCity.trim())}</div>`
      if (bill.customerAddress?.trim()) dummyTail += `<div>${escReceipt(bill.customerAddress.trim())}</div>`
      dummyTail += dash()
    }
    dummyTail += code128Svg(bill.kotNo)
    dummyTail += `${head.h6 ? `<div class="vb-sm">${escReceipt(head.h6)}</div>` : ''}${head.h7 ? `<div class="vb-sm">${escReceipt(head.h7)}</div>` : ''}`
  }
  const meta = bill.dummy
    ? `${dash()}
    <div class="vb-kotline">KOT #  ${escReceipt(bill.kotNo)}&nbsp;&nbsp;${escReceipt(when.date)}&nbsp;&nbsp;${escReceipt(when.time)}</div>
    <div class="vb-same"><span>Cntr: ${escReceipt(bill.counterNo)}</span><span>Cashier : ${escReceipt(bill.cashier)}</span></div>
    <div>Table : ${escReceipt(tablePrint)}&nbsp;&nbsp;&nbsp;&nbsp;No Of Guests : ${escReceipt(bill.guests)}</div>
    ${bill.waiterName.trim() ? `<div>Waiter : ${escReceipt(bill.waiterName)}</div>` : ''}
    ${bill.comments.trim() ? `${dash()}<div class="vb-sm">Comments :</div><div>${escReceipt(bill.comments)}</div>` : ''}`
    : `${dash()}
    <div>OrderNo : ${escReceipt(bill.kotNo)}${escReceipt(orderTail)}</div>
    ${dash()}
    <div>Inv No #    ${escReceipt(bill.billNo)}</div>
    <div>Inv Date :${escReceipt(formatWhen(bill.billTime))}</div>
    <div class="vb-same"><span>Cntr: ${escReceipt(bill.counterNo)}</span><span>Cashier : ${escReceipt(bill.cashier)}</span></div>
    <div class="vb-same"><span>Table : ${escReceipt(bill.tableName)}</span><span>Waiter : ${escReceipt(bill.waiterName)}</span></div>
    <div>No Of Guests : ${escReceipt(bill.guests)}</div>
    <div>Comments : ${escReceipt(bill.comments)}</div>`

  if (bill.dummy) {
    return `<div class="vb-bill is-dummy">
    ${headings}
    ${trn}
    ${meta}
    ${dash()}
    <div class="vb-cols vb-item"><span>Description</span><span class="r">Qty</span><span class="r">Price</span><span class="r">Total</span></div>
    ${dash()}
    ${itemHtml}
    ${dummyTail}
  </div>`
  }

  return `<div class="vb-bill">
    ${headings}
    ${trn}
    ${meta}
    ${dash()}
    <div class="vb-cols vb-item"><span>Description</span><span class="r">Qty</span><span class="r">Price</span><span class="r">Total</span></div>
    ${dash()}
    ${itemHtml}
    ${dash()}
    ${pair('TOTAL  :', money(gross))}
    ${dash()}
    ${discountBlock}
    ${settlement}
    ${dash()}
    ${taxDetails}
    ${delivery}
    ${footer}
  </div>`
}

const STYLE_CSS = `
  .vb-bill, .vb-bill div, .vb-bill span {
    font-family: "Courier New", Courier, monospace !important;
    font-weight: 700 !important;
    font-synthesis: none;
    font-size: 9.5pt !important;
    color: #000 !important;
    line-height: 1.2;
    -webkit-font-smoothing: none;
  }
  .vb-bill { width: 100%; max-width: 100%; }
  .vb-bill .vb-h1, .vb-bill .vb-h1 * {
    font-family: "Agency FB", "Arial Narrow", sans-serif !important;
    font-size: 13pt !important;
    font-weight: 700 !important;
    line-height: 1.05;
    text-align: center;
  }
  .vb-bill .vb-h2, .vb-bill .vb-h2 * {
    font-family: "Berlin Sans FB", "Trebuchet MS", sans-serif !important;
    font-size: 9pt !important;
    font-weight: 400 !important;
    text-align: center;
  }
  .vb-bill .vb-sm, .vb-bill .vb-sm * { font-size: 8pt !important; }
  .vb-bill .vb-item, .vb-bill .vb-item * { font-size: 9pt !important; }
  .vb-trn { text-align: center; }
  .vb-bill .vb-taxinv, .vb-bill .vb-taxinv * {
    font-family: "Arabic Typesetting", "Traditional Arabic", "Segoe UI", serif !important;
    font-size: 14pt !important;
    font-weight: 700 !important;
    line-height: 1;
  }
  .vb-taxinv { display: flex; justify-content: space-between; padding: 0 2mm; }
  .vb-dash { overflow: hidden; white-space: nowrap; line-height: 1; margin: 1px 0; }
  .vb-cols { display: grid; grid-template-columns: 1.4fr 0.45fr 0.7fr 0.85fr; column-gap: 1px; }
  .vb-pair { display: flex; justify-content: space-between; gap: 8px; }
  .vb-pair.grow { flex: 1; margin-left: 6px; }
  .vb-split { display: flex; justify-content: space-between; align-items: baseline; }
  .vb-split.pay { display: grid; grid-template-columns: 28mm 4mm 1fr; padding-left: 6mm; }
  .vb-same { display: flex; justify-content: space-between; }
  .vb-indent { padding-left: 4mm; }
  .vb-bill .vb-vat, .vb-bill .vb-vat * { padding-left: 16mm; font-size: 9pt !important; }
  .vb-center { text-align: center; }
  .vb-dummy-title, .vb-dummy-title * {
    font-family: "Segoe UI", sans-serif !important;
    font-size: 13pt !important;
    font-weight: 700 !important;
    text-align: center;
    line-height: 1.1;
    margin: 2px 0 1px;
  }
  .vb-kotline { white-space: nowrap; }
  .vb-bill.is-dummy .vb-vat, .vb-bill.is-dummy .vb-vat * { padding-left: 0; }
  .vb-cust { font-size: 12pt; font-weight: 700; margin-top: 4px; }
  .vb-barcode { text-align: center; margin: 6px 0 2px; }
  .vb-barcode svg { width: 46mm; height: 14mm; }
  .vb-barcode rect { fill: #000; }
  .vb-3 { display: grid; grid-template-columns: 1.2fr 0.9fr 1fr; }
  .r { text-align: right; }
  .vb-settle { margin-top: 2px; }
`

/** Style-1 bill straight to the Windows default printer. No printer dialog. */
export async function printSettlementBill(bill: SettlementBillPrint) {
  const head = await loadHeadings()
  const html = buildReceiptDocumentHtml({
    title: `Bill ${bill.billNo || ''}`,
    bodyHtml: buildStyle1Html(bill, head),
    extraCss: STYLE_CSS,
    autoPrint: false,
  })
  await printHtmlOnDefaultPrinter(html)
}

/** Same style-1 bill for Sales Viewer and Bill Reprint. */
export async function printViewerBill(raw: Record<string, unknown>) {
  const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : []
  const lines = items.map(mapLine)
  const discount = num(raw.discountAmount ?? raw.discount)
  const itemDisc = round2(lines.reduce((n, l) => n + l.itemDisc, 0))
  const customerId = num(raw.customerId)
  const customerName = String(raw.customerName ?? '')
  const namedCustomer = customerId > 1 || (customerName !== '' && customerName !== 'Walk-in')
  await printSettlementBill({
    billNo: String(raw.billNo ?? ''),
    billTime: (raw.billTime ?? raw.billDate ?? null) as string | null,
    kotNo: String(raw.kotNo ?? raw.kotLabel ?? ''),
    supplyType: String(raw.supplyType ?? ''),
    counterNo: String(raw.counterNo ?? ''),
    cashier: String(raw.cashierName ?? ''),
    tableName: String(raw.tableName ?? ''),
    waiterName: String(raw.waiterName ?? ''),
    guests: String(raw.noOfCustomer ?? raw.guests ?? ''),
    comments: String(raw.comments ?? raw.remarks ?? ''),
    paymentMode: String(raw.paymentMode ?? 'CASH'),
    customerId: namedCustomer ? Math.max(customerId, 2) : 0,
    customerCode: String(raw.customerCode ?? ''),
    customerName,
    customerMobile: String(raw.mobileNo ?? ''),
    customerTelephone: String(raw.telephone ?? ''),
    customerCity: String(raw.city ?? ''),
    customerAddress: String(raw.address ?? ''),
    discount,
    roundOff: num(raw.roundOffAdj ?? raw.roundOff),
    paid: num(raw.paidAmount),
    balance: num(raw.balancePaid),
    taxPct: 0,
    taxName: '',
    itemWise: discount <= 0 && itemDisc > 0,
    lines,
  })
}
