/**
 * 80mm thermal receipt print — same auto-print path as Counter-POS.
 * Font: Courier New bold (MOIF BillFont).
 */

export const BILL_FONT = '"Courier New", Courier, monospace'
export const RECEIPT_PAGE_WIDTH = '80mm'

export const RECEIPT_FONT = {
  body: 14,
  storeName: 18,
  meta: 13,
  footer: 14,
  printerNote: 11,
}

export function escReceipt(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildReceiptBaseCss() {
  const f = RECEIPT_FONT
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, table, div, span, td, th {
      font-family: ${BILL_FONT};
      font-weight: 700;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-size: ${f.body}px;
      line-height: 1.3;
      width: ${RECEIPT_PAGE_WIDTH};
      max-width: ${RECEIPT_PAGE_WIDTH};
      margin: 0 auto;
      padding: 3mm 2mm;
    }
    @media print {
      body { width: ${RECEIPT_PAGE_WIDTH}; padding: 0; font-size: ${f.body}px; }
      @page { size: ${RECEIPT_PAGE_WIDTH} auto; margin: 2mm; }
    }
    .store-name {
      font-size: ${f.storeName}px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.2;
      margin-bottom: 5px;
    }
    .center { text-align: center; }
    .meta-line { text-align: center; font-size: ${f.meta}px; font-weight: 700; margin: 2px 0; }
    .dash { border: none; border-top: 2px dashed #000; margin: 7px 0; }
    .footer { text-align: center; font-size: ${f.footer}px; font-weight: 700; margin-top: 10px; letter-spacing: 0.3px; }
    .printer-note { font-size: ${f.printerNote}px; font-weight: 700; color: #000; margin-top: 5px; text-align: center; }
  `
}

const AUTO_PRINT_SCRIPT = `
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 400);
    };
  </script>
`

export function buildReceiptDocumentHtml(opts: {
  title?: string
  bodyHtml?: string
  extraCss?: string
  autoPrint?: boolean
}) {
  const { title = 'Receipt', bodyHtml = '', extraCss = '', autoPrint = true } = opts
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escReceipt(title)}</title>
  <style>
    ${buildReceiptBaseCss()}
    ${extraCss}
  </style>
</head>
<body>
  ${bodyHtml}
  ${autoPrint ? AUTO_PRINT_SCRIPT : ''}
</body>
</html>`
}

export function openReceiptPrintWindow(html: string, opts: { width?: number; height?: number } = {}) {
  const { width = 420, height = 920 } = opts
  const win = window.open('', '_blank', `width=${width},height=${height}`)
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to print receipts')
  win.document.write(html)
  win.document.close()
  win.focus()
  return win
}
