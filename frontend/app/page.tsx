"use client";

import { useEffect, useState, useCallback } from "react";
import { api, Contract, Summary, FilterOptions } from "@/lib/api";
import { formatKRW, daysUntil, expiryBadge } from "@/lib/utils";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { RefreshCw, Search, X, Plus, Download } from "lucide-react";
import EditModal from "@/app/components/EditModal";

const col = createColumnHelper<Contract>();

const COLUMNS = [
  col.accessor("corporation", { header: "등록법인", size: 100 }),
  col.accessor("vendor", { header: "렌탈업체", size: 100 }),
  col.accessor("item", { header: "품목", size: 80 }),
  col.accessor("status", {
    header: "상태",
    size: 70,
    cell: (info) => {
      const v = info.getValue();
      const cls = v === "사용중" ? "text-green-700 font-medium" : "text-gray-400";
      return <span className={cls}>{v ?? "-"}</span>;
    },
  }),
  col.accessor("end_date", {
    header: "만료일",
    size: 100,
    cell: (info) => {
      const d = info.getValue();
      const days = daysUntil(d);
      const badge = expiryBadge(days);
      return (
        <div className="flex items-center gap-1.5">
          <span>{d ?? "-"}</span>
          {days !== null && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
      );
    },
  }),
  col.accessor("contract_months", { header: "계약(월)", size: 70 }),
  col.accessor("monthly_fee", {
    header: "월렌트비",
    size: 100,
    cell: (info) => (
      <span className="font-mono">{formatKRW(info.getValue())}</span>
    ),
  }),
  col.accessor("address", {
    header: "설치주소",
    size: 220,
    cell: (info) => (
      <span className="text-xs text-gray-600 line-clamp-1">{info.getValue() ?? "-"}</span>
    ),
  }),
  col.accessor("serial_no", { header: "S/N", size: 130 }),
  col.accessor("payment_method", { header: "납부", size: 70 }),
  col.accessor("notes", {
    header: "비고",
    size: 100,
    cell: (info) => (
      <span className="text-xs text-gray-500">{info.getValue() ?? ""}</span>
    ),
  }),
];

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent || "bg-white"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  customOptions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  customOptions?: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[110px]"
      >
        <option value="">전체</option>
        {customOptions
          ? customOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
      </select>
    </div>
  );
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [opts, setOpts] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Contract | null>(null);
  const [isNewModal, setIsNewModal] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [filterCorp, setFilterCorp] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterExpiry, setFilterExpiry] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, o] = await Promise.all([
        api.summary(),
        api.contracts({
          corporation: filterCorp || undefined,
          vendor: filterVendor || undefined,
          status: filterStatus || undefined,
          expiring_days: filterExpiry ? parseInt(filterExpiry) : undefined,
          q: search || undefined,
          sort_by: sorting[0]?.id,
          sort_dir: sorting[0]?.desc ? "desc" : "asc",
        }),
        opts ? Promise.resolve(opts) : api.filterOptions(),
      ]);
      setSummary(s);
      setContracts(c);
      if (!opts) setOpts(o);
    } finally {
      setLoading(false);
    }
  }, [filterCorp, filterVendor, filterStatus, filterExpiry, search, sorting, opts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const table = useReactTable({
    data: contracts,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  });

  const handleReimport = async () => {
    await api.reimport();
    setOpts(null);
    fetchData();
  };

  const handleSaved = (saved: Contract) => {
    setContracts((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setEditTarget(null);
    setIsNewModal(false);
    // Refresh summary counts
    api.summary().then(setSummary);
  };

  const handleDeleted = (id: number) => {
    setContracts((prev) => prev.filter((c) => c.id !== id));
    setEditTarget(null);
    api.summary().then(setSummary);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">렌탈 계약 관리</h1>
          <p className="text-xs text-gray-400 mt-0.5">법인통합 렌탈현황 대시보드</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsNewModal(true); setEditTarget(null); }}
            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg transition"
          >
            <Plus size={13} /> 새 계약
          </button>
          <a
            href={api.exportExcel({
              corporation: filterCorp || undefined,
              vendor: filterVendor || undefined,
              status: filterStatus || undefined,
              expiring_days: filterExpiry ? parseInt(filterExpiry) : undefined,
              q: search || undefined,
            })}
            download
            className="flex items-center gap-1.5 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition"
          >
            <Download size={13} /> Excel 내보내기
          </a>
          <button
            onClick={handleReimport}
            className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
          >
            <RefreshCw size={13} /> Excel 재로드
          </button>
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Stats */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="전체 계약" value={`${summary.total_count}건`} />
            <StatCard label="사용중" value={`${summary.active_count}건`} accent="bg-green-50" />
            <StatCard
              label="월 렌트비 합계"
              value={formatKRW(summary.total_monthly_fee)}
              sub="사용중 기준"
              accent="bg-blue-50"
            />
            <StatCard
              label="30일 내 만료"
              value={`${summary.expiring_30}건`}
              accent={summary.expiring_30 > 0 ? "bg-red-50" : "bg-white"}
            />
            <StatCard
              label="60일 내 만료"
              value={`${summary.expiring_60}건`}
              accent={summary.expiring_60 > 0 ? "bg-orange-50" : "bg-white"}
            />
            <StatCard label="90일 내 만료" value={`${summary.expiring_90}건`} />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="품목·S/N·주소·법인 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
                className="pl-8 pr-3 py-2 text-sm border rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                  }}
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <Select
              label="법인"
              value={filterCorp}
              onChange={setFilterCorp}
              options={opts?.corporations ?? []}
            />
            <Select
              label="렌탈업체"
              value={filterVendor}
              onChange={setFilterVendor}
              options={opts?.vendors ?? []}
            />
            <Select
              label="상태"
              value={filterStatus}
              onChange={setFilterStatus}
              options={opts?.statuses ?? []}
            />
            <Select
              label="만료 임박"
              value={filterExpiry}
              onChange={setFilterExpiry}
              options={[]}
              customOptions={[
                { value: "30", label: "30일 이내" },
                { value: "60", label: "60일 이내" },
                { value: "90", label: "90일 이내" },
              ]}
            />

            {(filterCorp || filterVendor || filterStatus || filterExpiry || search) && (
              <button
                onClick={() => {
                  setFilterCorp("");
                  setFilterVendor("");
                  setFilterStatus("");
                  setFilterExpiry("");
                  setSearch("");
                  setSearchInput("");
                }}
                className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
              >
                <X size={12} /> 초기화
              </button>
            )}

            <span className="text-xs text-gray-400 ml-auto self-center">
              {loading ? "로딩중..." : `${contracts.length}건`}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-3 py-2.5 text-left text-xs font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100"
                        style={{ width: h.getSize() }}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" && " ↑"}
                        {h.column.getIsSorted() === "desc" && " ↓"}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-blue-50 cursor-pointer transition"
                    onClick={() => { setEditTarget(row.original); setIsNewModal(false); }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 whitespace-nowrap"
                        style={{ maxWidth: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {contracts.length === 0 && !loading && (
              <div className="text-center py-16 text-gray-400 text-sm">
                조건에 맞는 계약이 없습니다.
              </div>
            )}
          </div>
        </div>
      </main>

      <EditModal
        contract={editTarget}
        isNew={isNewModal}
        onClose={() => { setEditTarget(null); setIsNewModal(false); }}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
