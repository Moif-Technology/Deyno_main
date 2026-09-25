/**
 * Product Movement — Excel / PDF (same libraries as inventory report).
 */
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type MovementItem = {
  barcode: string
  description: string
  groupName: string
  opening: number
  inQty: number
  outQty: number
  closing: number
}

export type MovementLine = {
  barcode: string
  description: string
  date: string
  type: string
  documentNo: string
  opening: number
  inQty: number
  outQty: number
  closing: number
}

export type MovementExportReport = {
  reportTitle: string
  heading1: string
  heading2: string
  heading3: string
  heading4: string
  mode: 'summary' | 'detail'
  items: MovementItem[]
  lines: MovementLine[]
  totals: { count: number; opening: number; inQty: number; outQty: number; closing: number }
}

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function qtyFmt(n: number) {
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

function fileStamp() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}${mm}${dd}`
}

function safeName(title: string) {
  return String(title || 'Product_Movement')
    .replace(/[^\w]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'Product_Movement'
}

function fmtWhen(d: unknown) {
  if (!d) return ''
  const dt = new Date(String(d))
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function writePdf(report: MovementExportReport, cols: string[], body: string[][], foot: string[][]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const cx = pageW / 2
  let y = 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(120, 8, 41)
  if (report.heading1) {
    doc.text(report.heading1, cx, y, { align: 'center' })
    y += 6
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80)
  if (report.heading2) {
    doc.text(report.heading2, cx, y, { align: 'center' })
    y += 5
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(23, 21, 15)
  doc.text(report.reportTitle.toUpperCase(), cx, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80)
  doc.text(report.heading3 + (report.heading4 ? `   ${report.heading4}` : ''), cx, y, { align: 'center' })
  doc.setTextColor(0)

  autoTable(doc, {
    startY: y + 4,
    head: [cols],
    body,
    foot,
    showFoot: 'lastPage',
    headStyles: {
      fillColor: [120, 8, 41],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: [241, 230, 233],
      textColor: [120, 8, 41],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: [23, 21, 15] },
    alternateRowStyles: { fillColor: [250, 248, 247] },
    columnStyles: {
      [cols.length - 4]: { halign: 'right' },
      [cols.length - 3]: { halign: 'right' },
      [cols.length - 2]: { halign: 'right' },
      [cols.length - 1]: { halign: 'right' },
    },
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text(
        `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
        pageW - 10,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'right' },
      )
    },
  })
  doc.save(`${safeName(report.reportTitle)}_${fileStamp()}.pdf`)
}

export function exportMovementExcel(report: MovementExportReport) {
  const wsData: (string | number)[][] = []
  if (report.heading1) wsData.push([report.heading1])
  if (report.heading2) wsData.push([report.heading2])
  wsData.push([report.reportTitle])
  wsData.push([report.heading3 + (report.heading4 ? `  ${report.heading4}` : '')])
  wsData.push([])

  if (report.mode === 'detail') {
    wsData.push(['Barcode', 'Description', 'Date', 'Type', 'Doc No', 'Opening', 'In', 'Out', 'Closing'])
    for (const row of report.lines) {
      wsData.push([
        row.barcode,
        row.description,
        fmtWhen(row.date),
        row.type,
        row.documentNo,
        qtyFmt(row.opening),
        qtyFmt(row.inQty),
        qtyFmt(row.outQty),
        qtyFmt(row.closing),
      ])
    }
  } else {
    wsData.push(['Barcode', 'Description', 'Group', 'Opening', 'In', 'Out', 'Closing'])
    for (const row of report.items) {
      wsData.push([
        row.barcode,
        row.description,
        row.groupName,
        qtyFmt(row.opening),
        qtyFmt(row.inQty),
        qtyFmt(row.outQty),
        qtyFmt(row.closing),
      ])
    }
  }

  wsData.push([])
  if (report.mode === 'detail') {
    wsData.push([
      `COUNT : ${report.totals.count}`,
      '',
      '',
      '',
      '',
      '',
      money(report.totals.inQty),
      money(report.totals.outQty),
      '',
    ])
  } else {
    wsData.push([
      `COUNT : ${report.totals.count}`,
      '',
      '',
      money(report.totals.opening),
      money(report.totals.inQty),
      money(report.totals.outQty),
      money(report.totals.closing),
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = report.mode === 'detail'
    ? [
        { wch: 16 },
        { wch: 36 },
        { wch: 18 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
      ]
    : [
        { wch: 16 },
        { wch: 36 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
      ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movement')
  XLSX.writeFile(wb, `${safeName(report.reportTitle)}_${fileStamp()}.xlsx`)
}

export function exportMovementPdf(report: MovementExportReport) {
  if (report.mode === 'detail') {
    writePdf(
      report,
      ['Barcode', 'Description', 'Date', 'Type', 'Doc No', 'Opening', 'In', 'Out', 'Closing'],
      report.lines.map((row) => [
        row.barcode,
        row.description,
        fmtWhen(row.date),
        row.type,
        row.documentNo,
        qtyFmt(row.opening),
        qtyFmt(row.inQty),
        qtyFmt(row.outQty),
        qtyFmt(row.closing),
      ]),
      [[
        `COUNT : ${report.totals.count}`,
        '',
        '',
        '',
        '',
        '',
        money(report.totals.inQty),
        money(report.totals.outQty),
        '',
      ]],
    )
    return
  }
  writePdf(
    report,
    ['Barcode', 'Description', 'Group', 'Opening', 'In', 'Out', 'Closing'],
    report.items.map((row) => [
      row.barcode,
      row.description,
      row.groupName,
      qtyFmt(row.opening),
      qtyFmt(row.inQty),
      qtyFmt(row.outQty),
      qtyFmt(row.closing),
    ]),
    [[
      `COUNT : ${report.totals.count}`,
      '',
      '',
      money(report.totals.opening),
      money(report.totals.inQty),
      money(report.totals.outQty),
      money(report.totals.closing),
    ]],
  )
}
