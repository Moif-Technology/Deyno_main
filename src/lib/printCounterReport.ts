/**
 * X / Z counter close thermal print.
 * Layout = RptCounterCloseDetailsPending.Print_PrintPage
 * Delivery = Counter-POS openReceiptPrintWindow + auto window.print()
 */
import { apiService } from '../api/apiService'
import { fmtMoney } from '../utils/posSession'
import {
  buildReceiptDocumentHtml,
  escReceipt as esc,
  openReceiptPrintWindow,
} from './receiptPrintTheme'

export type CounterReportMeta = {
  heading1?: string
  heading2?: string
  heading3?: string
  trn?: string
  counterNo?: string | number
  reportType?: string
  closeNo?: string
  reportAt?: Date
}

type MoneyRow = Record<string, unknown>

function n(v: unknown) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtReportDate(d = new Date()) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '-'
  const day = String(dt.getDate()).padStart(2, '0')
  const mon = dt.toLocaleString('en-GB', { month: 'short' })
  return `${day}/${mon}/${dt.getFullYear()}`
}

function fmtReportTime(d = new Date()) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function fmtBillTime(d: unknown) {
  if (d == null || d === '') return '-'
  const dt = new Date(String(d))
  if (Number.isNaN(dt.getTime())) return '-'
  const day = String(dt.getDate()).padStart(2, '0')
  const mon = dt.toLocaleString('en-GB', { month: 'short' })
  const time = dt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return `${day}-${mon}-${dt.getFullYear()} ${time}`
}

function billNoDisplay(v: unknown) {
  if (v == null || v === '') return '-'
  return String(v)
}

function amtRow(label: string, value: number, strong = false) {
  return `
  <div class="xr-row${strong ? ' is-strong' : ''}">
    <span class="xr-lbl">${esc(label)}</span>
    <span class="xr-val">${fmtMoney(value)}</span>
  </div>`
}

function countAmtRow(label: string, count: number, amount: number) {
  return `
  <tr>
    <td>${esc(label)}</td>
    <td class="c">${count}</td>
    <td class="r">${fmtMoney(amount)}</td>
  </tr>`
}

function waiterHtml(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  let bills = 0
  let amount = 0
  let tips = 0
  const body = rows
    .map((raw) => {
      const r = raw as MoneyRow
      const c = n(r.billCount ?? r.bill_count)
      const a = n(r.amount ?? r.saleAmount)
      const t = n(r.tipAmount ?? r.tip_amount)
      bills += c
      amount += a
      tips += t
      return `
      <tr>
        <td>${esc(String(r.waiterName ?? r.staffName ?? '—'))}</td>
        <td class="c">${c}</td>
        <td class="r">${fmtMoney(a)}</td>
        <td class="r">${fmtMoney(t)}</td>
      </tr>`
    })
    .join('')
  return `
  <hr class="dash" />
  <div class="xr-section">SERVICER DETAILS (AMT / TIP)</div>
  <table class="xr-table">
    <thead>
      <tr><th>Servicer</th><th class="c">Count</th><th class="r">Amount</th><th class="r">Tips</th></tr>
    </thead>
    <tbody>
      ${body}
      <tr class="xr-total">
        <td>TOTAL</td>
        <td class="c">${bills}</td>
        <td class="r">${fmtMoney(amount)}</td>
        <td class="r">${fmtMoney(tips)}</td>
      </tr>
    </tbody>
  </table>`
}

function pendingKotHtml(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const body = rows
    .map((raw) => {
      const r = raw as MoneyRow
      const kotNo = String(r.kotNo ?? r.kot_no ?? '')
      return `
      <div class="xr-row">
        <span class="xr-lbl">${esc(kotNo || '—')}</span>
        <span class="xr-val">${fmtMoney(n(r.amount))}</span>
      </div>`
    })
    .join('')
  return `
  <hr class="dash" />
  <div class="xr-section">KOT STATUS: PENDING</div>
  <div class="xr-cols-head"><span>KOT NUMBER</span><span>AMOUNT</span></div>
  ${body}`
}

export function buildCounterReportHtml(data: MoneyRow, meta: CounterReportMeta = {}) {
  const reportType = String(meta.reportType ?? data.reportType ?? 'X').toUpperCase()
  const reportAt = meta.reportAt ? new Date(meta.reportAt) : new Date()
  const closeNo = String(meta.closeNo ?? data.closeNo ?? '')
  const counterNo = meta.counterNo ?? data.counterNo ?? ''

  const cashSales = n(data.totalCash)
  const creditReceived = n(data.creditReceiptCash)
  const advanceReceived = n(data.advanceReceived)
  const cashIn = n(data.cashIn)
  const cashOut = n(data.cashOut)
  const refund = n(data.totalRefund)
  const cashTotal = cashSales + creditReceived + advanceReceived + cashIn - cashOut
  const cashToCollect = n(data.cashToBeCollected)
  const collectedCash = n(data.collectedCash)
  const cashDifference = n(data.cashDifference)
  const creditSales = n(data.totalCredit)
  const cashTips = n(data.totalCashTip)
  const cardTips = n(data.totalCardTip)
  const cardSales = n(data.totalCard)
  const netCard = n(data.netCardAmount) || cardSales + cardTips
  const onlineSales = n(data.totalOnline)
  const onlineTips = n(data.totalOnlineTip)
  const receiptCard = n(data.creditReceiptCard)
  const voucherSales = n(data.totalVoucher)
  const complimentSales = n(data.totalCompliment)
  const totalDiscount = n(data.totalDiscount)
  const itemDiscount = n(data.itemDiscountTotal)
  const totalSales = n(data.totalSales ?? data.grossAmount)
  const taxAmount = n(data.totalTax)

  const heading1 = String(meta.heading1 ?? '').trim()
  const heading2 = String(meta.heading2 ?? '').trim()
  const heading3 = String(meta.heading3 ?? '').trim()
  const trn = String(meta.trn ?? '').trim()

  const financial = [
    amtRow('CASH SALES:', cashSales),
    amtRow('CREDIT RECEIVED:', creditReceived),
    amtRow('ADVANCE RECEIVED:', advanceReceived),
    amtRow('TOTAL CASH IN:', cashIn),
    amtRow('TOTAL CASH OUT:', cashOut),
    `<hr class="dash" />`,
    amtRow('TOTAL:', cashTotal, true),
    amtRow('REFUND:', refund),
    amtRow('CASH TO BE COLLECTED:', cashToCollect, true),
    amtRow('COLLECTED CASH:', collectedCash),
    amtRow('CASH DIFFERENCE:', cashDifference),
    amtRow('CREDIT SALES:', creditSales),
    amtRow('TOTAL CASH TIPS:', cashTips),
    amtRow('TOTAL CREDIT CARD TIPS:', cardTips),
    amtRow('TOTAL CREDIT CARD SALES:', cardSales),
    amtRow('NET CARD AMT (SALES+TIPS):', netCard),
    amtRow('ONLINE SALES:', onlineSales),
    amtRow('ONLINE TIPS:', onlineTips),
    amtRow('RECEIPT CREDIT CARD:', receiptCard),
    amtRow('VOUCHER SALES:', voucherSales),
    amtRow('COMPLIMENT SALES:', complimentSales),
    amtRow('CASH SALES (LESS REFUND):', cashSales - refund),
    amtRow('TOTAL DISCOUNT AMOUNT:', totalDiscount),
    amtRow('ITEM DISCOUNT TOTAL:', itemDiscount),
    `<hr class="dash" />`,
    amtRow('TOTAL SALES:', totalSales, true),
    amtRow('TAX AMOUNT:', taxAmount, true),
  ].join('')

  const bodyHtml = `
  ${heading1 ? `<div class="store-name">${esc(heading1)}</div>` : '<div class="store-name">MOIF TECHNOLOGY</div>'}
  ${heading2 ? `<div class="meta-line">${esc(heading2)}</div>` : ''}
  ${heading3 ? `<div class="meta-line">${esc(heading3)}</div>` : ''}
  ${trn ? `<div class="meta-line">TRN: ${esc(trn)}</div>` : ''}

  <hr class="dash" />
  <div class="xr-title">${esc(reportType)} - REPORT</div>
  <hr class="dash" />

  <div class="xr-row"><span class="xr-lbl">DATE</span><span class="xr-val">${fmtReportDate(reportAt)}</span></div>
  <div class="xr-row"><span class="xr-lbl">TIME</span><span class="xr-val">${fmtReportTime(reportAt)}</span></div>
  <div class="xr-row"><span class="xr-lbl">COUNTER CLOSE#</span><span class="xr-val">${esc(closeNo || '—')}</span></div>
  <div class="xr-row"><span class="xr-lbl">COUNTER</span><span class="xr-val">${esc(String(counterNo))}</span></div>
  <div class="xr-row"><span class="xr-lbl">BILL COUNT</span><span class="xr-val">${n(data.billCount)}</span></div>

  <hr class="dash" />
  <div class="xr-section">FIRST / LAST BILL DETAILS</div>
  <div class="xr-row">
    <span class="xr-lbl">FIRST BILL</span>
    <span class="xr-val">${esc(billNoDisplay(data.startBillNo))}   ${esc(fmtBillTime(data.startBillTime))}</span>
  </div>
  <div class="xr-row">
    <span class="xr-lbl">LAST BILL</span>
    <span class="xr-val">${esc(billNoDisplay(data.endBillNo))}   ${esc(fmtBillTime(data.endBillTime))}</span>
  </div>

  <hr class="dash" />
  <div class="xr-cols-head"><span>DESCRIPTION</span><span>AMOUNT</span></div>
  ${financial}

  <hr class="dash" />
  <div class="xr-section">BILL CANCEL DETAILS</div>
  <table class="xr-table">
    <thead>
      <tr><th>Cancel Type</th><th class="c">Count</th><th class="r">Amount</th></tr>
    </thead>
    <tbody>
      ${countAmtRow('BILL CANCELLED', 0, 0)}
      ${countAmtRow('ITEM CANCELLED', 0, 0)}
    </tbody>
  </table>

  ${pendingKotHtml(data.pendingKots)}

  <hr class="dash" />
  <div class="xr-section">BILL COUNT</div>
  <div class="xr-row"><span class="xr-lbl">CASH BILL</span><span class="xr-val">${n(data.cashBillCount)}</span></div>
  <div class="xr-row"><span class="xr-lbl">CREDIT CARD BILL</span><span class="xr-val">${n(data.cardBillCount)}</span></div>
  <div class="xr-row"><span class="xr-lbl">CREDIT BILL</span><span class="xr-val">${n(data.creditBillCount)}</span></div>
  <div class="xr-row"><span class="xr-lbl">MULTI PAYMENT BILL</span><span class="xr-val">${n(data.multiBillCount)}</span></div>
  <div class="xr-row"><span class="xr-lbl">COMPLIMENT BILL</span><span class="xr-val">${n(data.complimentBillCount)}</span></div>
  ${n(data.onlineBillCount) > 0 ? `<div class="xr-row"><span class="xr-lbl">ONLINE BILL</span><span class="xr-val">${n(data.onlineBillCount)}</span></div>` : ''}

  <hr class="dash" />
  <div class="xr-section">CARD SALES DETAILS</div>
  <table class="xr-table">
    <thead>
      <tr><th>Card</th><th class="c">Count</th><th class="r">Amount</th></tr>
    </thead>
    <tbody>
      ${countAmtRow('OTHERS', n(data.cardBillCount) + n(data.multiBillCount), cardSales)}
      <tr class="xr-total">
        <td colspan="2">TOTAL CREDIT CARD SALES</td>
        <td class="r">${fmtMoney(cardSales)}</td>
      </tr>
    </tbody>
  </table>

  <hr class="dash" />
  <div class="xr-section">CARD DETAILS (SPLITPAY / TIP)</div>
  <table class="xr-table">
    <thead>
      <tr><th>Card</th><th class="c">Count</th><th class="r">Tip</th></tr>
    </thead>
    <tbody>
      ${cardTips > 0 || n(data.cardBillCount) > 0 ? countAmtRow('CARD', n(data.cardBillCount), cardTips) : `<tr><td colspan="3" class="c">—</td></tr>`}
      <tr class="xr-total">
        <td colspan="2">TOTAL CREDIT CARD TIPS</td>
        <td class="r">${fmtMoney(cardTips)}</td>
      </tr>
      <tr class="xr-total">
        <td colspan="2">NET CARD AMT (SALES+TIPS)</td>
        <td class="r">${fmtMoney(netCard)}</td>
      </tr>
    </tbody>
  </table>

  ${waiterHtml(data.waiterSales ?? data.staffSales)}

  <hr class="dash" />
  <div class="footer">${esc(reportType)} Report — End</div>
  `

  return buildReceiptDocumentHtml({
    title: `${reportType} Report`,
    bodyHtml,
    extraCss: `
      .xr-title {
        text-align: center; font-size: 16px; font-weight: 700;
        letter-spacing: 1px; margin: 4px 0;
      }
      .xr-section {
        text-align: center; font-size: 12px; font-weight: 700;
        margin: 6px 0 4px; letter-spacing: 0.4px; text-transform: uppercase;
      }
      .xr-row {
        display: flex; justify-content: space-between; align-items: baseline;
        font-size: 12px; font-weight: 700; margin: 2px 0; gap: 6px;
        flex-wrap: nowrap; white-space: nowrap;
      }
      .xr-row.is-strong { font-size: 13px; }
      .xr-lbl { flex: 1 1 auto; min-width: 0; }
      .xr-val { flex: 0 0 auto; text-align: right; white-space: nowrap; }
      .xr-cols-head {
        display: flex; justify-content: space-between;
        font-size: 12px; font-weight: 700; margin-bottom: 4px;
        border-bottom: 1px dashed #000; padding-bottom: 3px;
      }
      table.xr-table { width: 100%; border-collapse: collapse; font-size: 11px; font-weight: 700; margin: 4px 0; }
      table.xr-table th, table.xr-table td { padding: 3px 2px; font-weight: 700; }
      table.xr-table th { text-align: left; border-bottom: 1px dashed #000; }
      table.xr-table th.c, table.xr-table td.c { text-align: center; width: 36px; }
      table.xr-table th.r, table.xr-table td.r { text-align: right; white-space: nowrap; }
      table.xr-table tr.xr-total td { font-weight: 700; padding-top: 5px; border-top: 1px dashed #000; }
    `,
  })
}

async function loadPrintHeadings(): Promise<Pick<CounterReportMeta, 'heading1' | 'heading2' | 'heading3' | 'trn'>> {
  try {
    const p = await apiService.fetchParameters()
    return {
      heading1: String(p.heading1Counter ?? p.heading1 ?? '').trim(),
      heading2: String(p.heading2Counter ?? p.heading2 ?? '').trim(),
      heading3: String(p.heading3Counter ?? p.heading3 ?? '').trim(),
      trn: String(p.taxRegistrationNo ?? '').trim(),
    }
  } catch {
    return { heading1: '', heading2: '', heading3: '', trn: '' }
  }
}

export async function printCounterReport(data: MoneyRow, meta: CounterReportMeta = {}) {
  const headings =
    meta.heading1 || meta.heading2 || meta.heading3
      ? meta
      : { ...meta, ...(await loadPrintHeadings()) }
  openReceiptPrintWindow(buildCounterReportHtml(data, headings), { width: 420, height: 920 })
}
