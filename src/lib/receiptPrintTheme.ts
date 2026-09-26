/**
 * GP-80160 print head is 72mm. Content wider than that is cut on the right.
 * Courier New bold, kept inside the 72mm head so the right edge stays on the paper.
 */

export const BILL_FONT = '"Courier New", Courier, monospace'
export const RECEIPT_PAGE_WIDTH = '72mm'

export const RECEIPT_FONT = {
  body: 12,
  storeName: 15,
  meta: 11,
  footer: 12,
  printerNote: 10,
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
    html, body {
      width: ${RECEIPT_PAGE_WIDTH};
      max-width: ${RECEIPT_PAGE_WIDTH};
      overflow: hidden;
    }
    body, table, div, span, td, th {
      font-family: ${BILL_FONT};
      font-weight: 700;
      font-synthesis: none;
      color: #000;
      -webkit-font-smoothing: none;
      text-rendering: geometricPrecision;
    }
    body {
      font-size: ${f.body}px;
      line-height: 1.2;
      margin: 0;
      padding: 1mm 3.2mm 1mm 1.6mm;
    }
    @media print {
      html, body { width: ${RECEIPT_PAGE_WIDTH}; max-width: ${RECEIPT_PAGE_WIDTH}; }
      body { padding: 1mm 3.2mm 1mm 1.6mm; font-size: ${f.body}px; }
      @page { size: ${RECEIPT_PAGE_WIDTH} auto; margin: 0; }
    }
    .store-name {
      font-size: ${f.storeName}px;
      font-weight: 700;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.15;
      margin-bottom: 3px;
    }
    .center { text-align: center; }
    .meta-line { text-align: center; font-size: ${f.meta}px; font-weight: 700; margin: 1px 0; }
    .dash { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    .footer { text-align: center; font-size: ${f.footer}px; font-weight: 700; margin-top: 8px; }
    .printer-note { font-size: ${f.printerNote}px; font-weight: 700; color: #000; margin-top: 4px; text-align: center; }
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

type DesktopPrint = { printHtml?: (html: string) => Promise<unknown> }

/** Straight to the Windows default printer. No printer dialog. */
export async function printHtmlOnDefaultPrinter(html: string) {
  const desktop = (window as Window & { deyno?: DesktopPrint }).deyno?.printHtml
  if (desktop) {
    await desktop(html)
    return
  }
  const res = await fetch('/local-print', {
    method: 'POST',
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
    body: html,
  })
  if (!res.ok) {
    const detail = (await res.text()).trim()
    throw new Error(detail || 'Could not print to the default printer')
  }
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
