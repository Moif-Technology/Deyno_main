// Electron shell for Deyno Pro. Dev loads the Vite server; packaged loads dist/.
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5180'
const isDev = !app.isPackaged
const printFile = process.env.DEYNO_PRINT_FILE || ''

// GP-80160(Cut) Series only accepts these forms. Width 72mm, heights 210 / 297 / 3276 mm.
const RECEIPT_WIDTH_MICRONS = 283 * 254
const RECEIPT_PAPERS = [
  { mm: 200, height: 826 * 254 },
  { mm: 280, height: 1169 * 254 },
  { mm: 3200, height: 12897 * 254 },
]

function silentPrint(win) {
  // No deviceName: Windows default printer.
  return win.webContents
    .executeJavaScript('Math.max(document.body ? document.body.scrollHeight : 0, document.documentElement.scrollHeight)')
    .then((px) => {
      const contentMm = ((Number(px) || 400) * 25.4) / 96 + 12
      const paper = RECEIPT_PAPERS.find((item) => contentMm <= item.mm) || RECEIPT_PAPERS[RECEIPT_PAPERS.length - 1]
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Printer timed out')), 20000)
        win.webContents.print(
          {
            silent: true,
            printBackground: false,
            scaleFactor: 100,
            dpi: { horizontal: 203, vertical: 203 },
            margins: { marginType: 'none' },
            preferCSSPageSize: false,
            pageSize: { width: RECEIPT_WIDTH_MICRONS, height: paper.height },
          },
          (success, failureReason) => {
            clearTimeout(timer)
            if (!success) reject(new Error(failureReason || 'Printer failed'))
            else resolve()
          },
        )
      })
    })
}

function hiddenPrintWindow() {
  return new BrowserWindow({
    show: false,
    width: 280,
    height: 900,
    useContentSize: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, zoomFactor: 1 },
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    // ponytail: no nodeIntegration; the renderer talks HTTP only. Printing and
    // cash-drawer IPC land in preload.cjs when that work starts.
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.once('ready-to-show', () => win.show())
  if (isDev) win.loadURL(DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('deyno-print-html', async (_event, html) => {
  const printWin = hiddenPrintWindow()
  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(String(html ?? ''))}`)
    await silentPrint(printWin)
  } finally {
    if (!printWin.isDestroyed()) printWin.destroy()
  }
})

app.whenReady().then(() => {
  if (printFile) {
    const printWin = hiddenPrintWindow()
    printWin
      .loadFile(printFile)
      .then(() => silentPrint(printWin))
      .then(() => app.exit(0))
      .catch((err) => {
        console.error(err)
        app.exit(1)
      })
    return
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (printFile) return
  if (process.platform !== 'darwin') app.quit()
})
