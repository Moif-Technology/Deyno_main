import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const appRoot = path.dirname(fileURLToPath(import.meta.url))

/** Dev-only: browser POS prints on the Windows default printer with no dialog. */
function localDefaultPrinter(): Plugin {
  return {
    name: 'deyno-local-print',
    configureServer(server) {
      server.middlewares.use('/local-print', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        req.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf8')
          const file = path.join(os.tmpdir(), `deyno-bill-${Date.now()}.html`)
          fs.writeFileSync(file, html, 'utf8')
          const electronExe = path.join(appRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
          const env: NodeJS.ProcessEnv = { ...process.env, DEYNO_PRINT_FILE: file }
          delete env.ELECTRON_RUN_AS_NODE
          const child = spawn(electronExe, ['.'], {
            cwd: appRoot,
            env,
            windowsHide: true,
          })
          let stderr = ''
          child.stderr.on('data', (data) => {
            stderr += String(data)
          })
          const timer = setTimeout(() => child.kill(), 25000)
          let settled = false
          const finish = (code: number | null, message: string) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            fs.rmSync(file, { force: true })
            if (code === 0) {
              res.statusCode = 204
              res.end()
              return
            }
            res.statusCode = 500
            res.end(message.trim() || 'Could not print to the default printer')
          }
          child.on('close', (code) => finish(code, stderr))
          child.on('error', (err) => finish(1, err.message))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://api.moifone.com'

  return {
    plugins: [react(), tailwindcss(), localDefaultPrinter()],
    // Relative base so the same build loads from file:// inside Electron.
    base: './',
    server: {
      port: 5180,
      strictPort: true,
      // The API client talks to same-origin /api in dev; this forwards it so
      // there is no CORS preflight and no origin to whitelist per developer.
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: apiProxyTarget.startsWith('https://'),
        },
        // The API serves its liveness probe at the root, outside /api.
        '/health': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: apiProxyTarget.startsWith('https://'),
        },
      },
    },
  }
})
