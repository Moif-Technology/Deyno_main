/**
 * Product INVENTORY — Excel (xlsx) and PDF (jspdf) export.
 * Same libraries as ERP Daily Sales report.
 */
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type InventoryExportRow = {
  barcode: string
  description: string
  packQty: number
  productWiseQty: number
  unitCost: number
  unitPrice: number
  amount: number
  groupName: string
  supplierName: string
  subSubGroup: string
}

export type InventoryExportReport = {
  reportTitle: string
  heading1: string
  heading2: string
  heading3: string
  heading4: string
  hidePrice: boolean
  groupWise: boolean
  supplierWise: boolean
  rows: InventoryExportRow[]
  totals: { count: number; qty: number; amount: number }
}

type Section = { name: string; items: InventoryExportRow[] }

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function qtyFmt(n: number) {
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function fileStamp() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}${mm}${dd}`
}

function safeName(title: string) {
  return String(title || 'Product_INVENTORY')
    .replace(/[^\w]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'Product_INVENTORY'
}

export function sectionsFromReport(report: InventoryExportReport): Section[] {
  if (report.supplierWise) {
    const map = new Map<string, InventoryExportRow[]>()
    for (const row of report.rows) {
      const key = row.supplierName || row.subSubGroup || '—'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }))
  }
  if (report.groupWise) {
    const map = new Map<string, InventoryExportRow[]>()
    for (const row of report.rows) {
      const key = row.groupName || '—'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }))
  }
  return [{ name: '', items: report.rows }]
}

function headers(hidePrice: boolean) {
  if (hidePrice) return ['Barcode', 'Description', 'Pack Qty', 'Qty']
  return ['Barcode', 'Description', 'Pack Qty', 'Qty', 'Cost', 'Amount', 'Price']
}

function lineCells(row: InventoryExportRow, hidePrice: boolean) {
  const base = [row.barcode, row.description, qtyFmt(row.packQty), qtyFmt(row.productWiseQty)]
  if (hidePrice) return base
  return [...base, money(row.unitCost), money(row.amount), money(row.unitPrice)]
}

export function exportInventoryExcel(report: InventoryExportReport) {
  const hide = report.hidePrice
  const cols = headers(hide)
  const sections = sectionsFromReport(report)
  const wsData: (string | number)[][] = []

  if (report.heading1) wsData.push([report.heading1])
  if (report.heading2) wsData.push([report.heading2])
  wsData.push([report.reportTitle])
  wsData.push([report.heading3 + (report.heading4 ? `  ${report.heading4}` : '')])
  wsData.push([])
  wsData.push(cols)

  for (const sec of sections) {
    if (sec.name) {
      wsData.push([sec.name])
    }
    for (const row of sec.items) {
      wsData.push(lineCells(row, hide))
    }
  }

  const totalLine = hide
    ? [`COUNT : ${report.totals.count}`, '', 'Total Qty', qtyFmt(report.totals.qty)]
    : [
        `COUNT : ${report.totals.count}`,
        '',
        'Total Qty',
        qtyFmt(report.totals.qty),
        '',
        money(report.totals.amount),
        '',
      ]
  wsData.push([])
  wsData.push(totalLine)

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = hide
    ? [{ wch: 18 }, { wch: 42 }, { wch: 12 }, { wch: 12 }]
    : [
        { wch: 18 },
        { wch: 42 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
      ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
  XLSX.writeFile(wb, `${safeName(report.reportTitle)}_${fileStamp()}.xlsx`)
}

export function exportInventoryPdf(report: InventoryExportReport) {
  const hide = report.hidePrice
  const cols = headers(hide)
  const sections = sectionsFromReport(report)
  const body: (string | { content: string; colSpan: number; styles: Record<string, unknown> })[][] = []

  for (const sec of sections) {
    if (sec.name) {
      body.push([
        {
          content: sec.name,
          colSpan: cols.length,
          styles: { fontStyle: 'bold', fillColor: [241, 230, 233], textColor: [120, 8, 41] },
        },
      ])
    }
    for (const row of sec.items) {
      body.push(lineCells(row, hide))
    }
  }

  const doc = new jsPDF({ orientation: hide ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' })
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

  const foot = hide
    ? [[`COUNT : ${report.totals.count}`, '', 'Total Qty', qtyFmt(report.totals.qty)]]
    : [
        [
          `COUNT : ${report.totals.count}`,
          '',
          'Total Qty',
          qtyFmt(report.totals.qty),
          '',
          money(report.totals.amount),
          '',
        ],
      ]

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
    columnStyles: hide
      ? {
          2: { halign: 'right' },
          3: { halign: 'right' },
        }
      : {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
        },
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      const page = data.pageNumber
      const pages = doc.getNumberOfPages()
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text(`Page ${page} of ${pages}`, pageW - 10, doc.internal.pageSize.getHeight() - 6, {
        align: 'right',
      })
    },
  })

  doc.save(`${safeName(report.reportTitle)}_${fileStamp()}.pdf`)
}
