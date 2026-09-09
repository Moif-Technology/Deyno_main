// Electron shell for Deyno Pro. Dev loads the Vite server; packaged loads dist/.
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5180'
const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
