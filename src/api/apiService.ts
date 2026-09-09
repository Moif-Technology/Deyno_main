/**
 * Deyno Quick POS data service — talks to the Moifone ERP API.
 *
 * Namespaces used (see docs/DEYNO_QUICK_API.md):
 *   /api/pos/*        the RESTAURANT-POS till surface — device auth, KOT,
 *                     settle, counter X/Z, credit receipts, sales viewer
 *   /api/groups       shared catalogue, reachable with a POS-scoped token
 *   /api/products     (POS_ALLOWED_CATALOGUE in the API's authMiddleware)
 *   /api/customers
 *   /api/tables
 *
 * Method names and return shapes are unchanged from the mock this replaced, so
 * no component had to change. Where the server's shape already matches what the
 * UI reads — `mapDeynoViewerBill`, `mapCounterCloseForUi`, `catalogueMapper`,
 * SalesReportDialog — the response is passed straight through rather than being
 * re-keyed into an intermediate shape and back.
 */
import { api, qs } from '../lib/api'
import { SessionManager } from '../utils/sessionManager'
import { getEnrollment } from '../utils/deviceEnrollment'
import { getPosSession } from '../utils/posSession'
import type { RestaurantTable } from '../types/table'

type Row = Record<string, unknown>

/** Enrolled company id, falling back to the live session. */
function companyId(): number {
  const fromEnrollment = getEnrollment()?.companyId
  if (fromEnrollment && fromEnrollment > 0) return fromEnrollment
  return Number(SessionManager.companyId ?? 0) || 0
}

function deviceToken(): string {
  return getEnrollment()?.deviceToken ?? SessionManager.deviceToken ?? ''
}

/** Server lists come back wrapped: { groups: [...] }, { bills: [...] }, … */
function listOf(payload: unknown, key: string): Row[] {
  if (Array.isArray(payload)) return payload as Row[]
  const wrapped = (payload as Row | null)?.[key]
  return Array.isArray(wrapped) ? (wrapped as Row[]) : []
}

class ApiService {
  // ── Auth / enroll ──────────────────────────────────────────────────────

  /** Username + password. ERP-scoped token — admin convenience, not the till path. */
  async login(login: string, password: string): Promise<Row> {
    return api.post<Row>('/pos/login', { login, password }, { public: true })
  }

  /**
   * Device PIN login. `staffId` is the `staffPk` from the staff picker, so the
   * server does exactly one bcrypt compare instead of scanning the company.
   */
  async pinLogin(opts: {
    pin: string
    companyId: number
    staffId?: number
    deviceToken: string
  }): Promise<Row> {
    return api.post<Row>(
      '/pos/device/pin-login',
      {
        pin: opts.pin,
        companyId: opts.companyId,
        staffId: opts.staffId,
        deviceToken: opts.deviceToken,
      },
      { public: true },
    )
  }

  /** Staff picker for an enrolled device. Only staff who actually have a PIN. */
  async fetchPosStaffList(token: string): Promise<Row[]> {
    const res = await api.post<Row>(
      '/pos/device/staff-list',
      { deviceToken: token },
      { public: true },
    )
    return listOf(res, 'staff').map((s) => ({
      // pinLogin wants staffPk; the UI reads staffId. Keep both spellings so
      // either convention resolves to the surrogate PK, never the business id.
      staffId: s.staffPk,
      StaffID: s.staffPk,
      staffPk: s.staffPk,
      businessStaffId: s.staffId,
      staffName: s.staffName,
      StaffName: s.staffName,
      staffCode: s.staffCode ?? '',
      roleName: s.roleName ?? '',
    }))
  }

  /** Admin credentials in, the company's RESTAURANT_POS tills out. */
  async enrollListStations(body: Row): Promise<Row> {
    return api.post<Row>('/pos/device/stations', body, { public: true })
  }

  /** Pairs this deviceToken to a company + station. */
  async enrollDevice(body: Row): Promise<Row> {
    return api.post<Row>('/pos/device/enroll', body, { public: true })
  }

  /** Local mirror of the stored session — no round trip. */
  async fetchCurrentSession(): Promise<Row> {
    return {
      stationId: SessionManager.stationId ?? '',
      staffName: SessionManager.staffName ?? '',
      staffID: SessionManager.staffID ?? '',
      roleId: SessionManager.roleId ?? '',
      roleName: SessionManager.roleName ?? '',
      accessToken: SessionManager.accessToken ?? '',
      companyId: SessionManager.companyId ?? '',
    }
  }

  /** POS parameters — receipt headings, TRN, tax rate, till behaviour flags. */
  async fetchParameters(): Promise<Row> {
    const res = await api.get<Row>('/pos/parameters')
    return (res?.data as Row) ?? res ?? {}
  }

  async saveCompanyDetails(body: Row): Promise<void> {
    await api.put('/pos/parameters/company-details', body)
  }

  async fetchPrivileges(): Promise<Row[]> {
    const res = await api.get<Row>('/pos/privileges')
    return listOf(res, 'privileges')
  }

  // ── Catalogue ──────────────────────────────────────────────────────────

  async fetchGroups(): Promise<Row[]> {
    const res = await api.get<Row>('/groups')
    return listOf(res, 'groups')
  }

  async createGroup(body: Row): Promise<Row> {
    return api.post<Row>('/groups', body)
  }

  async updateGroup(groupId: string | number, body: Row): Promise<Row> {
    return api.patch<Row>(`/groups/${encodeURIComponent(String(groupId))}`, body)
  }

  async deleteGroup(groupId: string | number): Promise<void> {
    await api.delete(`/groups/${encodeURIComponent(String(groupId))}`)
  }

  async fetchProducts(opts?: {
    groupId?: string | number
    search?: string
    limit?: number
  }): Promise<Row[]> {
    const res = await api.get<Row>(
      `/products${qs({ groupId: opts?.groupId, search: opts?.search, limit: opts?.limit ?? 2000 })}`,
    )
    return listOf(res, 'products')
  }

  async createProduct(body: Row): Promise<Row> {
    return api.post<Row>('/products', body)
  }

  async updateProduct(productId: string | number, body: Row): Promise<Row> {
    return api.put<Row>(`/products/${encodeURIComponent(String(productId))}`, body)
  }

  async fetchCustomers(opts?: { limit?: number; search?: string }): Promise<Row[]> {
    const res = await api.get<Row>(
      `/customers${qs({ limit: opts?.limit ?? 400, search: opts?.search })}`,
    )
    return listOf(res, 'customers')
  }

  async createCustomer(body: Row): Promise<Row> {
    return api.post<Row>('/customers', body)
  }

  async updateCustomer(customerId: string | number, body: Row): Promise<Row> {
    return api.put<Row>(`/customers/${encodeURIComponent(String(customerId))}`, body)
  }

  /** Staff list for waiter assignment — same device-gated picker as login. */
  async fetchStaff(): Promise<Row[]> {
    return this.fetchPosStaffList(deviceToken())
  }

  /** Supervisor approval for protected actions (line delete, qty change). */
  async verifySupervisor(username: string, password: string): Promise<Row> {
    return api.post<Row>('/pos/supervisor/verify', { username, password })
  }

  // ── Jobs / KOT (Kitchen Order Ticket) ──────────────────────────────────

  async saveKot(payload: Row): Promise<Row> {
    const res = await api.post<Row>('/pos/kot/save', payload)
    // The UI reads jobId/jobNo; the server speaks CurrentKOTID. Supply both so
    // callers that already read one keep working.
    const kotId = res.CurrentKOTID ?? res.kotMasterId ?? null
    return {
      ...res,
      CurrentKOTID: kotId != null ? String(kotId) : null,
      jobId: kotId != null ? Number(kotId) : 0,
      jobNo: kotId != null ? String(kotId) : null,
    }
  }

  async fetchOrderList(opts?: {
    areaId?: string
    search?: string
    jobNo?: string
    customerName?: string
    mobile?: string
    dateFrom?: string
    dateTo?: string
  }): Promise<Row[]> {
    const res = await api.get<Row>(
      `/pos/kot/list${qs({ areaId: opts?.areaId, search: opts?.search ?? opts?.jobNo })}`,
    )
    return listOf(res, 'data')
  }

  async fetchKotDetails(kotMasterId: string): Promise<Row> {
    const id = String(kotMasterId ?? '').trim()
    if (!id) return { success: true, data: [] }
    return api.get<Row>(`/pos/kot/${encodeURIComponent(id)}`)
  }

  // ── Settlement (bill checkout) ─────────────────────────────────────────

  async saveSettlement(payload: Row): Promise<Row> {
    const res = await api.post<Row>('/pos/sales/settle', payload)
    return { success: res.ok !== false, ...res }
  }

  // ── Sales viewer ───────────────────────────────────────────────────────

  async fetchSalesViewer(opts: {
    dateFrom: string
    dateTo: string
    filter?: string
    search?: string
    customerId?: string
    counterNo?: number | string
  }): Promise<Row[]> {
    const res = await api.get<Row>(
      `/pos/sales/viewer${qs({
        dateFrom: opts.dateFrom,
        dateTo: opts.dateTo,
        customerId: opts.customerId,
        counterNo: opts.counterNo,
      })}`,
    )
    const bills = listOf(res, 'bills')
    // The server has no free-text filter on this endpoint; the dialog's search
    // box is client-side over the day's bills, which is what it always was.
    const q = opts.search?.trim().toLowerCase()
    if (!q) return bills
    return bills.filter((b) => {
      const name = String(b.customerName ?? '').toLowerCase()
      const bill = String(b.billNoDisplay ?? b.billNo ?? '').toLowerCase()
      return name.includes(q) || bill.includes(q)
    })
  }

  async fetchSalesViewerBill(salesId: string): Promise<Row> {
    const res = await api.get<Row>(
      `/pos/sales/viewer/${encodeURIComponent(String(salesId).trim())}`,
    )
    // `mapDeynoViewerBill` reads customer fields off the bill root, while the
    // server nests them under `customer`. Flatten rather than touch the shared
    // receipt mapper, which the Counter-POS receipt layout also depends on.
    const customer = (res.customer as Row) ?? {}
    return {
      ...res,
      customerId: customer.customerId ?? null,
      customerCode: customer.customerCode ?? '',
      customerName: customer.customerName ?? 'Walk-in',
      address: customer.address ?? '',
      taxRegNo: customer.taxRegNo ?? '',
      mobileNo: customer.mobileNo ?? '',
      telephone: customer.telephone ?? '',
    }
  }

  async fetchSalesReport(
    kind: 'salesman-wise' | 'item-wise' | 'group-wise',
    opts: {
      dateFrom: string
      dateTo: string
      staffId?: string | number
      productId?: string | number
      groupId?: string | number
    },
  ): Promise<Row[]> {
    // 'all' is the dialog's own sentinel for "no filter" — never send it.
    const notAll = (v: unknown) => (v == null || v === 'all' ? undefined : v)
    const res = await api.get<Row>(
      `/pos/sales/reports/${kind}${qs({
        dateFrom: opts.dateFrom,
        dateTo: opts.dateTo,
        staffId: notAll(opts.staffId),
        productId: notAll(opts.productId),
        groupId: notAll(opts.groupId),
      })}`,
    )
    return listOf(res, 'rows')
  }

  // ── Credit settlement receipts ─────────────────────────────────────────

  async fetchCreditSettlementCustomers(opts?: {
    search?: string
    limit?: number
  }): Promise<Row[]> {
    const res = await api.get<Row>(
      `/pos/settlement/credit-customers${qs({ q: opts?.search, limit: opts?.limit ?? 200 })}`,
    )
    return listOf(res, 'customers')
  }

  async fetchCustomerOutstandingBills(customerId: string): Promise<Row> {
    return api.get<Row>(
      `/pos/settlement/customers/${encodeURIComponent(String(customerId))}/bills`,
    )
  }

  async saveCreditSettlement(opts: {
    customerId: string | number
    amount: number
    paymentMode: string
    counterNo?: number
  }): Promise<Row> {
    const res = await api.post<Row>('/pos/settlement/save', {
      customerId: Number(opts.customerId),
      amount: opts.amount,
      paymentMode: opts.paymentMode,
      counterNo: opts.counterNo ?? getPosSession().counterNo,
    })
    return { ok: true, success: true, ...res }
  }

  async fetchCreditSettlementHistory(opts?: {
    customerId?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
  }): Promise<Row[]> {
    const res = await api.get<Row>(
      `/pos/settlement/history${qs({
        customerId: opts?.customerId,
        dateFrom: opts?.dateFrom,
        dateTo: opts?.dateTo,
        limit: opts?.limit ?? 150,
      })}`,
    )
    return listOf(res, 'receipts')
  }

  async fetchCreditSettlementReceipt(transactionId: string): Promise<Row> {
    return api.get<Row>(
      `/pos/settlement/receipts/${encodeURIComponent(String(transactionId))}`,
    )
  }

  // ── Counter close (X / Z) ──────────────────────────────────────────────

  async fetchCounterSummary(opts?: {
    counterNo?: number
    allStaff?: boolean
  }): Promise<Row> {
    const counterNo = opts?.counterNo ?? getPosSession().counterNo
    const res = await api.get<Row>(`/pos/counter/summary${qs({ counterNo })}`)
    return { counterNo, ...res }
  }

  async closeCounter(opts: {
    reportType: 'X' | 'Z'
    collectedCash: number
    counterNo?: number
    allStaff?: boolean
  }): Promise<Row> {
    const counterNo = opts.counterNo ?? getPosSession().counterNo
    const res = await api.post<Row>('/pos/counter/close', {
      reportType: opts.reportType,
      collectedCash: opts.collectedCash,
      counterNo,
    })
    return { counterNo, billsClosed: res.billsClosed ?? res.billCount ?? 0, ...res }
  }

  /** Cash in / cash out movements for the open counter session. */
  async fetchCashInOut(counterNo?: number): Promise<Row[]> {
    const cn = counterNo ?? getPosSession().counterNo
    const res = await api.get<Row>(`/pos/counter/cash-in-out${qs({ counterNo: cn })}`)
    return listOf(res, 'entries')
  }

  async addCashInOut(opts: {
    transactionType: 'CASH_IN' | 'CASH_OUT'
    amount: number
    remarks?: string
    counterNo?: number
  }): Promise<Row> {
    return api.post<Row>('/pos/counter/cash-in-out', {
      transactionType: opts.transactionType,
      amount: opts.amount,
      remarks: opts.remarks ?? '',
      counterNo: opts.counterNo ?? getPosSession().counterNo,
    })
  }

  // ── Dine-in tables ─────────────────────────────────────────────────────

  async fetchTables(): Promise<RestaurantTable[]> {
    const res = await api.get<Row>('/tables')
    return listOf(res, 'tables').map((t) => ({
      id: String(t.tableId ?? t.TableID ?? ''),
      label: String(t.tableName ?? t.TableName ?? t.tableCode ?? ''),
      seats: Number(t.noOfChairs ?? t.seats ?? 0) || 0,
      // The server has no per-table occupancy for quick service — the Select
      // Table flow was removed from this client (commit 88f77c5). Everything
      // reads as free; occupancy would need ops.kot_master joined by table.
      status: 'available' as const,
    }))
  }
}

/** Singleton — same usage pattern as before. */
export const apiService = new ApiService()
export default apiService

/** Re-exported so callers can identify HTTP failures without importing lib/api. */
export { ApiError } from '../lib/api'

/** Kept for callers that want the enrolled company without reaching into utils. */
export { companyId as enrolledCompanyId }
