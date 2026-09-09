/**
 * Smallest thing that fails if the API wiring is wrong: hit the backend's
 * liveness probe and the public POS enroll endpoint, assert both answer.
 *
 * Usage: npm run check:api            (uses VITE_API_PROXY_TARGET or the hosted API)
 *        API=http://localhost:5010 npm run check:api
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

function envTarget() {
  if (process.env.API) return process.env.API
  for (const file of ['.env', '.env.example']) {
    if (!existsSync(file)) continue
    const m = readFileSync(file, 'utf8').match(/^VITE_API_PROXY_TARGET=(.+)$/m)
    if (m) return m[1].trim()
  }
  return 'https://api.moifone.com'
}

const base = envTarget().replace(/\/$/, '')

const health = await fetch(`${base}/health`)
assert.equal(health.status, 200, `GET ${base}/health returned ${health.status}`)

// No credentials on purpose: a 400/401 proves the route exists and validates.
// A 404 would mean the POS namespace is not mounted on this deployment.
const stations = await fetch(`${base}/api/pos/device/stations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
})
assert.notEqual(stations.status, 404, `POST ${base}/api/pos/device/stations is not mounted`)

console.log(`ok — ${base} health 200, /api/pos/device/stations ${stations.status}`)
