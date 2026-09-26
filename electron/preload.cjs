// Bridge for native-only work (thermal printing, cash drawer, USB scale).
// Empty on purpose until that work starts — the POS itself is plain HTTP.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('deyno', {
  isDesktop: true,
  platform: process.platform,
  printHtml: (html) => ipcRenderer.invoke('deyno-print-html', html),
})
