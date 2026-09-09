import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://api.moifone.com'

  return {
    plugins: [react(), tailwindcss()],
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
