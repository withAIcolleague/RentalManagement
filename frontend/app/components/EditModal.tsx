"use client";

import { useEffect, useState } from "react";
import { Contract, AddressHistory, api } from "@/lib/api";
import { X, Trash2, Save, Plus, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  contract: Contract | null;
  isNew?: boolean;
  onClose: () => void;
  onSaved: (c: Contract) => void;
  onDeleted?: (id: number) => void;
}

const FIELDS: { key: keyof Contract; label: string; type?: string }[] = [
  { key: "corporation", label: "등록법인" },
  { key: "vendor", label: "렌탈업체" },
  { key: "item", label: "품목" },
  { key: "status", label: "사용현황" },
  { key: "model_name", label: "모델명" },
  { key: "serial_no", label: "S/N·전화번호" },
  { key: "contract_months", label: "계약기간(월)" },
  { key: "start_date", label: "시작일", type: "date" },
  { key: "end_date", label: "만료일", type: "date" },
  { key: "monthly_fee", label: "월렌트비", type: "number" },
  { key: "payment_method", label: "납부방식" },
  { key: "address", label: "설치주소" },
  { key: "notes", label: "비고" },
];

const EMPTY: Omit<Contract, "id"> = {
  no: null, item: null, status: "사용중", model_name: null, serial_no: null, vendor: null,
  corporation: null, contract_months: null, start_date: null, end_date: null,
  usage_months: null, address: null, monthly_fee: null, payment_method: null,
  notes: null, source_sheet: null,
};

export default function EditModal({ contract, isNew, onClose, onSaved, onDeleted }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 이력 관련 state
  const [history, setHistory] = useState<AddressHistory[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newHistAddr, setNewHistAddr] = useState("");
  const [newHistDate, setNewHistDate] = useState("");
  const [newHistNote, setNewHistNote] = useState("");
  const [addingHist, setAddingHist] = useState(false);

  useEffect(() => {
    const src = contract ?? { id: 0, ...EMPTY };
    const init: Record<string, string> = {};
    FIELDS.forEach(({ key }) => {
      const v = src[key];
      init[key] = v == null ? "" : String(v);
    });
    setForm(init);
    setConfirmDelete(false);
    setHistory([]);
    setHistoryOpen(false);
    setNewHistAddr("");
    setNewHistDate("");
    setNewHistNote("");

    if (contract && !isNew) {
      api.addressHistory(contract.id).then(setHistory).catch(() => {});
    }
  }, [contract, isNew]);

  const calcEndDate = (startDate: string, months: string): string => {
    if (!startDate || !months) return "";
    const m = parseInt(months);
    if (isNaN(m) || m <= 0) return "";
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return "";
    d.setMonth(d.getMonth() + m);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const set = (key: string, val: string) =>
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "start_date" || key === "contract_months") {
        const sd = key === "start_date" ? val : prev.start_date ?? "";
        const mo = key === "contract_months" ? val : prev.contract_months ?? "";
        const auto = calcEndDate(sd, mo);
        if (auto) next.end_date = auto;
      }
      return next;
    });

  const buildPayload = () => {
    const payload: Record<string, string | number | null> = { ...form };
    payload.monthly_fee = form.monthly_fee !== "" ? parseFloat(form.monthly_fee) || null : null;
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    return payload;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      let saved: Contract;
      if (isNew) {
        saved = await api.createContract(payload as Omit<Contract, "id">);
      } else {
        saved = await api.updateContract(contract!.id, payload as Partial<Contract>);
        // 주소가 바뀌었으면 이력 새로고침
        if (payload.address !== contract!.address) {
          api.addressHistory(saved.id).then(setHistory).catch(() => {});
        }
      }
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    try {
      await api.deleteContract(contract!.id);
      onDeleted?.(contract!.id);
    } finally {
      setSaving(false);
    }
  };

  const handleAddHistory = async () => {
    if (!newHistAddr || !newHistDate || !contract) return;
    setAddingHist(true);
    try {
      const h = await api.addAddressHistory(contract.id, {
        address: newHistAddr,
        changed_date: newHistDate,
        notes: newHistNote || undefined,
      });
      setHistory((prev) => [h, ...prev]);
      setNewHistAddr("");
      setNewHistDate("");
      setNewHistNote("");
    } finally {
      setAddingHist(false);
    }
  };

  const handleDeleteHistory = async (hid: number) => {
    await api.deleteAddressHistory(hid);
    setHistory((prev) => prev.filter((h) => h.id !== hid));
  };

  if (!contract && !isNew) return null;

  const isAutoEndDate =
    !!form.start_date &&
    !!form.contract_months &&
    form.end_date === calcEndDate(form.start_date, form.contract_months);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">
            {isNew ? "새 계약 추가" : "계약 수정"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-3 flex-1">
          {FIELDS.map(({ key, label, type }) => {
            const isAuto = key === "end_date" && isAutoEndDate;
            return (
              <div key={key} className="flex items-start gap-3">
                <label className="text-xs text-gray-500 w-28 pt-2 shrink-0">
                  {label}
                  {isAuto && <span className="ml-1 text-blue-400 text-[10px]">자동</span>}
                </label>
                {key === "status" ? (
                  <select
                    value={form[key] ?? ""}
                    onChange={(e) => set(key, e.target.value)}
                    className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="사용중">사용중</option>
                    <option value="미사용">미사용</option>
                  </select>
                ) : (
                  <input
                    type={type ?? "text"}
                    value={form[key] ?? ""}
                    onChange={(e) => set(key, e.target.value)}
                    className={`flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      isAuto ? "bg-blue-50 border-blue-200" : ""
                    }`}
                  />
                )}
              </div>
            );
          })}

          {/* 설치주소 이력 (수정 모드에서만 표시) */}
          {!isNew && (
            <div className="mt-2 border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setHistoryOpen((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                <span>설치주소 이력 {history.length > 0 && `(${history.length}건)`}</span>
                {historyOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {historyOpen && (
                <div className="px-4 py-3 space-y-3">
                  {/* 이력 목록 */}
                  {history.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">이력 없음</p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((h) => (
                        <li key={h.id} className="flex items-start gap-2 text-xs">
                          <span className="text-gray-400 shrink-0 pt-0.5">{h.changed_date}</span>
                          <span className="flex-1 text-gray-700">{h.address}</span>
                          {h.notes && <span className="text-gray-400">{h.notes}</span>}
                          <button
                            onClick={() => handleDeleteHistory(h.id)}
                            className="text-gray-300 hover:text-red-400 shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* 수동 이력 추가 */}
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs text-gray-400 font-medium">이력 직접 추가</p>
                    <input
                      type="text"
                      placeholder="이전 설치주소"
                      value={newHistAddr}
                      onChange={(e) => setNewHistAddr(e.target.value)}
                      className="w-full text-xs border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newHistDate}
                        onChange={(e) => setNewHistDate(e.target.value)}
                        className="flex-1 text-xs border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                      <input
                        type="text"
                        placeholder="비고"
                        value={newHistNote}
                        onChange={(e) => setNewHistNote(e.target.value)}
                        className="flex-1 text-xs border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                      <button
                        onClick={handleAddHistory}
                        disabled={!newHistAddr || !newHistDate || addingHist}
                        className="flex items-center gap-1 text-xs bg-gray-700 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition"
                      >
                        <Plus size={12} /> 추가
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          {!isNew ? (
            <button
              onClick={handleDelete}
              disabled={saving}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition ${
                confirmDelete
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "text-red-500 hover:bg-red-50"
              }`}
            >
              <Trash2 size={14} />
              {confirmDelete ? "정말 삭제" : "삭제"}
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm px-4 py-1.5 rounded-lg border hover:bg-gray-50 transition"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "저장중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
