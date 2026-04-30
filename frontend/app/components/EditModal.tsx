"use client";

import { useEffect, useState } from "react";
import { Contract, api } from "@/lib/api";
import { X, Trash2, Save } from "lucide-react";

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
  { key: "serial_no", label: "S/N" },
  { key: "contract_months", label: "계약기간(월)" },
  { key: "start_date", label: "시작일", type: "date" },
  { key: "end_date", label: "만료일", type: "date" },
  { key: "monthly_fee", label: "월렌트비", type: "number" },
  { key: "payment_method", label: "납부방식" },
  { key: "address", label: "설치주소" },
  { key: "notes", label: "비고" },
];

const EMPTY: Omit<Contract, "id"> = {
  no: null, item: null, status: "사용중", serial_no: null, vendor: null,
  corporation: null, contract_months: null, start_date: null, end_date: null,
  usage_months: null, address: null, monthly_fee: null, payment_method: null,
  notes: null, source_sheet: null,
};

export default function EditModal({ contract, isNew, onClose, onSaved, onDeleted }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const src = contract ?? { id: 0, ...EMPTY };
    const init: Record<string, string> = {};
    FIELDS.forEach(({ key }) => {
      const v = src[key];
      init[key] = v == null ? "" : String(v);
    });
    setForm(init);
    setConfirmDelete(false);
  }, [contract]);

  const set = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const buildPayload = () => {
    const payload: Record<string, string | number | null> = { ...form };
    if (form.monthly_fee !== "") {
      payload.monthly_fee = parseFloat(form.monthly_fee) || null;
    } else {
      payload.monthly_fee = null;
    }
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
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

  if (!contract && !isNew) return null;

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
          {FIELDS.map(({ key, label, type }) => (
            <div key={key} className="flex items-start gap-3">
              <label className="text-xs text-gray-500 w-28 pt-2 shrink-0">{label}</label>
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
                  className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              )}
            </div>
          ))}
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
          ) : (
            <div />
          )}
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
