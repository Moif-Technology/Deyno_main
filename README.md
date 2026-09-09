# Deyno Pro

Full-service restaurant POS — the rebuild of the Flutter `RestaurantPOS/`
Windows client. Same backend, same `RESTAURANT-POS` namespace, new stack.

`RestaurantPOS/` (Flutter) is frozen. Nothing here depends on it; it stays
around only as the behavioural reference for screens and receipt layouts.

## Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + Vite 6 + TypeScript | Same as `Deyno_Quick/`, `Counter-pos/`, `ERP_frontend/` — one skill set across all four clients |
| Styling | Tailwind 4 (`@tailwindcss/vite`) | Same as the rest of the fleet |
| Desktop shell | Electron 34 + electron-builder | `ERP_frontend/` already ships this way; thermal printing / cash drawer / USB scale are Node-side work, and Electron gets them without Rust |
| State | zustand | Already the choice in `Counter-pos/` |
| Backend | existing Moifone ERP API, `/api/pos` | No new service, no new migration, no new software type |

Android/Sunmi later, if needed, is Capacitor over the same `dist/` — the
`Counter-pos/` pattern. Nothing here blocks it.

## Setup

```bash
npm install
cp .env.example .env        # point VITE_API_PROXY_TARGET at your API
npm run check:api           # asserts the backend is reachable and /api/pos is mounted
npm run dev                 # http://localhost:5180  (browser)
npm run electron:dev        # same app inside the desktop shell
```

`npm run dev` proxies `/api` and `/health` to `VITE_API_PROXY_TARGET`, so there
is no CORS setup in development. A packaged build has no proxy — set
`VITE_API_BASE=https://api.moifone.com/api` before `npm run build`.

## What is already wired

- `src/lib/api.ts` — fetch wrapper, bearer token, `ApiError`, 401 → back to PIN
  login. No refresh-on-401 by design; the reason is in the file header.
- `src/api/apiService.ts` — the whole RESTAURANT-POS surface: device enroll,
  PIN login, parameters, privileges, catalogue, customers, staff, KOT, settle,
  counter open/close, X/Z reports, sales viewer. Lifted from `Deyno_Quick/`
  unchanged, so both clients speak to the server identically.
- `src/utils/` — `sessionManager` (shift token), `deviceEnrollment` (per-install
  device token), `posSession`.
- `src/App.tsx` — scaffold screen only. Pings the backend and prints the
  enrollment state. **Delete it when the real till UI lands.**
- `electron/` — window + empty `preload.cjs` bridge, waiting for the native
  printing work.

## What is NOT built

No UI. No routing. No printing. That is the developer team's work.

## Backend contract

`../api/DEYNO_QUICK_API.md` is the endpoint map, auth model and tenant
checklist. It is written for Deyno Quick but the namespace is the same one
Deyno Pro uses; the dine-in extras (areas, tables, KOT per table) sit in
`api/src/pos/restaurant-pos/`.

Tenant prerequisites before this app can enroll:

1. A station of type `RESTAURANT_POS` for the company.
2. The `pos` feature pack on the company's plan.
3. Staff with a PIN and a role whose `software_type` is `RESTAURANT-POS` or `ERP`.
4. An admin with `role_id = 1` (or a role named admin/owner) to run enrollment.

Auth is device + PIN: `POST /api/pos/device/stations` → `/enroll` →
`/staff-list` → `/pin-login`. The token is POS-scoped, 8 hours, walled to
`/api/pos/*` plus the catalogue whitelist. Do not mix it with the ERP
username/password token.

## Dev notes

- Dev port is 5180 with `strictPort`, so it never silently drifts onto another
  project's port. 5174/5175 belong to the other clients.
- Do not add a `tsconfig.node.json` project reference for `vite.config.ts`:
  `composite: true` makes `tsc -b` emit a `vite.config.js` next to it, and Vite
  then loads that stale JS instead of the TS. `vite.config.ts` is in the main
  tsconfig's `include` instead.
