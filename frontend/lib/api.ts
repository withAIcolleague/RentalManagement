const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Contract {
  id: number;
  no: string | null;
  item: string | null;
  status: string | null;
  model_name: string | null;
  serial_no: string | null;
  vendor: string | null;
  corporation: string | null;
  contract_months: string | null;
  start_date: string | null;
  end_date: string | null;
  usage_months: string | null;
  address: string | null;
  monthly_fee: number | null;
  payment_method: string | null;
  notes: string | null;
  source_sheet: string | null;
}

export interface Summary {
  total_count: number;
  active_count: number;
  total_monthly_fee: number;
  expiring_30: number;
  expiring_60: number;
  expiring_90: number;
}

export interface VendorSummary {
  vendor: string;
  count: number;
  monthly_fee: number;
}

export interface CorporationSummary {
  corporation: string;
  count: number;
  monthly_fee: number;
}

export interface FilterOptions {
  corporations: string[];
  vendors: string[];
  items: string[];
  statuses: string[];
}

export interface ContractQuery {
  corporation?: string;
  vendor?: string;
  status?: string;
  item?: string;
  expiring_days?: number;
  q?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export interface AddressHistory {
  id: number;
  contract_id: number;
  address: string;
  changed_date: string;
  notes: string | null;
}

export const api = {
  summary: () => get<Summary>("/contracts/summary"),
  byVendor: () => get<VendorSummary[]>("/contracts/by-vendor"),
  byCorporation: () => get<CorporationSummary[]>("/contracts/by-corporation"),
  filterOptions: () => get<FilterOptions>("/contracts/filter-options"),
  contracts: (q: ContractQuery) =>
    get<Contract[]>("/contracts/", {
      corporation: q.corporation,
      vendor: q.vendor,
      status: q.status,
      item: q.item,
      expiring_days: q.expiring_days,
      q: q.q,
      sort_by: q.sort_by || "end_date",
      sort_dir: q.sort_dir || "asc",
      limit: q.limit || 500,
      offset: q.offset || 0,
    }),
  reimport: () =>
    fetch(`${BASE}/admin/reimport`, { method: "POST" }).then((r) => r.json()),
  updateContract: (id: number, data: Partial<Contract>) =>
    fetch(`${BASE}/contracts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json() as Promise<Contract>;
    }),
  createContract: (data: Omit<Contract, "id">) =>
    fetch(`${BASE}/contracts/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json() as Promise<Contract>;
    }),
  deleteContract: (id: number) =>
    fetch(`${BASE}/contracts/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    }),
  addressHistory: (contractId: number) =>
    get<AddressHistory[]>(`/contracts/${contractId}/address-history`),
  addAddressHistory: (contractId: number, data: { address: string; changed_date: string; notes?: string }) =>
    fetch(`${BASE}/contracts/${contractId}/address-history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json() as Promise<AddressHistory>;
    }),
  deleteAddressHistory: (historyId: number) =>
    fetch(`${BASE}/contracts/address-history/${historyId}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    }),
  exportExcel: (q: ContractQuery) => {
    const url = new URL(BASE + "/contracts/export/excel");
    if (q.corporation) url.searchParams.set("corporation", q.corporation);
    if (q.vendor) url.searchParams.set("vendor", q.vendor);
    if (q.status) url.searchParams.set("status", q.status);
    if (q.expiring_days) url.searchParams.set("expiring_days", String(q.expiring_days));
    if (q.q) url.searchParams.set("q", q.q);
    return url.toString();
  },
};
